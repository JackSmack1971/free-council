import assert from 'node:assert/strict';
import express from 'express';
import { Server } from 'http';
import { after, before, beforeEach, describe, test } from 'node:test';

import { ConversationStore } from '../modules/conversationStore.js';
import { SessionRegistry } from '../modules/sessionRegistry.js';
import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';
import { apiRouter } from './api.js';

describe('api session authorization', () => {
  let server: Server;
  let port: number;

  before(async () => {
    runMigrations();

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

  beforeEach(() => {
    SessionRegistry.clearForTests();
    db.exec('DELETE FROM sessions');
    db.exec('DELETE FROM conversations');
    db.exec('DELETE FROM session_events');
  });

  after(() => {
    server.close();
  });

  test('POST /session requires an API key', async () => {
    const response = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'council' })
    });

    assert.equal(response.status, 401);
  });

  test('GET /session/:id/messages rejects non-owner API keys', async () => {
    const createResponse = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'council' })
    });

    assert.equal(createResponse.status, 201);
    const session = await createResponse.json() as { sessionId: string };
    ConversationStore.saveConversation(session.sessionId, [{ role: 'assistant', content: 'owned message' }]);

    const foreignResponse = await fetch(`http://localhost:${port}/session/${session.sessionId}/messages`, {
      headers: { 'Authorization': 'Bearer foreign-key' }
    });
    assert.equal(foreignResponse.status, 403);

    const ownerResponse = await fetch(`http://localhost:${port}/session/${session.sessionId}/messages`, {
      headers: { 'Authorization': 'Bearer owner-key' }
    });
    assert.equal(ownerResponse.status, 200);

    const body = await ownerResponse.json() as { messages: Array<{ content: string }> };
    assert.equal(body.messages[0]?.content, 'owned message');
  });

  test('POST /session/:id/event rejects non-owner API keys', async () => {
    const createResponse = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'council' })
    });

    assert.equal(createResponse.status, 201);
    const session = await createResponse.json() as { sessionId: string };

    const foreignResponse = await fetch(`http://localhost:${port}/session/${session.sessionId}/event`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer foreign-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ eventType: 'test_event', apiCalls: 1 })
    });

    assert.equal(foreignResponse.status, 403);
  });

  test('POST /dispatch requires session ownership', async () => {
    const createResponse = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'council' })
    });

    assert.equal(createResponse.status, 201);
    const session = await createResponse.json() as { sessionId: string };

    // Missing API key
    const noKeyResponse = await fetch(`http://localhost:${port}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.sessionId, messages: [] })
    });
    assert.equal(noKeyResponse.status, 401);

    // Foreign API key
    const foreignResponse = await fetch(`http://localhost:${port}/dispatch`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer foreign-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionId: session.sessionId, messages: [] })
    });
    assert.equal(foreignResponse.status, 403);
  });

  test('PATCH /session/:id/revert requires session ownership', async () => {
    const createResponse = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer owner-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'council' })
    });

    assert.equal(createResponse.status, 201);
    const session = await createResponse.json() as { sessionId: string };

    // Missing API key
    const noKeyResponse = await fetch(`http://localhost:${port}/session/${session.sessionId}/revert`, {
      method: 'PATCH'
    });
    assert.equal(noKeyResponse.status, 401);

    // Foreign API key
    const foreignResponse = await fetch(`http://localhost:${port}/session/${session.sessionId}/revert`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer foreign-key' }
    });
    assert.equal(foreignResponse.status, 403);

    // Owner API key
    const ownerResponse = await fetch(`http://localhost:${port}/session/${session.sessionId}/revert`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer owner-key' }
    });
    assert.equal(ownerResponse.status, 200);
  });

  test('GET /config requires an API key', async () => {
    const noKeyResponse = await fetch(`http://localhost:${port}/config`);
    assert.equal(noKeyResponse.status, 401);

    const withKeyResponse = await fetch(`http://localhost:${port}/config`, {
      headers: { 'Authorization': 'Bearer some-key' }
    });
    assert.equal(withKeyResponse.status, 200);
  });

  test('GET /quota requires an API key', async () => {
    const noKeyResponse = await fetch(`http://localhost:${port}/quota`);
    assert.equal(noKeyResponse.status, 401);

    const withKeyResponse = await fetch(`http://localhost:${port}/quota`, {
      headers: { 'Authorization': 'Bearer some-key' }
    });
    assert.equal(withKeyResponse.status, 200);
  });

  test('POST /config requires API key and validates default_mode', async () => {
    // Missing API key
    const noKeyResponse = await fetch(`http://localhost:${port}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_mode: 'solo' })
    });
    assert.equal(noKeyResponse.status, 401);

    // Invalid default_mode
    const invalidResponse = await fetch(`http://localhost:${port}/config`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer some-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ default_mode: 'invalid-mode' })
    });
    assert.equal(invalidResponse.status, 400);

    // Valid default_mode
    const validResponse = await fetch(`http://localhost:${port}/config`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer some-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ default_mode: 'solo' })
    });
    assert.equal(validResponse.status, 200);
  });
});
