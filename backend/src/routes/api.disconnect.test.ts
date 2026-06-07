import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';
import { once } from 'node:events';
import express from 'express';
import { Server } from 'http';
import { apiRouter } from './api.js';
import { runMigrations } from '../db/migrationRunner.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { db } from '../db/connection.js';

describe('api disconnect handling', () => {
  let server: Server;
  let port: number;
  let originalFetch: typeof fetch;

  before(async () => {
    runMigrations();
    originalFetch = globalThis.fetch;

    const mockModelList = [{
      id: 'openai/gpt-oss-120b:free',
      name: 'GPT OSS 120B (free)',
      description: 'A free reasoning model',
      context_length: 128000,
      pricing: { prompt: '0.0', completion: '0.0' },
      supported_parameters: ['temperature']
    }];

    db.prepare(`
      INSERT INTO model_snapshots (snapshot_ts, models_json, card_summaries_json)
      VALUES (?, ?, ?)
      ON CONFLICT(snapshot_ts) DO UPDATE SET
        models_json = excluded.models_json,
        card_summaries_json = excluded.card_summaries_json
    `).run(1716038400000, JSON.stringify(mockModelList), JSON.stringify({}));

    await ModelPoolManager.refresh();

    const app = express();
    app.use(express.json());
    app.use(apiRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  after(() => {
    globalThis.fetch = originalFetch;
    server.close();
  });

  test('aborts upstream solo work when the client disconnects', async () => {
    let upstreamSignal: AbortSignal | undefined;
    let aborted = false;

    globalThis.fetch = async (url, options: any) => {
      if (typeof url === 'string' && url.startsWith('http://localhost:')) {
        return originalFetch(url, options);
      }

      upstreamSignal = options.signal;

      return await new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          aborted = true;
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    };

    const sessionRes = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'council' })
    });
    assert.strictEqual(sessionRes.status, 201);
    const sessionBody = await sessionRes.json() as any;

    const clientController = new AbortController();
    const dispatchPromise = fetch(`http://localhost:${port}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({
        sessionId: sessionBody.sessionId,
        messages: [{ role: 'user', content: 'Keep streaming until I disconnect.' }],
        settings: {
          systemMode: 'council',
          privacyDisclosureAcknowledged: true
        }
      }),
      signal: clientController.signal
    });

    while (!upstreamSignal) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const abortPromise = once(upstreamSignal, 'abort');
    clientController.abort();
    await assert.rejects(dispatchPromise, /AbortError/);
    await abortPromise;

    assert.strictEqual(aborted, true);
    assert.strictEqual(upstreamSignal.aborted, true);
  });
});
