import assert from 'node:assert/strict';
import { before, beforeEach, describe, test } from 'node:test';

import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';
import { SESSION_TTL_MS, SessionStore } from './sessionStore.js';
import { SessionCleanupMonitor } from './sessionCleanupMonitor.js';

describe('SessionStore', () => {
  before(() => {
    runMigrations();
  });

  beforeEach(() => {
    db.exec('DELETE FROM sessions');
  });

  test('persists and reloads session metadata from SQLite', () => {
    const created = SessionStore.createSession('session-1', 'openai/gpt-oss-120b:free', 'solo', 1000);

    const loaded = SessionStore.getSession(created.sessionId);

    assert.deepEqual(loaded, created);
  });

  test('removes expired sessions during cleanup', () => {
    SessionStore.createSession('stale-session', 'openai/gpt-oss-120b:free', 'solo', 1000);
    SessionStore.createSession('fresh-session', 'openai/gpt-oss-120b:free', 'solo', 5000);
    SessionStore.touchSession('fresh-session', 5000 + SESSION_TTL_MS - 1);

    const deleted = SessionCleanupMonitor.runOnce(1000 + SESSION_TTL_MS + 1, SESSION_TTL_MS);

    assert.equal(deleted, 1);
    assert.equal(SessionStore.getSession('stale-session'), null);
    assert.notEqual(SessionStore.getSession('fresh-session'), null);
  });
});
