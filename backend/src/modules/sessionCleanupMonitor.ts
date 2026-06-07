import {
  SESSION_CLEANUP_INTERVAL_MS,
  SESSION_TTL_MS,
  SessionStore
} from './sessionStore.js';

export const SessionCleanupMonitor = {
  runOnce(now = Date.now(), ttlMs = SESSION_TTL_MS): number {
    const deletedSessions = SessionStore.deleteExpiredSessions(now, ttlMs);
    if (deletedSessions > 0) {
      console.log(`[SessionCleanupMonitor] Removed ${deletedSessions} expired session(s)`);
    }

    return deletedSessions;
  },

  start(intervalMs = SESSION_CLEANUP_INTERVAL_MS, ttlMs = SESSION_TTL_MS): NodeJS.Timeout {
    console.log(`[SessionCleanupMonitor] Starting session cleanup with interval ${intervalMs}ms`);
    return setInterval(() => {
      this.runOnce(Date.now(), ttlMs);
    }, intervalMs);
  }
};
