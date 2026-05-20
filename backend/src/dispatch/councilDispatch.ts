import { AgentPlan, AgentResult, AgentAssignment, PreflightContext } from 'shared';
import { RouterAgent } from '../agents/RouterAgent.js';
import { AgentOrchestrator } from '../agents/AgentOrchestrator.js';
import { PreflightGate } from '../modules/preflightGate.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { dispatchSoloChat } from './soloDispatch.js';
import { db } from '../db/connection.js';
import { TelemetryEngine } from '../modules/telemetryEngine.js';

interface CouncilDispatchOptions {
  sessionId: string;
  messages: any[];
  runSettings: Record<string, any>;
  apiKey: string;
  onChunk: (chunk: string) => void;
  onError: (err: any) => void;
  onComplete: () => void;
}

export async function dispatchCouncilChat(options: CouncilDispatchOptions): Promise<void> {
  const {
    sessionId,
    messages,
    runSettings,
    apiKey,
    onChunk,
    onError,
    onComplete
  } = options;

  try {
    // 1. Extract query
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const query = userMessages[userMessages.length - 1]?.content || '';

    // 2. Classify prompt complexity
    const isNontrivial = query.length > 200 ||
      /\b(code|function|class|implement|solve|math|calculate|algorithm|write|create|design)\b/i.test(query);
    const promptClass = isNontrivial ? 'complex' : 'simple';

    // 3. Determine reasoning effort
    let effort = runSettings.reasoningEffort || 'Adaptive';

    // Adaptive mode resolution
    if (effort === 'Adaptive') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const tsLimit = startOfDay.getTime();
      const quotaStmt = db.prepare('SELECT SUM(api_calls) as total FROM session_events WHERE ts >= ?');
      const quotaRow = quotaStmt.get(tsLimit) as { total: number | null };
      const usedToday = quotaRow?.total || 0;
      const remainingQuota = 200 - usedToday;

      if (remainingQuota > 50 && promptClass === 'complex') {
        effort = 'Balanced';
      } else if (promptClass === 'complex') {
        effort = 'Fast';
      } else {
        effort = 'Fast';
      }
    }

    // 4. Route based on reasoning effort and prompt complexity
    if ((effort === 'Balanced' || effort === 'Deep') && promptClass === 'simple') {
      // Fallback to Solo mode for simple prompts in Balanced/Deep
      console.log(`[councilDispatch] Simple prompt in ${effort} mode. Falling back to Solo Mode.`);
      await dispatchSoloChat({
        ...options,
        modelId: 'meta-llama/llama-3.3-70b-instruct:free',
        freeLockEnabled: runSettings.freeLockEnabled !== false
      });
      return;
    }

    // 5. Run RouterAgent GoA node sampling to get the plan
    const freeModels = ModelPoolManager.getFreeModels();
    const k = runSettings.proposerCount || 3;
    const plan = await RouterAgent.sampleAgents(query, freeModels, k, apiKey);
    plan.reasoningEffort = effort as 'Fast' | 'Balanced' | 'Deep' | 'Adaptive';

    // 6. PreflightGate Check
    const activeModelId = 'openrouter/free'; // Use fallback meta-LLM
    const hasProviderLogged = plan.agents.some(a => {
      const metadata = freeModels.find(m => m.modelId === a.modelId);
      return metadata ? metadata.is_provider_logged : false;
    });
    const allFreeModels = plan.agents.every(a => {
      const metadata = freeModels.find(m => m.modelId === a.modelId);
      return metadata ? metadata.is_free : false;
    });

    const preflightCtx: PreflightContext = {
      modelId: activeModelId,
      isFreeModel: allFreeModels,
      isProviderLogged: hasProviderLogged,
      apiKeyPresent: !!apiKey && apiKey.trim().length > 0,
      freeLockEnabled: runSettings.freeLockEnabled !== false,
      activeAgentCount: plan.agents.length,
      requestedApiCalls: plan.totalApiCalls,
      promptClass: promptClass === 'complex' ? 'non_trivial' : 'simple',
      privacyDisclosureAcknowledged: !!runSettings.privacyDisclosureAcknowledged,
      zdrRequired: !!runSettings.zdrRequired,
      modelSupportsZdr: true,
      containsUpload: !!runSettings.containsUpload,
      uploadDisclosureAcknowledged: !!runSettings.uploadDisclosureAcknowledged,
      sessionId,
      proposerModelIds: plan.agents.map(a => a.modelId),
      budgetEscalated: !!runSettings.budgetEscalated
    };

    const gateResult = PreflightGate.check(preflightCtx);
    if (!gateResult.allowed) {
      onError(new Error(`Preflight check failed: ${gateResult.violation}`));
      return;
    }

    // 7. Execute GoA-lite via AgentOrchestrator
    const generator = AgentOrchestrator.executeGoALite(plan, query, apiKey, sessionId);

    let primaryResult: AgentResult | null = null;
    const completedResults: AgentResult[] = [];
    let edgeMatrix: any = null;

    for await (const chunk of generator) {
      // Stream intermediate status/progress to client
      if (chunk.status === 'generating' || chunk.status === 'evaluating') {
        onChunk(`data: ${JSON.stringify({ type: 'agent_progress', role: chunk.role, status: chunk.status })}\n\n`);
      } else if (chunk.status === 'completed') {
        if (chunk.isPrimary) {
          primaryResult = chunk;
        }
        completedResults.push(chunk);
      }
    }

    // Retrieve recorded edge matrix from the database to stream to client
    const row = db.prepare('SELECT edge_matrix_json FROM session_events WHERE session_id = ? AND event_type = ? ORDER BY ts DESC LIMIT 1')
      .get(sessionId, 'routed_to_council') as { edge_matrix_json: string | null } | undefined;

    if (row && row.edge_matrix_json) {
      edgeMatrix = JSON.parse(row.edge_matrix_json);
    }

    // Stream final response to client in choices delta content format
    if (primaryResult) {
      onChunk(`data: ${JSON.stringify({ choices: [{ delta: { content: primaryResult.response } }] })}\n\n`);
    } else if (completedResults.length > 0) {
      primaryResult = completedResults[0];
      onChunk(`data: ${JSON.stringify({ choices: [{ delta: { content: primaryResult.response } }] })}\n\n`);
    } else {
      throw new Error('No successful responses from council agents.');
    }

    // Stream final trace metadata
    const traceInfo = {
      type: 'trace',
      trace: {
        agents: completedResults.map(r => ({
          role: r.role,
          modelId: r.modelId,
          sScore: r.sScore,
          isPrimary: r.role === primaryResult?.role
        })),
        samplingRationale: plan.samplingRationale,
        totalApiCalls: plan.totalApiCalls,
        edgeMatrix
      }
    };
    onChunk(`data: ${JSON.stringify(traceInfo)}\n\n`);

    // Record telemetry event: completed_in_council
    TelemetryEngine.record({
      session_id: sessionId,
      event_type: 'completed_in_council',
      api_calls: 0,
      ts: Date.now()
    });

    onComplete();
  } catch (err: any) {
    onError(err);
  }
}
