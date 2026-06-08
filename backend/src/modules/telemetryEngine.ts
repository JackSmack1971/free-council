import { SessionEvent } from 'shared';
import { db } from '../db/connection.js';

const lastEventTsBySession = new Map<string, number>();

function reserveEventTimestamp(sessionId: string, requestedTs?: number): number {
  const baseTs = requestedTs ?? Date.now();
  const lastTs = lastEventTsBySession.get(sessionId);
  const nextTs = lastTs === undefined ? baseTs : Math.max(baseTs, lastTs + 1);
  lastEventTsBySession.set(sessionId, nextTs);
  return nextTs;
}

export const TelemetryEngine = {
  record(event: SessionEvent): void {
    const ts = reserveEventTimestamp(event.session_id, event.ts);
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const stmt = db.prepare(`
          INSERT INTO session_events (
            session_id,
            event_type,
            agent_count,
            api_calls,
            edge_matrix_json,
            layer_count,
            proposer_models_json,
            aggregation_calls,
            synthesis_rationale,
            synthesis_quality,
            ts
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          event.session_id,
          event.event_type,
          event.agent_count ?? null,
          event.api_calls ?? null,
          event.edge_matrix_json ?? null,
          event.layer_count ?? null,
          event.proposer_models_json ?? null,
          event.aggregation_calls ?? null,
          event.synthesis_rationale ?? null,
          event.synthesis_quality ?? null,
          ts
        );
        console.log(`[TelemetryEngine] Recorded event '${event.event_type}' for session '${event.session_id}'`);
        return;
      } catch (err) {
        if (attempt < maxAttempts) {
          console.warn(`[TelemetryEngine] Insert failed (attempt ${attempt}/${maxAttempts}), retrying: ${err}`);
        } else {
          console.error(`[TelemetryEngine] Failed to record event after ${maxAttempts} attempts:`, err);
        }
      }
    }
  },

  clearSessionState(sessionId: string): void {
    lastEventTsBySession.delete(sessionId);
  },

  queryCouncilRetentionRate(windowSeconds: number): number | null {
    try {
      const tsRow = db.prepare("SELECT value FROM app_config WHERE key = 'council_reevaluated_after_ts'").get() as { value: string } | undefined;
      const reevaluatedAfterTs = tsRow ? parseInt(tsRow.value, 10) : 0;

      const windowStart = Date.now() - windowSeconds * 1000;
      const minTs = Math.max(windowStart, reevaluatedAfterTs);

      const row = db.prepare(`
        SELECT
          SUM(CASE WHEN event_type = 'routed_to_council' THEN 1 ELSE 0 END) as total_routed,
          SUM(CASE WHEN event_type = 'completed_in_council' THEN 1 ELSE 0 END) as total_completed
        FROM session_events
        WHERE ts > ?
      `).get(minTs) as { total_routed: number | null; total_completed: number | null } | undefined;

      const totalRouted = row?.total_routed || 0;
      const totalCompleted = row?.total_completed || 0;

      if (totalRouted === 0) return null;
      return totalCompleted / totalRouted;
    } catch (err) {
      console.error('[TelemetryEngine] queryCouncilRetentionRate failed:', err);
      return null;
    }
  },

  pollRollbackTrigger(): void {
    // Delegates to RetentionMonitor - called externally
  },

  /**
   * Post-session-close hook: derives synthesis_quality for MoA sessions.
   * synthesis_quality = 1 if no retry or reverted_to_solo events recorded for this session.
   * synthesis_quality = 0 if retry or reverted_to_solo events exist.
   * synthesis_quality = NULL for non-MoA sessions (layer_count IS NULL).
   * Idempotent: safe to call multiple times for the same session_id.
   */
  populateSynthesisQuality(sessionId: string): void {
    try {
      // Check if this is a MoA session (has layer_count set)
      const isMoaRow = db.prepare(`
        SELECT COUNT(*) as cnt FROM session_events
        WHERE session_id = ? AND layer_count IS NOT NULL
      `).get(sessionId) as { cnt: number } | undefined;

      if (!isMoaRow || isMoaRow.cnt === 0) return; // Not a MoA session

      // Check for retry or reverted_to_solo events
      const negativeRow = db.prepare(`
        SELECT COUNT(*) as cnt FROM session_events
        WHERE session_id = ? AND event_type IN ('retry', 'reverted_to_solo', 'fallback_to_goa_lite')
      `).get(sessionId) as { cnt: number } | undefined;

      const synthesisQuality = (negativeRow && negativeRow.cnt > 0) ? 0 : 1;

      db.prepare(`
        UPDATE session_events SET synthesis_quality = ?
        WHERE session_id = ? AND layer_count IS NOT NULL AND synthesis_quality IS NULL
      `).run(synthesisQuality, sessionId);

      console.log(`[TelemetryEngine] Set synthesis_quality=${synthesisQuality} for MoA session ${sessionId}`);
    } catch (err) {
      console.error('[TelemetryEngine] populateSynthesisQuality failed:', err);
    }
  },

  queryModelPerformance(limit: number = 50): Array<{ modelId: string; avgScore: number; sessionCount: number; lastSeen: number }> {
    try {
      const rows = db.prepare(`
        SELECT proposer_models_json, edge_matrix_json, ts
        FROM session_events
        WHERE proposer_models_json IS NOT NULL
        ORDER BY ts DESC
        LIMIT 500
      `).all() as Array<{ proposer_models_json: string; edge_matrix_json: string | null; ts: number }>;

      const modelStats: Record<string, { totalScore: number; count: number; lastSeen: number }> = {};

      for (const row of rows) {
        try {
          const models: string[] = JSON.parse(row.proposer_models_json);
          const edgeMatrix = row.edge_matrix_json ? JSON.parse(row.edge_matrix_json) : null;
          const scores: Record<string, number> = edgeMatrix?.influenceScores || {};

          for (const modelId of models) {
            if (!modelStats[modelId]) {
              modelStats[modelId] = { totalScore: 0, count: 0, lastSeen: 0 };
            }
            // Use S score if available, otherwise count = 1 session with score 0.5 (neutral)
            const score = scores[modelId] ?? 0.5;
            modelStats[modelId].totalScore += score;
            modelStats[modelId].count++;
            modelStats[modelId].lastSeen = Math.max(modelStats[modelId].lastSeen, row.ts);
          }
        } catch { /* skip malformed rows */ }
      }

      return Object.entries(modelStats)
        .map(([modelId, stats]) => ({
          modelId,
          avgScore: stats.count > 0 ? stats.totalScore / stats.count : 0,
          sessionCount: stats.count,
          lastSeen: stats.lastSeen
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, limit);
    } catch (err) {
      console.error('[TelemetryEngine] queryModelPerformance failed:', err);
      return [];
    }
  }
};
