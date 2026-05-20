import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { RetentionMonitor } from './retentionMonitor.js';
import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';

describe('RetentionMonitor Tests', () => {
  before(() => {
    runMigrations();
  });

  beforeEach(() => {
    // Clear telemetry events and app config before each test
    db.prepare('DELETE FROM session_events').run();
    db.prepare('DELETE FROM app_config').run();
    // Re-initialize default configs
    db.prepare("INSERT INTO app_config (key, value) VALUES ('default_mode', 'council')").run();
    db.prepare("INSERT INTO app_config (key, value) VALUES ('council_reevaluated_after_ts', '0')").run();
    db.prepare("INSERT INTO app_config (key, value) VALUES ('demoted_by_retention', 'false')").run();
  });

  test('Should not demote when retention rate is high (>= 50%)', async () => {
    const ts = Date.now();
    
    // Insert 5 routed and 4 completed events (80% retention rate)
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO session_events (session_id, event_type, api_calls, ts) VALUES (?, ?, ?, ?)')
        .run(`session-${i}`, 'routed_to_council', 1, ts);
      if (i < 4) {
        db.prepare('INSERT INTO session_events (session_id, event_type, api_calls, ts) VALUES (?, ?, ?, ?)')
          .run(`session-${i}`, 'completed_in_council', 0, ts);
      }
    }

    const result = await RetentionMonitor.checkRetentionRate();
    assert.strictEqual(result.totalRouted, 5);
    assert.strictEqual(result.totalCompleted, 4);
    assert.strictEqual(result.rate, 0.8);
    assert.strictEqual(result.demoted, false);

    // Verify config state
    const mode = db.prepare("SELECT value FROM app_config WHERE key = 'default_mode'").get() as { value: string };
    const demotedFlag = db.prepare("SELECT value FROM app_config WHERE key = 'demoted_by_retention'").get() as { value: string };
    assert.strictEqual(mode.value, 'council');
    assert.strictEqual(demotedFlag.value, 'false');
  });

  test('Should demote when retention rate is low (< 50%) with at least 5 samples', async () => {
    const ts = Date.now();

    // Insert 5 routed and 2 completed events (40% retention rate)
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO session_events (session_id, event_type, api_calls, ts) VALUES (?, ?, ?, ?)')
        .run(`session-${i}`, 'routed_to_council', 1, ts);
      if (i < 2) {
        db.prepare('INSERT INTO session_events (session_id, event_type, api_calls, ts) VALUES (?, ?, ?, ?)')
          .run(`session-${i}`, 'completed_in_council', 0, ts);
      }
    }

    const result = await RetentionMonitor.checkRetentionRate();
    assert.strictEqual(result.totalRouted, 5);
    assert.strictEqual(result.totalCompleted, 2);
    assert.strictEqual(result.rate, 0.4);
    assert.strictEqual(result.demoted, true);

    // Verify config was updated
    const mode = db.prepare("SELECT value FROM app_config WHERE key = 'default_mode'").get() as { value: string };
    const demotedFlag = db.prepare("SELECT value FROM app_config WHERE key = 'demoted_by_retention'").get() as { value: string };
    assert.strictEqual(mode.value, 'solo');
    assert.strictEqual(demotedFlag.value, 'true');

    // Verify solo_demotion event was recorded
    const event = db.prepare("SELECT * FROM session_events WHERE event_type = 'solo_demotion'").get() as any;
    assert.ok(event);
  });

  test('Should ignore events before council_reevaluated_after_ts', async () => {
    const oldTs = Date.now() - 1000;
    
    // Insert 5 old routed and 0 completed events (would trigger demotion)
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO session_events (session_id, event_type, api_calls, ts) VALUES (?, ?, ?, ?)')
        .run(`session-${i}`, 'routed_to_council', 1, oldTs);
    }

    // Set reevaluated timestamp to current time (after old events)
    const newTs = Date.now();
    db.prepare("UPDATE app_config SET value = ? WHERE key = 'council_reevaluated_after_ts'")
      .run(String(newTs));

    // Run check
    const result = await RetentionMonitor.checkRetentionRate();
    // Should see 0 samples because all are before reevaluated ts
    assert.strictEqual(result.totalRouted, 0);
    assert.strictEqual(result.rate, null);
    assert.strictEqual(result.demoted, false);

    // Default mode should remain council
    const mode = db.prepare("SELECT value FROM app_config WHERE key = 'default_mode'").get() as { value: string };
    assert.strictEqual(mode.value, 'council');
  });
});
