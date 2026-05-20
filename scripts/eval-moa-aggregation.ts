#!/usr/bin/env npx ts-node
/**
 * MoA Aggregation Quality Eval Runner
 *
 * Usage: npx ts-node scripts/eval-moa-aggregation.ts [--api-key=<key>]
 * Results: tests/eval/moa-aggregation/results-{timestamp}.json
 * Pass threshold: >= 90% synthesis quality (>= 13/15 cases)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JUDGE_MODEL = 'openrouter/owl-alpha';
const AGGREGATOR_MODEL = 'openrouter/owl-alpha';
const PASS_THRESHOLD = 0.9;

interface TestCase {
  id: string;
  subset: 'n3_proposers' | 'n4_proposers' | 'conflicting_facts';
  description: string;
  userQuery: string;
  proposers: Array<{ role: string; modelId: string; response: string }>;
  expectedSynthesisQuality: 'pass' | 'fail';
  rubric: string;
}

interface EvalResult {
  id: string;
  subset: string;
  judgeVerdict: 'pass' | 'fail';
  synthesizedResponse: string;
  judgeRationale: string;
  durationMs: number;
}

async function callOpenRouter(model: string, prompt: string, apiKey: string, temperature = 0.0): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'FreeCouncil-Eval'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter HTTP ${response.status}: ${text}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

async function synthesize(testCase: TestCase, aggregatorPromptTemplate: string, apiKey: string): Promise<string> {
  const numberedList = testCase.proposers
    .map((p, i) => `${i + 1}. ${p.role} (${p.modelId}):\n${p.response}`)
    .join('\n\n');

  const prompt = aggregatorPromptTemplate
    .replace('{numbered_list_with_role_model}', numberedList)
    .replace('{original_prompt}', testCase.userQuery)
    .replace('{attachments_context_if_any}', '');

  return callOpenRouter(AGGREGATOR_MODEL, prompt, apiKey, 0.3);
}

async function judgeResponse(testCase: TestCase, synthesis: string, apiKey: string): Promise<{ verdict: 'pass' | 'fail'; rationale: string }> {
  const judgePrompt = `You are evaluating a synthesized response from a multi-agent AI system.

Original user query:
${testCase.userQuery}

Individual proposer responses:
${testCase.proposers.map((p, i) => `${i + 1}. ${p.role}:\n${p.response}`).join('\n\n')}

Synthesized response:
${synthesis}

Evaluation rubric (ALL criteria must be met for PASS):
${testCase.rubric}

Evaluate whether the synthesized response meets ALL rubric criteria.
Output exactly one line in this format:
VERDICT: PASS
or
VERDICT: FAIL
RATIONALE: <one sentence explaining why>`;

  const judgeOutput = await callOpenRouter(JUDGE_MODEL, judgePrompt, apiKey, 0.0);
  const verdictMatch = judgeOutput.match(/VERDICT:\s*(PASS|FAIL)/i);
  const rationaleMatch = judgeOutput.match(/RATIONALE:\s*(.+)/i);

  const verdict = (verdictMatch?.[1]?.toLowerCase() === 'pass') ? 'pass' : 'fail';
  const rationale = rationaleMatch?.[1]?.trim() || judgeOutput.slice(0, 200);

  return { verdict, rationale };
}

async function main() {
  const args = process.argv.slice(2);
  const apiKeyArg = args.find(a => a.startsWith('--api-key='));
  const apiKey = apiKeyArg ? apiKeyArg.slice('--api-key='.length) : process.env.OPENROUTER_API_KEY || '';

  if (!apiKey) {
    console.error('Error: API key required. Use --api-key=<key> or set OPENROUTER_API_KEY env var.');
    process.exit(1);
  }

  const testCasesPath = path.resolve(__dirname, '../tests/eval/moa-aggregation/test-cases.json');
  const testCases: TestCase[] = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));

  const promptPath = path.resolve(__dirname, '../backend/src/agents/moa/agg_prompt.v1.txt');
  const aggregatorPromptTemplate = fs.readFileSync(promptPath, 'utf-8');

  console.log(`\nMoA Aggregation Eval — ${testCases.length} test cases`);
  console.log(`Pass threshold: ${PASS_THRESHOLD * 100}% (${Math.ceil(testCases.length * PASS_THRESHOLD)}/${testCases.length} cases)\n`);

  const results: EvalResult[] = [];
  let passCount = 0;

  for (const tc of testCases) {
    const start = Date.now();
    process.stdout.write(`[${tc.id}] ${tc.description.slice(0, 60)}... `);

    try {
      const synthesis = await synthesize(tc, aggregatorPromptTemplate, apiKey);
      const { verdict, rationale } = await judgeResponse(tc, synthesis, apiKey);
      const durationMs = Date.now() - start;

      if (verdict === 'pass') passCount++;

      results.push({
        id: tc.id,
        subset: tc.subset,
        judgeVerdict: verdict,
        synthesizedResponse: synthesis.slice(0, 500),
        judgeRationale: rationale,
        durationMs
      });

      console.log(`${verdict.toUpperCase()} (${durationMs}ms)`);
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
      results.push({
        id: tc.id,
        subset: tc.subset,
        judgeVerdict: 'fail',
        synthesizedResponse: '',
        judgeRationale: `Eval error: ${err.message}`,
        durationMs: Date.now() - start
      });
    }
  }

  const passRate = passCount / testCases.length;
  const evalPassed = passRate >= PASS_THRESHOLD;

  // Subset breakdown
  const subsets = ['n3_proposers', 'n4_proposers', 'conflicting_facts'];
  const subsetStats = subsets.map(subset => {
    const cases = results.filter(r => r.subset === subset);
    const passed = cases.filter(r => r.judgeVerdict === 'pass').length;
    return { subset, passed, total: cases.length };
  });

  console.log('\n=== RESULTS ===');
  for (const s of subsetStats) {
    console.log(`  ${s.subset}: ${s.passed}/${s.total}`);
  }
  console.log(`\nOverall: ${passCount}/${testCases.length} (${(passRate * 100).toFixed(1)}%)`);
  console.log(`Phase 5 gate: ${evalPassed ? 'PASSED ✓' : 'FAILED ✗'}`);

  // Write results file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = path.resolve(__dirname, `../tests/eval/moa-aggregation/results-${timestamp}.json`);
  const report = {
    timestamp: new Date().toISOString(),
    promptVersion: 'v1',
    aggregatorModel: AGGREGATOR_MODEL,
    judgeModel: JUDGE_MODEL,
    passThreshold: PASS_THRESHOLD,
    totalCases: testCases.length,
    passCount,
    passRate,
    evalPassed,
    subsetStats,
    results
  };
  fs.writeFileSync(resultsPath, JSON.stringify(report, null, 2));
  console.log(`\nResults written to: ${resultsPath}`);

  process.exit(evalPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
