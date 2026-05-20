import { SessionEvent } from 'shared';
import { db } from '../db/connection.js';

export const TelemetryEngine = {
  record(event: SessionEvent): void {
    const ts = event.ts || Date.now();
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
    } catch (err) {
      console.error(`[TelemetryEngine] Failed to record event:`, err);
    }
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
  }
};
