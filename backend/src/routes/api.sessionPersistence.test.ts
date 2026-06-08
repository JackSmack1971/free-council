import assert from 'node:assert/strict';
import express from 'express';
import { Server } from 'http';
import { after, before, describe, test } from 'node:test';

import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';
import { SessionStore } from '../modules/sessionStore.js';
import { apiRouter } from './api.js';
import { hashApiKey } from '../modules/sessionRegistry.js';

describe('api session persistence', () => {
  let server: Server;
  let port: number;

  before(async () => {
    runMigrations();
    db.exec('DELETE FROM sessions');

    const app = express();
    app.use(express.json());
    app.use(apiRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (!address || typeof address !== 'object') {
          throw new Error('Expected test server to bind to a port.');
        }

        port = address.port;
        resolve();
      });
    });
  });

  after(() => {
    server.close();
  });

  test('POST /session persists council sessions in SQLite', async () => {
    const response = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-api-key' },
      body: JSON.stringify({ mode: 'council' })
    });

    assert.equal(response.status, 201);
    const body = await response.json() as { sessionId: string; modelId: string; mode: string };
    const storedSession = SessionStore.getSession(body.sessionId);

    assert.ok(storedSession);
    assert.equal(storedSession?.sessionId, body.sessionId);
    assert.equal(storedSession?.modelId, body.modelId);
    assert.equal(storedSession?.mode, 'council');
    assert.equal(storedSession?.ownerApiKeyHash, hashApiKey('test-api-key'));
  });

  test('GET /sessions supports limit parameter and defaults to 50', async () => {
    db.exec('DELETE FROM conversations');
    db.exec('DELETE FROM sessions');

    const key = 'Bearer limit-key';
    const hash = hashApiKey('limit-key');

    const s1 = 'session-1';
    const s2 = 'session-2';
    const s3 = 'session-3';

    SessionStore.createSession(s1, 'openrouter/free', 'solo', hash);
    SessionStore.createSession(s2, 'openrouter/free', 'solo', hash);
    SessionStore.createSession(s3, 'openrouter/free', 'solo', hash);

    db.prepare("INSERT INTO conversations (id, ts, messages_json) VALUES (?, ?, '[]')").run(s1, 1000);
    db.prepare("INSERT INTO conversations (id, ts, messages_json) VALUES (?, ?, '[]')").run(s2, 2000);
    db.prepare("INSERT INTO conversations (id, ts, messages_json) VALUES (?, ?, '[]')").run(s3, 3000);

    const res1 = await fetch(`http://localhost:${port}/sessions?limit=2`, {
      headers: { 'Authorization': key }
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json() as { sessions: Array<{ id: string; ts: number }> };
    assert.equal(body1.sessions.length, 2);
    assert.equal(body1.sessions[0].id, s3);
    assert.equal(body1.sessions[1].id, s2);

    const res2 = await fetch(`http://localhost:${port}/sessions`, {
      headers: { 'Authorization': key }
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json() as { sessions: Array<{ id: string; ts: number }> };
    assert.equal(body2.sessions.length, 3);
    assert.equal(body2.sessions[0].id, s3);
    assert.equal(body2.sessions[1].id, s2);
    assert.equal(body2.sessions[2].id, s1);
  });
});
