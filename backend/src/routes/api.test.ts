import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { Server } from 'http';
import { apiRouter } from './api.js';
import { runMigrations } from '../db/migrationRunner.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { db } from '../db/connection.js';
import { hasSessionCache } from '../agents/AgentOrchestrator.js';

describe('API Integration Tests', () => {
  let server: Server;
  let port: number;
  let originalFetch: typeof fetch;

  before(async () => {
    // Setup migrations
    runMigrations();
    originalFetch = globalThis.fetch;

    // Populate snapshots cache in SQLite with at least one free model so validation succeeds
    const mockModelList = [{
      id: 'openai/gpt-oss-120b:free',
      name: 'GPT OSS 120B (free)',
      description: 'A free reasoning model',
      context_length: 128000,
      pricing: { prompt: '0.0', completion: '0.0' },
      supported_parameters: ['temperature', 'top_p']
    }];

    try {
      db.prepare(`
        INSERT INTO model_snapshots (snapshot_ts, models_json, card_summaries_json)
        VALUES (?, ?, ?)
        ON CONFLICT(snapshot_ts) DO UPDATE SET
          models_json = excluded.models_json,
          card_summaries_json = excluded.card_summaries_json
      `).run(
        1716038400000,
        JSON.stringify(mockModelList),
        JSON.stringify({})
      );
    } catch (e) {
      console.warn('Failed to insert test snapshot, might already exist:', e);
    }

    // Refresh pool to load snapshot
    await ModelPoolManager.refresh();

    // Start server
    const app = express();
    app.use(express.json());
    app.use(apiRouter);

    return new Promise<void>((resolve) => {
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

  test('POST /session should create session and validate modelId', async () => {
    // Invalid modelId
    const resInvalid = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({ modelId: 'non-existent-model', mode: 'solo' })
    });
    assert.strictEqual(resInvalid.status, 400);

    // Valid modelId
    const resValid = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({ modelId: 'openai/gpt-oss-120b:free', mode: 'solo' })
    });
    assert.strictEqual(resValid.status, 201);
    const body = await resValid.json() as any;
    assert.ok(body.sessionId);
    assert.strictEqual(body.modelId, 'openai/gpt-oss-120b:free');
    assert.strictEqual(body.mode, 'solo');
  });

  test('GET /models should return list and require API key', async () => {
    // Missing API key
    const resNoKey = await fetch(`http://localhost:${port}/models`);
    assert.strictEqual(resNoKey.status, 401);

    // With API key
    const resWithKey = await fetch(`http://localhost:${port}/models`, {
      headers: { 'Authorization': 'Bearer test-key' }
    });
    assert.strictEqual(resWithKey.status, 200);
    const body = await resWithKey.json() as any;
    assert.ok(Array.isArray(body.models));
    assert.ok(body.models.some((m: any) => m.modelId === 'openai/gpt-oss-120b:free'));
  });

  test('GET /quota should return consumption metrics', async () => {
    const res = await fetch(`http://localhost:${port}/quota`, {
      headers: { 'Authorization': 'Bearer test-key' }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(typeof body.usedToday === 'number');
    assert.strictEqual(body.dailyLimit, 200);
    assert.strictEqual(body.isEstimated, true);
  });

  test('POST /dispatch clears proposer cache after council completion', async () => {
    globalThis.fetch = async (url, options: any) => {
      if (typeof url === 'string' && url.startsWith('http://localhost:')) {
        return originalFetch(url, options);
      }

      const body = JSON.parse(options.body);

      if (body.model === 'openrouter/free' || body.model === 'inclusionai/ring-2.6-1t:free') {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  executionMode: 'goa_moa_hybrid',
                  totalApiCalls: 3,
                  samplingRationale: 'cache cleanup test',
                  moaConfig: {
                    layers: 1,
                    proposersPerLayer: 1,
                    aggregatorModelId: 'google/gemini-2.5-flash:free'
                  },
                  agents: [
                    { role: 'Coder', modelId: 'qwen/qwen3-coder:free' }
                  ]
                })
              }
            }]
          })
        } as any;
      }

      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `Response from ${body.model}`
            }
          }]
        })
      } as any;
    };

    const sessionRes = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({ mode: 'council' })
    });
    assert.strictEqual(sessionRes.status, 201);
    const sessionBody = await sessionRes.json() as any;

    const dispatchRes = await fetch(`http://localhost:${port}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({
        sessionId: sessionBody.sessionId,
        messages: [{ role: 'user', content: 'Write a small function that reverses a string in JavaScript.' }],
        settings: {
          systemMode: 'council',
          privacyDisclosureAcknowledged: true
        }
      })
    });

    assert.strictEqual(dispatchRes.status, 200);
    const streamBody = await dispatchRes.text();
    assert.ok(streamBody.includes('Response from qwen/qwen3-coder:free'));
    assert.strictEqual(hasSessionCache(sessionBody.sessionId), false);
  });

  test('POST /dispatch emits an SSE error frame after partial solo output', async () => {
    const firstChunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
    let upstreamCallCount = 0;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, options: any) => {
      if (typeof url === 'string' && url.startsWith('http://localhost:')) {
        return originalFetch(url, options);
      }

      upstreamCallCount++;

      if (upstreamCallCount === 1) {
        return {
          ok: true,
          body: {
            getReader() {
              let readCount = 0;
              return {
                async read() {
                  if (readCount === 0) {
                    readCount++;
                    return {
                      value: new TextEncoder().encode(firstChunk),
                      done: false
                    };
                  }

                  throw new Error('mid-stream failure');
                }
              };
            }
          }
        } as any;
      }

      throw new Error('fallback stream failure');
    };

    const sessionRes = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({ modelId: 'openai/gpt-oss-120b:free', mode: 'solo' })
    });
    assert.strictEqual(sessionRes.status, 201);
    const sessionBody = await sessionRes.json() as any;

    const dispatchRes = await fetch(`http://localhost:${port}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
      body: JSON.stringify({
        sessionId: sessionBody.sessionId,
        messages: [{ role: 'user', content: 'Tell me something short.' }],
        settings: {}
      })
    });

    assert.strictEqual(dispatchRes.status, 200);
    const streamBody = await dispatchRes.text();
    assert.ok(streamBody.includes('"content":"Hello"'), streamBody);
    assert.ok(streamBody.includes('"type":"error"'), streamBody);
    assert.ok(streamBody.includes('"message":"fallback stream failure"'), streamBody);
    assert.ok(streamBody.includes('"partial":true'), streamBody);

    globalThis.fetch = originalFetch;
  });
});
