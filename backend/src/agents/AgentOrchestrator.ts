import { AgentPlan, AgentResult, AgentAssignment } from 'shared';
import { TelemetryEngine } from '../modules/telemetryEngine.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';

async function fetchWithRateLimitBackoff(
  url: string,
  options: RequestInit,
  apiKey: string,
  sessionId: string | undefined,
  maxRetries: number = 2
): Promise<Response> {
  let retryCount = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (response.status !== 429 || retryCount >= maxRetries) {
      return response;
    }
    retryCount++;
    if (sessionId) {
      TelemetryEngine.record({
        session_id: sessionId,
        event_type: 'retry',
        synthesis_rationale: `429_rate_limit attempt ${retryCount}`,
        ts: Date.now()
      });
    }
    const retryAfter = response.headers.get('Retry-After');
    const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retryCount) * 1000;
    console.log(`[AgentOrchestrator] 429 rate limit. Waiting ${waitMs}ms (retry ${retryCount}/${maxRetries})`);
    await new Promise(r => setTimeout(r, waitMs));
  }
}

async function callAgentWithTimeoutAndRetry(
  agent: AgentAssignment,
  prompt: string,
  apiKey: string,
  temperature: number = 0.7,
  sessionId?: string
): Promise<{ text: string; usedFallback: boolean; failureReason?: string }> {
  let attempts = 0;
  const maxAttempts = 2; // 1 initial + 1 fallback retry
  let firstFailureReason: string | undefined;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const response = await fetchWithRateLimitBackoff(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'FreeCouncil'
          },
          body: JSON.stringify({
            model: agent.modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature
          })
        },
        apiKey,
        sessionId
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json() as any;
      const text = json.choices?.[0]?.message?.content;
      if (text === undefined || text === null) {
        throw new Error('Empty response from model');
      }

      const usedFallback = attempts > 1;
      if (usedFallback && sessionId) {
        TelemetryEngine.record({
          session_id: sessionId,
          event_type: 'retry',
          api_calls: 1,
          ts: Date.now()
        });
      }
      return { text, usedFallback, failureReason: usedFallback ? firstFailureReason : undefined };
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError';
      if (attempts === 1) {
        firstFailureReason = isTimeout ? 'timeout' : `HTTP error: ${err.message}`;
      }
      console.warn(`[AgentOrchestrator] Call to ${agent.role} (${agent.modelId}) failed (attempt ${attempts}): ${isTimeout ? 'timeout' : err.message}`);

      if (attempts >= maxAttempts) {
        if (isTimeout) {
          throw new Error('DOUBLE_TIMEOUT');
        }
        throw err;
      }
    }
  }
  throw new Error('Max attempts reached');
}

async function runSoloFallback(prompt: string, apiKey: string, sessionId: string): Promise<AgentResult> {
  TelemetryEngine.record({
    session_id: sessionId,
    event_type: 'solo_fallback',
    api_calls: 1,
    ts: Date.now()
  });

  const defaultModel = 'meta-llama/llama-3.3-70b-instruct:free';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'FreeCouncil'
      },
      body: JSON.stringify({
        model: defaultModel,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Solo fallback HTTP ${response.status}`);
    }

    const json = await response.json() as any;
    const text = json.choices?.[0]?.message?.content || '';

    return {
      role: 'SoloFallback',
      modelId: defaultModel,
      response: text,
      isPrimary: true,
      status: 'completed',
      usedFallback: true,
      fallbackReason: 'Double timeout on all council agents'
    };
  } catch (err: any) {
    return {
      role: 'SoloFallback',
      modelId: defaultModel,
      response: 'Error during Solo fallback: ' + err.message,
      isPrimary: true,
      status: 'failed',
      error: err.message,
      usedFallback: true,
      fallbackReason: 'Double timeout on all council agents'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const AgentOrchestrator = {
  async *executeGoALite(
    plan: AgentPlan,
    prompt: string,
    apiKey: string,
    sessionId: string
  ): AsyncIterableIterator<AgentResult> {
    // 1. Cap to top 5 agents
    const activeAgents = plan.agents.slice(0, 5);
    const k = activeAgents.length;

    if (k === 0) {
      yield {
        role: 'Orchestrator',
        modelId: 'none',
        response: 'No agents planned.',
        status: 'failed',
        error: 'Empty agent list'
      };
      return;
    }

    // Yield initial 'generating' status for each agent
    for (const agent of activeAgents) {
      yield {
        role: agent.role,
        modelId: agent.modelId,
        response: '',
        status: 'generating'
      };
    }

    // Execute planned agents in parallel
    const initialResponses: AgentResult[] = [];
    const queue: AgentResult[] = [];
    let resolveQueue: (() => void) | null = null;
    let activeTasks = k;
    let hasDoubleTimeout = false;

    activeAgents.forEach(async (agent) => {
      const startTime = Date.now();
      try {
        const { text, usedFallback, failureReason } = await callAgentWithTimeoutAndRetry(agent, prompt, apiKey, 0.7, sessionId);
        const result: AgentResult = {
          role: agent.role,
          modelId: agent.modelId,
          response: text,
          latency: Date.now() - startTime,
          status: 'completed',
          usedFallback,
          fallbackReason: failureReason
        };
        queue.push(result);
      } catch (err: any) {
        if (err.message === 'DOUBLE_TIMEOUT') {
          hasDoubleTimeout = true;
        }
        const result: AgentResult = {
          role: agent.role,
          modelId: agent.modelId,
          response: '',
          status: 'failed',
          error: err.message || String(err)
        };
        queue.push(result);
      } finally {
        activeTasks--;
        if (resolveQueue) resolveQueue();
      }
    });

    // Stream out parallel generation completions
    while (activeTasks > 0 || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          resolveQueue = resolve;
        });
        resolveQueue = null;
      }
      while (queue.length > 0) {
        const res = queue.shift()!;
        initialResponses.push(res);
        yield res;
      }
    }

    // Handle double timeout fallback to solo mode
    if (hasDoubleTimeout) {
      console.warn('[AgentOrchestrator] Double timeout detected on initial agent calls. Falling back to Solo Mode.');
      const fallbackResult = await runSoloFallback(prompt, apiKey, sessionId);
      yield fallbackResult;
      return;
    }

    // Filter out failed agents for scoring
    const succeededAgents = initialResponses.filter(r => r.status === 'completed');
    if (succeededAgents.length === 0) {
      yield {
        role: 'Orchestrator',
        modelId: 'none',
        response: 'All agent initial completions failed.',
        status: 'failed',
        error: 'All agents failed'
      };
      return;
    }

    // If Fast mode, skip edge scoring
    if (plan.reasoningEffort === 'Fast') {
      TelemetryEngine.record({
        session_id: sessionId,
        event_type: 'routed_to_council',
        api_calls: k,
        ts: Date.now(),
        edge_matrix_json: JSON.stringify({ note: 'scoring was skipped' })
      });

      // Use the first non-errored response as primary
      const primary = succeededAgents[0];
      yield {
        ...primary,
        isPrimary: true
      };
      return;
    }

    // Otherwise, execute edge scoring in parallel
    // Initialize adjacency matrix S[i][j]: score scorer i gave to j
    const edgeMatrix: number[][] = Array(k).fill(0).map(() => Array(k).fill(0));

    // Yield evaluating status
    for (const agent of succeededAgents) {
      yield {
        role: agent.role,
        modelId: agent.modelId,
        response: '',
        status: 'evaluating'
      };
    }

    const scoringPromises = succeededAgents.map(async (scorerAgent, i) => {
      const otherAgents = succeededAgents.filter((_, idx) => idx !== i);
      if (otherAgents.length === 0) return;

      const otherResponsesText = otherAgents
        .map(a => `Agent Role: ${a.role}\nResponse:\n${a.response}\n---`)
        .join('\n\n');

      const otherAgentRolesJsonKeys = otherAgents
        .map(a => `"${a.role}": <score_between_0.0_and_1.0>`)
        .join(',\n    ');

      const scoringPrompt = `You are evaluating alternative responses to a user query.
Original User Query:
"${prompt}"

Here are the responses generated by other agents. Please evaluate them on correctness, coherence, and relevance to the query.

${otherResponsesText}

Provide a score between 0.0 and 1.0 for each of the other agents.
You MUST output your evaluation in the following JSON format:
{
  "scores": {
    ${otherAgentRolesJsonKeys}
  }
}
Do not include any thinking, explanation, markdown formatting, or other text. Return ONLY the JSON object.`;

      try {
        const { text: rawResponse } = await callAgentWithTimeoutAndRetry(scorerAgent, scoringPrompt, apiKey, 0.1, sessionId);
        let content = rawResponse.trim();
        if (content.includes('```')) {
          const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) {
            content = match[1];
          }
        }
        const parsed = JSON.parse(content) as { scores: Record<string, number> };
        const rawScores = parsed.scores || {};

        // Extract scores for other agents
        const extractedScores = otherAgents.map(a => rawScores[a.role] ?? 0);
        const sumRaw = extractedScores.reduce((sum, val) => sum + val, 0);

        otherAgents.forEach((agentJ, indexInOthers) => {
          const j = succeededAgents.findIndex(a => a.role === agentJ.role);
          const rawScore = extractedScores[indexInOthers];
          edgeMatrix[i][j] = sumRaw > 0 ? rawScore / sumRaw : 1 / otherAgents.length;
        });
      } catch (err: any) {
        if (err.message === 'DOUBLE_TIMEOUT') {
          hasDoubleTimeout = true;
        }
        console.warn(`[AgentOrchestrator] Scoring call from ${scorerAgent.role} failed:`, err.message);
        // Fallback: equal scoring
        otherAgents.forEach(agentJ => {
          const j = succeededAgents.findIndex(a => a.role === agentJ.role);
          edgeMatrix[i][j] = 1 / otherAgents.length;
        });
      }
    });

    await Promise.all(scoringPromises);

    if (hasDoubleTimeout) {
      console.warn('[AgentOrchestrator] Double timeout detected during scoring calls. Falling back to Solo Mode.');
      const fallbackResult = await runSoloFallback(prompt, apiKey, sessionId);
      yield fallbackResult;
      return;
    }

    // Compute raw S_j = sum_{i != j} S_{ji}
    const rawS: Record<string, number> = {};
    succeededAgents.forEach(a => {
      rawS[a.role] = 0;
    });
    for (let j = 0; j < succeededAgents.length; j++) {
      const roleJ = succeededAgents[j].role;
      for (let i = 0; i < succeededAgents.length; i++) {
        if (i !== j) {
          rawS[roleJ] += edgeMatrix[i][j];
        }
      }
    }

    // Normalize S_j to sum to 1
    const totalS = Object.values(rawS).reduce((sum, val) => sum + val, 0) || 1;
    const S: Record<string, number> = {};
    succeededAgents.forEach(a => {
      S[a.role] = rawS[a.role] / totalS;
    });

    // Prune agents with S_j < 0.05
    const activeScoredAgents = succeededAgents.filter(a => S[a.role] >= 0.05);
    const pool = activeScoredAgents.length > 0 ? activeScoredAgents : succeededAgents;

    // Max-pool selection: select agent with highest S_j
    let primaryAgent = pool[0];
    for (const agent of pool) {
      if (S[agent.role] > S[primaryAgent.role]) {
        primaryAgent = agent;
      }
    }

    // Build the edge_matrix_json serialization
    const serializedMatrix = {
      matrix: edgeMatrix,
      roles: succeededAgents.map(a => a.role),
      modelIds: succeededAgents.map(a => a.modelId),
      influenceScores: S
    };

    // Record event to session_events
    TelemetryEngine.record({
      session_id: sessionId,
      event_type: 'routed_to_council',
      api_calls: k + succeededAgents.length,
      ts: Date.now(),
      edge_matrix_json: JSON.stringify(serializedMatrix)
    });

    // Yield final results
    for (const agent of succeededAgents) {
      yield {
        ...agent,
        sScore: S[agent.role],
        isPrimary: agent.role === primaryAgent.role
      };
    }
  }
};
