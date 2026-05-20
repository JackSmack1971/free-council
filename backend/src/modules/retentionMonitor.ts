import { db } from '../db/connection.js';
import { TelemetryEngine } from './telemetryEngine.js';

export const RetentionMonitor = {
  async checkRetentionRate(): Promise<{
    totalRouted: number;
    totalCompleted: number;
    rate: number | null;
    demoted: boolean;
  }> {
    try {
      // 1. Get council_reevaluated_after_ts from config
      const tsRow = db.prepare("SELECT value FROM app_config WHERE key = 'council_reevaluated_after_ts'").get() as { value: string } | undefined;
      const reevaluatedAfterTs = tsRow ? parseInt(tsRow.value, 10) : 0;

      // 2. Query rolling 2-hour window
      const twoHoursAgo = Date.now() - 7200 * 1000;
      const minTs = Math.max(twoHoursAgo, reevaluatedAfterTs);

      const row = db.prepare(`
        SELECT
          SUM(CASE WHEN event_type = 'routed_to_council' THEN 1 ELSE 0 END) as total_routed,
          SUM(CASE WHEN event_type = 'completed_in_council' THEN 1 ELSE 0 END) as total_completed
        FROM session_events
        WHERE ts > ?
      `).get(minTs) as { total_routed: number | null; total_completed: number | null } | undefined;

      const totalRouted = row?.total_routed || 0;
      const totalCompleted = row?.total_completed || 0;
      const rate = totalRouted > 0 ? totalCompleted / totalRouted : null;

      let demoted = false;

      // 3. Evaluate threshold: rate < 0.50 and sample size >= 5
      if (totalRouted >= 5 && rate !== null && rate < 0.50) {
        // Mutate app config
        db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('default_mode', 'solo')").run();
        db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('demoted_by_retention', 'true')").run();

        console.warn(`[RetentionMonitor] Demoted default mode to Solo. Retention: ${(rate * 100).toFixed(1)}% (${totalCompleted}/${totalRouted})`);

        // Record telemetry event
        TelemetryEngine.record({
          session_id: 'system',
          event_type: 'solo_demotion',
          api_calls: 0,
          ts: Date.now()
        });

        demoted = true;
      }

      return {
        totalRouted,
        totalCompleted,
        rate,
        demoted
      };
    } catch (err: any) {
      console.error('[RetentionMonitor] Error running retention check:', err.message);
      return {
        totalRouted: 0,
        totalCompleted: 0,
        rate: null,
        demoted: false
      };
    }
  },

  start(intervalMs = 60000): NodeJS.Timeout {
    console.log(`[RetentionMonitor] Starting retention monitor with interval ${intervalMs}ms`);
    return setInterval(() => {
      this.checkRetentionRate();
    }, intervalMs);
  }
};
