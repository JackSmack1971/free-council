import assert from 'node:assert/strict';
import express from 'express';
import { Server } from 'http';
import { after, before, describe, test } from 'node:test';

import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';
import { SessionStore } from '../modules/sessionStore.js';
import { apiRouter } from './api.js';

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
  });
});
