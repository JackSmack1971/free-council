import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { Server } from 'http';
import { apiRouter } from './api.js';
import { runMigrations } from '../db/migrationRunner.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { db } from '../db/connection.js';

describe('API Integration Tests', () => {
  let server: Server;
  let port: number;

  before(async () => {
    // Setup migrations
    runMigrations();

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
    server.close();
  });

  test('POST /session should create session and validate modelId', async () => {
    // Invalid modelId
    const resInvalid = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId: 'non-existent-model', mode: 'solo' })
    });
    assert.strictEqual(resInvalid.status, 400);

    // Valid modelId
    const resValid = await fetch(`http://localhost:${port}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`http://localhost:${port}/quota`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as any;
    assert.ok(typeof body.usedToday === 'number');
    assert.strictEqual(body.dailyLimit, 200);
    assert.strictEqual(body.isEstimated, true);
  });
});
