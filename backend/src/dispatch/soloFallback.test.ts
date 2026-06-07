import { after, before, describe, test } from 'node:test';
import assert from 'node:assert';
import { runMigrations } from '../db/migrationRunner.js';
import { executeSoloFallback } from './soloFallback.js';

describe('soloFallback Tests', () => {
  let originalFetch: typeof fetch;
  let originalSetTimeout: typeof globalThis.setTimeout;

  before(() => {
    runMigrations();
    originalFetch = globalThis.fetch;
    originalSetTimeout = globalThis.setTimeout;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  });

  test('executeSoloFallback should use REQUEST_TIMEOUT_MS when configured', async () => {
    process.env.REQUEST_TIMEOUT_MS = '60000';
    let observedTimeout = -1;

    try {
      globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
        observedTimeout = Number(timeout);
        return originalSetTimeout(handler, 0, ...args);
      }) as typeof globalThis.setTimeout;

      globalThis.fetch = async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'fallback response'
                }
              }
            ]
          })
        } as Response;
      };

      const result = await executeSoloFallback('prompt', 'test-key', 'test-session-fallback-timeout', 'double_timeout');

      assert.strictEqual(observedTimeout, 60000);
      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.response, 'fallback response');
    } finally {
      delete process.env.REQUEST_TIMEOUT_MS;
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});
