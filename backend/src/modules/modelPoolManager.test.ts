import { afterEach, before, describe, test } from 'node:test';
import assert from 'node:assert';
import { db } from '../db/connection.js';
import { runMigrations } from '../db/migrationRunner.js';
import { MODEL_SNAPSHOT_TTL_MS, ModelPoolManager } from './modelPoolManager.js';

describe('ModelPoolManager', () => {
  const originalFetch = globalThis.fetch;

  before(() => {
    runMigrations();
    db.prepare('DELETE FROM model_snapshots').run();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('refresh preserves the current pool when network and cache both fail', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'meta-llama/llama-3.3-70b-instruct:free',
            name: 'Llama Instruct',
            context_length: 32768,
            pricing: { prompt: '0.0', completion: '0.0' }
          }
        ]
      })
    }) as any;

    await ModelPoolManager.refresh();

    const baselineIds = ModelPoolManager.getFreeModels().map(model => model.modelId);
    assert.deepStrictEqual(baselineIds, ['meta-llama/llama-3.3-70b-instruct:free']);

    db.prepare('DELETE FROM model_snapshots').run();
    globalThis.fetch = async () => {
      throw new Error('network down');
    };

    await ModelPoolManager.refresh();

    const afterFailureIds = ModelPoolManager.getFreeModels().map(model => model.modelId);
    assert.deepStrictEqual(afterFailureIds, baselineIds);
    assert.ok(ModelPoolManager.getLastSnapshotTs());
  });

  test('refresh swaps in the cached snapshot after a failed network refresh', async () => {
    const freshSnapshotTs = Date.now();
    const cachedModels = [
      {
        modelId: 'openrouter/free',
        is_free: true,
        is_provider_logged: false,
        supports_zdr: false,
        contextLength: 8192,
        coding: false,
        reasoning: false,
        vision: false,
        pdf_input: false,
        image_input: false,
        tool_calling: false,
        structured_output: false,
        long_context: false,
        supported_parameters: []
      }
    ];
    const cachedSummaries = [
      {
        modelId: 'openrouter/free',
        domain: ['general'],
        taskSpecialization: ['general chat'],
        contextLength: 8192,
        capabilityFlags: []
      }
    ];

    db.prepare('DELETE FROM model_snapshots').run();
    db.prepare('INSERT INTO model_snapshots (snapshot_ts, models_json, card_summaries_json) VALUES (?, ?, ?)')
      .run(freshSnapshotTs, JSON.stringify(cachedModels), JSON.stringify(cachedSummaries));

    globalThis.fetch = async () => {
      throw new Error('network down');
    };

    await ModelPoolManager.refresh();

    assert.deepStrictEqual(
      ModelPoolManager.getFreeModels().map(model => model.modelId),
      ['openrouter/free']
    );
    assert.strictEqual(ModelPoolManager.getLastSnapshotTs(), freshSnapshotTs);
  });

  test('refresh rejects stale cached snapshots after a failed network refresh', async () => {
    const staleSnapshotTs = Date.now() - MODEL_SNAPSHOT_TTL_MS - 1;

    db.prepare('DELETE FROM model_snapshots').run();
    db.prepare('INSERT INTO model_snapshots (snapshot_ts, models_json, card_summaries_json) VALUES (?, ?, ?)')
      .run(
        staleSnapshotTs,
        JSON.stringify([
          {
            modelId: 'stale/free-model',
            is_free: true,
            is_provider_logged: false,
            supports_zdr: false,
            contextLength: 8192,
            coding: false,
            reasoning: false,
            vision: false,
            pdf_input: false,
            image_input: false,
            tool_calling: false,
            structured_output: false,
            long_context: false,
            supported_parameters: []
          }
        ]),
        JSON.stringify([])
      );

    globalThis.fetch = async () => {
      throw new Error('network down');
    };

    await ModelPoolManager.refresh();

    assert.ok(
      !ModelPoolManager.getFreeModels().some(model => model.modelId === 'stale/free-model')
    );
  });
});
