import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { TelemetryEngine } from './telemetryEngine.js';
import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';

describe('TelemetryEngine Tests', () => {
  before(() => {
    runMigrations();
  });

  test('should record an event synchronously into the database', () => {
    const sessionId = 'test-session-' + Date.now();
    const eventType = 'routed_to_solo';

    TelemetryEngine.record({
      session_id: sessionId,
      event_type: eventType,
      ts: Date.now()
    });

    const stmt = db.prepare('SELECT * FROM session_events WHERE session_id = ? AND event_type = ?');
    const row = stmt.get(sessionId, eventType) as any;

    assert.ok(row);
    assert.strictEqual(row.session_id, sessionId);
    assert.strictEqual(row.event_type, eventType);
  });

  test('should make session event timestamps strictly monotonic', () => {
    const sessionId = 'test-session-ordered-' + Date.now();
    const baseTs = Date.now();

    TelemetryEngine.record({
      session_id: sessionId,
      event_type: 'routed_to_council',
      ts: baseTs
    });

    TelemetryEngine.record({
      session_id: sessionId,
      event_type: 'completed_in_council',
      ts: baseTs
    });

    const rows = db.prepare(`
      SELECT event_type, ts
      FROM session_events
      WHERE session_id = ?
      ORDER BY ts ASC
    `).all(sessionId) as Array<{ event_type: string; ts: number }>;

    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].event_type, 'routed_to_council');
    assert.strictEqual(rows[1].event_type, 'completed_in_council');
    assert.ok(rows[1].ts > rows[0].ts);
  });
});
