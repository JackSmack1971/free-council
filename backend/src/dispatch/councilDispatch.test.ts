import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { dispatchCouncilChat } from './councilDispatch.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';

describe('councilDispatch Tests', () => {
  let originalFetch: typeof fetch;

  before(async () => {
    runMigrations();
    originalFetch = globalThis.fetch;

    // Temporary mock for model pool refresh
    globalThis.fetch = async (url) => {
      if (url === 'https://openrouter.ai/api/v1/models') {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'qwen/qwen3-coder:free', name: 'Qwen Coder', context_length: 32768, pricing: { prompt: '0.0', completion: '0.0' } },
              { id: 'google/gemini-2.5-flash:free', name: 'Gemini Flash', context_length: 32768, pricing: { prompt: '0.0', completion: '0.0' } },
              { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama Instruct', context_length: 32768, pricing: { prompt: '0.0', completion: '0.0' } },
              { id: 'openrouter/free', name: 'OpenRouter Free', context_length: 32768, pricing: { prompt: '0.0', completion: '0.0' } }
            ]
          })
        } as any;
      }
      throw new Error(`Unexpected fetch in before: ${url}`);
    };

    await ModelPoolManager.refresh();
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  test('Fast mode: should skip scoring and select first response without evaluation', async () => {
    const sessionId = 'test-council-fast-' + Date.now();

    globalThis.fetch = async (url, options: any) => {
      const body = JSON.parse(options.body);

      // Router call
      if (body.model === 'inclusionai/ring-2.6-1t:free' || body.model === 'openrouter/free') {
        return {
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  agents: [
                    { role: 'Coder', modelId: 'qwen/qwen3-coder:free' },
                    { role: 'Analyst', modelId: 'google/gemini-2.5-flash:free' }
                  ],
                  totalApiCalls: 3,
                  samplingRationale: 'Fast path test.'
                })
              }
            }]
          })
        } as any;
      }

      // Proposer agent calls
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

    let receivedData = '';
    let completed = false;

    await dispatchCouncilChat({
      sessionId,
      messages: [{ role: 'user', content: 'Write a small hello world program' }], // Complex / non-trivial to ensure GoA is used
      runSettings: { reasoningEffort: 'Fast' },
      apiKey: 'test-key',
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
    // Should contain response and trace event
    assert.ok(receivedData.includes('Response from qwen/qwen3-coder:free') || receivedData.includes('Response from google/gemini-2.5-flash:free'));
    assert.ok(receivedData.includes('"type":"trace"'));
    assert.ok(receivedData.includes('"samplingRationale":"Fast path test."'));
  });

  test('Balanced mode with simple prompt: should fallback to Solo Mode', async () => {
    const sessionId = 'test-council-simple-' + Date.now();
    let soloDispatchCalled = false;

    globalThis.fetch = async (url, options: any) => {
      soloDispatchCalled = true;
      return {
        ok: true,
        body: {
          getReader() {
            let i = 0;
            return {
              async read() {
                if (i === 0) {
                  i++;
                  return { value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Solo response"}}]}'), done: false };
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

    await dispatchCouncilChat({
      sessionId,
      messages: [{ role: 'user', content: 'hi' }], // Simple prompt
      runSettings: { reasoningEffort: 'Balanced' },
      apiKey: 'test-key',
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
    assert.ok(soloDispatchCalled);
    assert.ok(receivedData.includes('Solo response'));
  });
});
