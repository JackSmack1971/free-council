import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { dispatchSoloChat, limitContext } from './soloDispatch.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';

describe('soloDispatch Tests', () => {
  let originalFetch: typeof fetch;

  before(() => {
    runMigrations();
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  test('limitContext should keep system message and prune oldest messages', () => {
    const messages = [
      { role: 'system', content: 'System instruction' },
      { role: 'user', content: 'Very long content 1...' },
      { role: 'assistant', content: 'Response 1' },
      { role: 'user', content: 'Most recent user message' }
    ];

    // Limit context to ~30 tokens (120 characters)
    const trimmed = limitContext(messages, 30);
    assert.strictEqual(trimmed[0].role, 'system');
    assert.strictEqual(trimmed[trimmed.length - 1].content, 'Most recent user message');
    assert.ok(trimmed.length < messages.length);
  });

  test('dispatchSoloChat should block on API key missing', async () => {
    let errorCalled = false;
    await dispatchSoloChat({
      sessionId: 'test-session-apikey',
      modelId: 'openai/gpt-oss-120b:free',
      messages: [{ role: 'user', content: 'Hello' }],
      runSettings: {},
      apiKey: '',
      freeLockEnabled: true,
      onChunk: () => {},
      onError: (err) => {
        errorCalled = true;
        assert.ok(err.message.includes('API_KEY_MISSING'));
      },
      onComplete: () => {}
    });

    assert.ok(errorCalled);
  });

  test('dispatchSoloChat should stream chunks and log telemetry', async () => {
    const sessionId = 'test-session-stream-' + Date.now();
    const mockChunks = ['data: {"choices":[{"delta":{"content":"Hello"}}]}', 'data: [DONE]'];

    // Mock global fetch
    globalThis.fetch = async (url, options) => {
      return {
        ok: true,
        body: {
          getReader() {
            let i = 0;
            return {
              async read() {
                if (i < mockChunks.length) {
                  const val = new TextEncoder().encode(mockChunks[i++]);
                  return { value: val, done: false };
                }
                return { value: undefined, done: true };
              }
            };
          }
        }
      } as any;
    };

    let receivedData = '';
    let completed = false;

    await dispatchSoloChat({
      sessionId,
      modelId: 'openai/gpt-oss-120b:free',
      messages: [{ role: 'user', content: 'Hello' }],
      runSettings: {},
      apiKey: 'test-key',
      freeLockEnabled: true,
      onChunk: (chunk) => {
        receivedData += chunk;
      },
      onError: (err) => {
        assert.fail('Should not error: ' + err.message);
      },
      onComplete: () => {
        completed = true;
      }
    });

    assert.ok(completed);
    assert.ok(receivedData.includes('Hello'));

    // Check telemetry
    const stmt = db.prepare('SELECT * FROM session_events WHERE session_id = ? AND event_type = ?');
    const row = stmt.get(sessionId, 'routed_to_solo') as any;
    assert.ok(row);
    assert.strictEqual(row.api_calls, 1);
  });

  test('dispatchSoloChat should fallback on network error', async () => {
    const sessionId = 'test-session-fallback-' + Date.now();
    let attemptCount = 0;

    globalThis.fetch = async (url, options) => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('Network timeout simulation');
      }
      // Second attempt mock response
      return {
        ok: true,
        body: {
          getReader() {
            let i = 0;
            return {
              async read() {
                return { value: undefined, done: true };
              }
            };
          }
        }
      } as any;
    };

    let completed = false;

    await dispatchSoloChat({
      sessionId,
      modelId: 'openai/gpt-oss-120b:free',
      messages: [{ role: 'user', content: 'Hello' }],
      runSettings: {},
      apiKey: 'test-key',
      freeLockEnabled: true,
      onChunk: () => {},
      onError: (err) => {
        assert.fail('Should fallback successfully and complete');
      },
      onComplete: () => {
        completed = true;
      }
    });

    assert.strictEqual(attemptCount, 2);
    assert.ok(completed);
  });

  test('dispatchSoloChat should use FRONTEND_URL for OpenRouter referer', async () => {
    const sessionId = 'test-session-referer-' + Date.now();
    process.env.FRONTEND_URL = 'https://example.com';

    try {
      globalThis.fetch = async (url, options) => {
        assert.strictEqual(
          (options?.headers as Record<string, string>)['HTTP-Referer'],
          'https://example.com'
        );
        return {
          ok: true,
          body: {
            getReader() {
              return {
                async read() {
                  return { value: undefined, done: true };
                }
              };
            }
          }
        } as any;
      };

      await dispatchSoloChat({
        sessionId,
        modelId: 'openrouter/free',
        messages: [{ role: 'user', content: 'Hello' }],
        runSettings: {},
        apiKey: 'test-key',
        freeLockEnabled: true,
        onChunk: () => {},
        onError: (err) => {
          assert.fail('Should not error: ' + err.message);
        },
        onComplete: () => {}
      });
    } finally {
      delete process.env.FRONTEND_URL;
    }
  });
});
