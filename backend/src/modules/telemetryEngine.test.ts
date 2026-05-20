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
});
