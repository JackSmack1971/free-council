import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { AgentOrchestrator } from './AgentOrchestrator.js';
import { AgentPlan, AgentResult } from 'shared';
import { db } from '../db/connection.js';
import { runMigrations } from '../db/migrationRunner.js';

describe('AgentOrchestrator tests', () => {
  let originalFetch: typeof fetch;

  before(() => {
    runMigrations();
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  test('GoA-lite success flow: parallel initial responses, edge scoring, and selection', async () => {
    const plan: AgentPlan = {
      executionMode: 'goa_lite',
      totalApiCalls: 6,
      samplingRationale: 'Test plan',
      agents: [
        { role: 'Coder', modelId: 'qwen/qwen3-coder:free' },
        { role: 'Analyst', modelId: 'meta-llama/llama-3.3-70b-instruct:free' },
        { role: 'General', modelId: 'openrouter/free' }
      ]
    };

    const sessionId = 'test-session-goa-lite-' + Date.now();
    const prompt = 'Solve 2+2';

    // Mock fetches for initial responses and scoring responses
    let fetchCount = 0;
    globalThis.fetch = async (url: any, init: any) => {
      fetchCount++;
      const body = JSON.parse(init.body);
      
      // Determine if this is an initial response or a scoring response
      if (body.messages[0].content === prompt) {
        // Initial completion
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: `Response from ${body.model}`
                }
              }
            ]
          })
        } as Response;
      } else {
        // Scoring completion
        // The scoring prompt contains: Provide a score between 0.0 and 1.0 for each of the other agents.
        // We will return different scores based on which model is scoring.
        let scores: Record<string, number> = {};
        if (body.model === 'qwen/qwen3-coder:free') {
          // Scores Analyst and General
          scores = { Analyst: 0.8, General: 0.2 };
        } else if (body.model === 'meta-llama/llama-3.3-70b-instruct:free') {
          // Scores Coder and General
          scores = { Coder: 0.9, General: 0.1 };
        } else {
          // Scores Coder and Analyst
          scores = { Coder: 0.7, Analyst: 0.3 };
        }

        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({ scores })
                }
              }
            ]
          })
        } as Response;
      }
    };

    const generator = AgentOrchestrator.executeGoALite(plan, prompt, 'dummy-key', sessionId);
    const results: AgentResult[] = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    // Expecting:
    // 3 initial status: generating
    // 3 completions
    // 3 status: evaluating
    // 3 final scored agent results
    const completions = results.filter(r => r.status === 'completed');
    // Initially we streamed 3 completed results, then at the end we yielded the 3 scored ones.
    assert.strictEqual(completions.length, 6);

    const scoredResults = results.slice(-3);
    assert.strictEqual(scoredResults.length, 3);

    // Verify S-scores and primary selection
    // Let's compute manually:
    // Scorer Coder (i=0): Analyst = 0.8, General = 0.2 => edgeMatrix[0][1] = 0.8, edgeMatrix[0][2] = 0.2
    // Scorer Analyst (i=1): Coder = 0.9, General = 0.1 => edgeMatrix[1][0] = 0.9, edgeMatrix[1][2] = 0.1
    // Scorer General (i=2): Coder = 0.7, Analyst = 0.3 => edgeMatrix[2][0] = 0.7, edgeMatrix[2][1] = 0.3
    // S_j sums:
    // Coder (j=0) = edgeMatrix[1][0] + edgeMatrix[2][0] = 0.9 + 0.7 = 1.6
    // Analyst (j=1) = edgeMatrix[0][1] + edgeMatrix[2][1] = 0.8 + 0.3 = 1.1
    // General (j=2) = edgeMatrix[0][2] + edgeMatrix[1][2] = 0.2 + 0.1 = 0.3
    // Total sum of S_j = 1.6 + 1.1 + 0.3 = 3.0
    // Normalized S_j:
    // Coder = 1.6 / 3.0 = 0.533
    // Analyst = 1.1 / 3.0 = 0.366
    // General = 0.3 / 3.0 = 0.100
    // Max is Coder, so Coder must be primary.
    const coder = scoredResults.find(r => r.role === 'Coder');
    const analyst = scoredResults.find(r => r.role === 'Analyst');
    const general = scoredResults.find(r => r.role === 'General');

    assert.ok(coder);
    assert.ok(analyst);
    assert.ok(general);

    assert.strictEqual(coder.isPrimary, true);
    assert.strictEqual(analyst.isPrimary, false);
    assert.strictEqual(general.isPrimary, false);

    assert.ok(Math.abs((coder.sScore || 0) - 0.533) < 0.01);
    assert.ok(Math.abs((analyst.sScore || 0) - 0.366) < 0.01);
    assert.ok(Math.abs((general.sScore || 0) - 0.100) < 0.01);

    // Verify database record
    const row = db.prepare('SELECT * FROM session_events WHERE session_id = ? AND event_type = ?').get(sessionId, 'routed_to_council') as any;
    assert.ok(row);
    assert.ok(row.edge_matrix_json);
    const serialized = JSON.parse(row.edge_matrix_json);
    assert.deepStrictEqual(serialized.roles, ['Coder', 'Analyst', 'General']);
    assert.ok(serialized.matrix);
    assert.strictEqual(serialized.matrix[0][1], 0.8);
  });

  test('Fast mode skips scoring and selects first returned response', async () => {
    const plan: AgentPlan = {
      executionMode: 'goa_lite',
      reasoningEffort: 'Fast',
      totalApiCalls: 3,
      samplingRationale: 'Fast Mode Test',
      agents: [
        { role: 'Coder', modelId: 'qwen/qwen3-coder:free' },
        { role: 'Analyst', modelId: 'meta-llama/llama-3.3-70b-instruct:free' }
      ]
    };

    const sessionId = 'test-session-fast-' + Date.now();
    const prompt = 'Quick math';

    globalThis.fetch = async (url: any, init: any) => {
      const body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `Response from ${body.model}`
              }
            }
          ]
        })
      } as Response;
    };

    const generator = AgentOrchestrator.executeGoALite(plan, prompt, 'dummy-key', sessionId);
    const results: AgentResult[] = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    // Expecting 2 completed proposer responses, plus the chosen primary response
    const primary = results.find(r => r.isPrimary === true);
    assert.ok(primary);
    assert.strictEqual(primary.role, 'Coder');

    // Verify DB entry
    const row = db.prepare('SELECT * FROM session_events WHERE session_id = ? AND event_type = ?').get(sessionId, 'routed_to_council') as any;
    assert.ok(row);
    const serialized = JSON.parse(row.edge_matrix_json);
    assert.strictEqual(serialized.note, 'scoring was skipped');
  });

  test('Cap truncation cuts off agents after first 5', async () => {
    const plan: AgentPlan = {
      executionMode: 'goa_lite',
      reasoningEffort: 'Fast',
      totalApiCalls: 6,
      samplingRationale: 'Cap test',
      agents: [
        { role: 'A1', modelId: 'm1' },
        { role: 'A2', modelId: 'm2' },
        { role: 'A3', modelId: 'm3' },
        { role: 'A4', modelId: 'm4' },
        { role: 'A5', modelId: 'm5' },
        { role: 'A6', modelId: 'm6' }
      ]
    };

    const sessionId = 'test-session-cap-' + Date.now();
    const prompt = 'Cap test';
    const calledModels: string[] = [];

    globalThis.fetch = async (url: any, init: any) => {
      const body = JSON.parse(init.body);
      calledModels.push(body.model);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `Response from ${body.model}`
              }
            }
          ]
        })
      } as Response;
    };

    const generator = AgentOrchestrator.executeGoALite(plan, prompt, 'dummy-key', sessionId);
    for await (const _ of generator) {
      // Consume all
    }

    assert.strictEqual(calledModels.length, 5);
    assert.ok(!calledModels.includes('m6'));
  });

  test('Double timeout falls back to Solo Mode', async () => {
    const plan: AgentPlan = {
      executionMode: 'goa_lite',
      totalApiCalls: 3,
      samplingRationale: 'Timeout fallback test',
      agents: [
        { role: 'Coder', modelId: 'qwen/qwen3-coder:free' }
      ]
    };

    const sessionId = 'test-session-timeout-' + Date.now();
    const prompt = 'Fallback test';

    let fetchCount = 0;
    globalThis.fetch = async (url: any, init: any) => {
      fetchCount++;
      const body = JSON.parse(init.body);
      if (body.model === 'qwen/qwen3-coder:free') {
        // Force timeout abort
        throw new DOMException('The user aborted a request.', 'AbortError');
      } else {
        // Solo fallback model succeeds
        assert.strictEqual(body.model, 'meta-llama/llama-3.3-70b-instruct:free');
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'Solo fallback output'
                }
              }
            ]
          })
        } as Response;
      }
    };

    const generator = AgentOrchestrator.executeGoALite(plan, prompt, 'dummy-key', sessionId);
    const results: AgentResult[] = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    const primary = results.find(r => r.isPrimary === true);
    assert.ok(primary);
    assert.strictEqual(primary.role, 'SoloFallback');
    assert.strictEqual(primary.modelId, 'meta-llama/llama-3.3-70b-instruct:free');
    assert.strictEqual(primary.response, 'Solo fallback output');

    // Verify DB records the shared solo fallback event
    const row = db.prepare('SELECT * FROM session_events WHERE session_id = ? AND event_type = ?').get(sessionId, 'routed_to_solo') as any;
    assert.ok(row);
    assert.strictEqual(row.synthesis_rationale, 'double_timeout');
  });

  test('Proposer caching: uses SHA-256 and returns fromCache correctly', async () => {
    const plan: AgentPlan = {
      executionMode: 'goa_moa_hybrid',
      totalApiCalls: 4,
      samplingRationale: 'Caching test',
      agents: [
        { role: 'Proposer1', modelId: 'model-a' },
        { role: 'Proposer2', modelId: 'model-a' }
      ]
    };

    const sessionId = 'test-session-cache-' + Date.now();
    const prompt = 'Hello cache world';

    let fetchCount = 0;
    globalThis.fetch = async (url: any, init: any) => {
      fetchCount++;
      const body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `Response for ${body.model} on prompt: ${body.messages[0].content}`
              }
            }
          ]
        })
      } as Response;
    };

    // First call: should be cache miss
    const generator1 = AgentOrchestrator.executeGoAMoAHybrid(plan, prompt, 'dummy-key', sessionId);
    const results1: AgentResult[] = [];
    for await (const chunk of generator1) {
      results1.push(chunk);
    }

    const completed1 = results1.filter(r => r.role.startsWith('Proposer') && r.status === 'completed');
    assert.strictEqual(completed1.length, 2);
    assert.strictEqual(completed1[0].fromCache, false);
    assert.strictEqual(completed1[1].fromCache, false);
    assert.strictEqual(fetchCount, 3); // 2 proposers + 1 aggregator

    // Second call: should be cache hit
    const generator2 = AgentOrchestrator.executeGoAMoAHybrid(plan, prompt, 'dummy-key', sessionId);
    const results2: AgentResult[] = [];
    for await (const chunk of generator2) {
      results2.push(chunk);
    }
    const completed2 = results2.filter(r => r.role.startsWith('Proposer') && r.status === 'completed');
    assert.strictEqual(completed2.length, 2);
    assert.strictEqual(completed2[0].fromCache, true);
    assert.strictEqual(completed2[1].fromCache, true);
    assert.strictEqual(fetchCount, 4); // 0 proposer + 1 aggregator

    // Third call: different prompt, should be cache miss
    const prompt2 = 'Hello cache world 2';
    const generator3 = AgentOrchestrator.executeGoAMoAHybrid(plan, prompt2, 'dummy-key', sessionId);
    const results3: AgentResult[] = [];
    for await (const chunk of generator3) {
      results3.push(chunk);
    }
    const completed3 = results3.filter(r => r.role.startsWith('Proposer') && r.status === 'completed');
    assert.strictEqual(completed3.length, 2);
    assert.strictEqual(completed3[0].fromCache, false);
    assert.strictEqual(completed3[1].fromCache, false);
    assert.strictEqual(fetchCount, 7); // 2 proposers + 1 aggregator
  });
});
