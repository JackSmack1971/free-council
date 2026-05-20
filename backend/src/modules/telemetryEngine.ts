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
    // Stub implementation for Phase 1
    return null;
  },

  pollRollbackTrigger(): void {
    // Stub implementation for Phase 1
  }
};
