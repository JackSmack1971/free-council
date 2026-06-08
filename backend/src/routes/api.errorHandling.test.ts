import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import express from 'express';

import { db } from '../db/connection.js';
import {
  apiRouter,
  GENERIC_CONFIG_READ_ERROR,
  GENERIC_CONFIG_UPDATE_ERROR,
  GENERIC_REQUEST_ERROR,
  reportDispatchError,
  sanitizeErrorForLogging
} from './api.js';

describe('api error handling', () => {
  const originalPrepare = db.prepare.bind(db);

  afterEach(() => {
    db.prepare = originalPrepare as typeof db.prepare;
  });

  test('reportDispatchError emits a generic SSE error frame', () => {
    const writes: string[] = [];
    const originalConsoleError = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };

    try {
      reportDispatchError(
        { write(chunk: string) { writes.push(chunk); } } as unknown as express.Response,
        'solo',
        new Error('upstream token leak'),
        true
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(logged.length, 1);
    assert.ok(String(logged[0][0]).includes('[dispatch:solo]'));
    assert.equal(
      writes[0],
      `data: ${JSON.stringify({ type: 'error', message: GENERIC_REQUEST_ERROR, partial: true })}\n\n`
    );
    assert.ok(!writes[0].includes('upstream token leak'));
  });

  test('GET /config hides internal exception details in 500 responses', async () => {
    db.prepare = (() => {
      throw new Error('SQLITE_BUSY: config table locked');
    }) as typeof db.prepare;

    const app = express();
    app.use(apiRouter);
    const server = app.listen(0);

    try {
      const addr = server.address();
      if (!addr || typeof addr !== 'object') {
        throw new Error('Expected server address');
      }

      const response = await fetch(`http://localhost:${addr.port}/config`, {
        headers: { 'Authorization': 'Bearer test-key' }
      });
      assert.equal(response.status, 500);
      const body = await response.json() as { error: string };
      assert.equal(body.error, GENERIC_CONFIG_READ_ERROR);
      assert.ok(!body.error.includes('SQLITE_BUSY'));
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  test('POST /config hides internal exception details in 500 responses', async () => {
    db.prepare = (() => {
      throw new Error('SQLITE_CONSTRAINT: app_config write failed');
    }) as typeof db.prepare;

    const app = express();
    app.use(express.json());
    app.use(apiRouter);
    const server = app.listen(0);

    try {
      const addr = server.address();
      if (!addr || typeof addr !== 'object') {
        throw new Error('Expected server address');
      }

      const response = await fetch(`http://localhost:${addr.port}/config`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ default_mode: 'solo' })
      });

      assert.equal(response.status, 500);
      const body = await response.json() as { error: string };
      assert.equal(body.error, GENERIC_CONFIG_UPDATE_ERROR);
      assert.ok(!body.error.includes('SQLITE_CONSTRAINT'));
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  test('sanitizeErrorForLogging redacts Bearer tokens and sk- keys in reportDispatchError', () => {
    const originalConsoleError = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };

    try {
      const complexError = new Error('Failed: Bearer sk-or-v1-abc123xyz. Another key: sk-secret456.');
      reportDispatchError(
        { write() {} } as unknown as express.Response,
        'solo',
        complexError,
        true
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(logged.length, 1);
    const loggedString = String(logged[0][1]);
    assert.ok(!loggedString.includes('sk-or-v1-abc123xyz'));
    assert.ok(!loggedString.includes('sk-secret456'));
    assert.ok(loggedString.includes('Bearer [REDACTED]'));
    assert.ok(loggedString.includes('sk-[REDACTED]'));
  });

  test('sanitizeErrorForLogging directly redacts sensitive keys', () => {
    const input = 'Error: API key sk-1234567890abcdef is invalid. Bearer sk-999abc.';
    const output = sanitizeErrorForLogging(new Error(input));
    assert.ok(!output.includes('sk-1234567890abcdef'));
    assert.ok(!output.includes('sk-999abc'));
    assert.ok(output.includes('sk-[REDACTED]'));
    assert.ok(output.includes('Bearer [REDACTED]'));
  });
});
