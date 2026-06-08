import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { RouterAgent } from './RouterAgent.js';
import { NormalizedModelCapabilities } from 'shared';

describe('RouterAgent GoA sampling tests', () => {
  const dummyModels: NormalizedModelCapabilities[] = [
    {
      modelId: 'qwen/qwen-2.5-72b-instruct:free',
      contextLength: 32000,
      pdf_input: false,
      image_input: false,
      tool_calling: true,
      structured_output: true,
      long_context: true,
      coding: true,
      reasoning: true,
      vision: false,
      is_free: true,
      is_provider_logged: false,
      supports_zdr: true,
      supported_parameters: ['temperature']
    },
    {
      modelId: 'meta-llama/llama-3.1-405b-instruct:free',
      contextLength: 128000,
      pdf_input: false,
      image_input: false,
      tool_calling: true,
      structured_output: true,
      long_context: true,
      coding: false,
      reasoning: true,
      vision: false,
      is_free: true,
      is_provider_logged: false,
      supports_zdr: true,
      supported_parameters: ['temperature']
    },
    {
      modelId: 'google/gemini-flash-1.5:free',
      contextLength: 1048576,
      pdf_input: true,
      image_input: true,
      tool_calling: true,
      structured_output: true,
      long_context: true,
      coding: false,
      reasoning: false,
      vision: true,
      is_free: true,
      is_provider_logged: false,
      supports_zdr: true,
      supported_parameters: ['temperature']
    },
    {
      modelId: 'paid-expensive-model',
      contextLength: 8000,
      pdf_input: false,
      image_input: false,
      tool_calling: false,
      structured_output: false,
      long_context: false,
      coding: true,
      reasoning: true,
      vision: false,
      is_free: false,
      is_provider_logged: false,
      supports_zdr: false,
      supported_parameters: []
    }
  ];

  let originalFetch: typeof fetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  test('should sample free models successfully on mock response', async () => {
    const mockJson = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              agents: [
                { role: 'Coder', modelId: 'qwen/qwen-2.5-72b-instruct:free', relevanceScore: 0.95 },
                { role: 'Analyst', modelId: 'meta-llama/llama-3.1-405b-instruct:free', relevanceScore: 0.90 }
              ],
              totalApiCalls: 3,
              samplingRationale: 'Selected Qwen for coding and Llama for logic.'
            })
          }
        }
      ]
    };

    globalThis.fetch = async (url: any, init: any) => {
      assert.strictEqual(url, 'https://openrouter.ai/api/v1/chat/completions');
      const body = JSON.parse(init.body);
      assert.ok(body.model);
      return {
        ok: true,
        json: async () => mockJson
      } as Response;
    };

    const plan = await RouterAgent.sampleAgents('write a fast web server in typescript', dummyModels, 3, 'dummy-key');

    assert.strictEqual(plan.executionMode, 'goa_moa_hybrid');
    assert.strictEqual(plan.totalApiCalls, 4);
    assert.strictEqual(plan.agents.length, 2);
    assert.strictEqual(plan.agents[0].role, 'Coder');
    assert.strictEqual(plan.agents[0].modelId, 'qwen/qwen-2.5-72b-instruct:free');
    assert.strictEqual(plan.agents[1].role, 'Analyst');
    assert.strictEqual(plan.agents[1].modelId, 'meta-llama/llama-3.1-405b-instruct:free');
  });

  test('should filter out non-free models from router response', async () => {
    const mockJson = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              agents: [
                { role: 'Coder', modelId: 'paid-expensive-model', relevanceScore: 0.99 },
                { role: 'Analyst', modelId: 'meta-llama/llama-3.1-405b-instruct:free', relevanceScore: 0.90 }
              ],
              totalApiCalls: 3,
              samplingRationale: 'Selected paid-expensive-model and Llama.'
            })
          }
        }
      ]
    };

    globalThis.fetch = async (url: any, init: any) => {
      return {
        ok: true,
        json: async () => mockJson
      } as Response;
    };

    const plan = await RouterAgent.sampleAgents('write a fast web server in typescript', dummyModels, 3, 'dummy-key');

    assert.strictEqual(plan.agents.length, 1);
    assert.strictEqual(plan.agents[0].role, 'Analyst');
    assert.strictEqual(plan.agents[0].modelId, 'meta-llama/llama-3.1-405b-instruct:free');
  });

  test('should fallback to default free models if JSON parsing fails', async () => {
    globalThis.fetch = async (url: any, init: any) => {
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Invalid JSON response from model'
              }
            }
          ]
        })
      } as Response;
    };

    const plan = await RouterAgent.sampleAgents('some query', dummyModels, 3, 'dummy-key');

    assert.ok(plan.agents.length > 0);
    assert.strictEqual(plan.executionMode, 'goa_moa_hybrid');
    for (const agent of plan.agents) {
      const match = dummyModels.find(m => m.modelId === agent.modelId);
      assert.ok(match);
      assert.strictEqual(match.is_free, true);
    }
  });

  test('should abort hung router calls after timeout and fallback safely', async () => {
    const originalTimeout = AbortSignal.timeout;
    AbortSignal.timeout = () => {
      const controller = new AbortController();
      controller.abort(new DOMException('The operation was aborted.', 'AbortError'));
      return controller.signal;
    };

    globalThis.fetch = async (_url: any, init: any) => {
      return await new Promise((_resolve, reject) => {
        if (init.signal?.aborted) {
          return reject(new DOMException('The operation was aborted.', 'AbortError'));
        }
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        }, { once: true });
      });
    };

    try {
      const startedAt = Date.now();
      const plan = await RouterAgent.sampleAgents(
        'some query',
        dummyModels,
        3,
        'dummy-key',
        false,
        'Balanced',
        'non_trivial',
        true,
        false,
        10
      );
      const elapsedMs = Date.now() - startedAt;

      assert.ok(elapsedMs < 500, `Expected timeout fallback quickly, elapsed=${elapsedMs}ms`);
      assert.ok(plan.agents.length > 0);
      assert.strictEqual(plan.executionMode, 'goa_moa_hybrid');
    } finally {
      AbortSignal.timeout = originalTimeout;
    }
  });
});
