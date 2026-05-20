import { AgentPlan, AgentResult, AgentAssignment, PreflightContext } from 'shared';
import { RouterAgent } from '../agents/RouterAgent.js';
import { AgentOrchestrator } from '../agents/AgentOrchestrator.js';
import { PreflightGate } from '../modules/preflightGate.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { dispatchSoloChat } from './soloDispatch.js';
import { db } from '../db/connection.js';
import { TelemetryEngine } from '../modules/telemetryEngine.js';
import { FtsSearchService } from '../db/ftsSearchService.js';

interface CouncilDispatchOptions {
  sessionId: string;
  messages: any[];
  runSettings: Record<string, any>;
  apiKey: string;
  onChunk: (chunk: string) => void;
  onError: (err: any) => void;
  onComplete: () => void;
}

function sseEvent(obj: object): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
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

    // 3. Determine routing mode
    const routingMode = (runSettings.routingMode || 'adaptive').toLowerCase();

    // 4. Manual mode: bypass RouterAgent, use solo dispatch
    if (routingMode === 'manual') {
      TelemetryEngine.record({
        session_id: sessionId,
        event_type: 'routed_to_solo',
        api_calls: 1,
        ts: Date.now()
      });
      await dispatchSoloChat({
        ...options,
        modelId: runSettings.manualModelId || 'meta-llama/llama-3.3-70b-instruct:free',
        freeLockEnabled: runSettings.freeLockEnabled !== false
      });
      return;
    }

    // 5. Determine reasoning effort
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

    // 6. Route based on reasoning effort and prompt complexity
    if ((effort === 'Balanced' || effort === 'Deep') && promptClass === 'simple') {
      console.log(`[councilDispatch] Simple prompt in ${effort} mode. Falling back to Solo Mode.`);
      TelemetryEngine.record({
        session_id: sessionId,
        event_type: 'routed_to_solo',
        api_calls: 1,
        ts: Date.now()
      });
      await dispatchSoloChat({
        ...options,
        modelId: 'meta-llama/llama-3.3-70b-instruct:free',
        freeLockEnabled: runSettings.freeLockEnabled !== false
      });
      return;
    }

    // 7. Run RouterAgent GoA node sampling to get the plan
    const freeModels = ModelPoolManager.getFreeModels();
    const k = runSettings.proposerCount || 3;
    const containsUpload = !!runSettings.containsUpload;
    const freeLockEnabled = runSettings.freeLockEnabled !== false;
    const budgetEscalated = !!runSettings.budgetEscalated;
    const plan = await RouterAgent.sampleAgents(
      query, freeModels, k, apiKey, containsUpload,
      effort, promptClass === 'complex' ? 'non_trivial' : 'simple',
      freeLockEnabled, budgetEscalated
    );
    plan.reasoningEffort = effort as 'Fast' | 'Balanced' | 'Deep' | 'Adaptive';

    // Emit plan event (budget preview before dispatch)
    onChunk(sseEvent({ type: 'plan', plan }));

    // 8. PreflightGate Check
    const activeModelId = 'openrouter/free';
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
      if (gateResult.violation === 'AGENT_CAP_VIOLATION') {
        // Truncate plan to 5, but allow
        plan.agents = plan.agents.slice(0, 5);
        TelemetryEngine.record({
          session_id: sessionId,
          event_type: 'cap_enforcement',
          agent_count: plan.agents.length,
          ts: Date.now()
        });
      } else if (gateResult.violation === 'BUDGET_VIOLATION') {
        TelemetryEngine.record({
          session_id: sessionId,
          event_type: 'budget_violation',
          ts: Date.now()
        });
        onChunk(sseEvent({ type: 'error', message: `Preflight check failed: ${gateResult.violation}` }));
        onError(new Error(`Preflight check failed: ${gateResult.violation}`));
        return;
      } else {
        TelemetryEngine.record({
          session_id: sessionId,
          event_type: 'policy_violation',
          synthesis_rationale: gateResult.violation,
          ts: Date.now()
        });
        onChunk(sseEvent({ type: 'error', message: `Preflight check failed: ${gateResult.violation}` }));
        onError(new Error(`Preflight check failed: ${gateResult.violation}`));
        return;
      }
    }

    // 9. Build enriched query with FTS5 context if uploads are present
    let enrichedQuery = query;
    if (containsUpload && runSettings.uploadDisclosureAcknowledged) {
      const chunks = FtsSearchService.searchFileContent(sessionId, query, 5);
      if (chunks.length > 0) {
        const contextBlock = chunks
          .map((c, i) => `[Document ${i + 1}] (file: ${c.filename}):\n${c.content}`)
          .join('\n\n---\n\n');
        enrichedQuery = `You have access to the following uploaded document excerpts. When answering, you MUST cite specific quotes or section references from these documents. Do not fabricate information not present in the documents.\n\n=== UPLOADED DOCUMENT CONTEXT ===\n${contextBlock}\n=== END OF CONTEXT ===\n\nUser Query: ${query}`;
        console.log(`[councilDispatch] Injected ${chunks.length} FTS5 document chunks into prompt for session ${sessionId}.`);
      }
    }

    // 10. Determine execution mode and emit pre-dispatch telemetry
    const executionMode = plan.executionMode || 'goa_lite';

    // 11. Execute via appropriate orchestrator method
    let generator: AsyncIterableIterator<AgentResult>;
    if (executionMode === 'goa_moa_hybrid') {
      // Extract attachments context from enrichedQuery for aggregator
      const attachmentsContext = containsUpload ? enrichedQuery : '';
      generator = AgentOrchestrator.executeGoAMoAHybrid(plan, enrichedQuery, apiKey, sessionId, attachmentsContext);
    } else {
      generator = AgentOrchestrator.executeGoALite(plan, enrichedQuery, apiKey, sessionId);
    }

    let primaryResult: AgentResult | null = null;
    const completedResults: AgentResult[] = [];
    const seenStarted = new Set<string>();
    const finalResults: AgentResult[] = [];

    for await (const chunk of generator) {
      if (chunk.status === 'generating') {
        // Emit agent_start once per role
        if (!seenStarted.has(chunk.role)) {
          seenStarted.add(chunk.role);
          onChunk(sseEvent({ type: 'agent_start', agentId: chunk.role, role: chunk.role, modelId: chunk.modelId }));
        }
      } else if (chunk.status === 'evaluating') {
        // Scoring pass in progress — no extra event needed (covered by agent_start already)
      } else if (chunk.status === 'completed') {
        completedResults.push(chunk);
        // Emit agent_done
        onChunk(sseEvent({
          type: 'agent_done',
          agentId: chunk.role,
          response: (chunk.response || '').slice(0, 200) // truncated preview
        }));
      } else if (chunk.status === 'failed') {
        // Emit error for failed agent but continue
        onChunk(sseEvent({ type: 'agent_done', agentId: chunk.role, response: '', error: chunk.error }));
      }

      // Collect final results (those with sScore set = final scoring pass)
      if (chunk.sScore !== undefined) {
        finalResults.push(chunk);
        if (chunk.isPrimary) {
          primaryResult = chunk;
        }
      }
    }

    // Emit s_scores if we have final scored results (non-Fast mode)
    if (finalResults.length > 0 && effort !== 'Fast') {
      const scores: Record<string, number> = {};
      const prunedIds: string[] = [];
      for (const r of finalResults) {
        scores[r.role] = r.sScore ?? 0;
        if ((r.sScore ?? 0) < 0.05) {
          prunedIds.push(r.role);
        }
      }
      onChunk(sseEvent({ type: 's_scores', scores }));
      if (prunedIds.length > 0) {
        onChunk(sseEvent({ type: 'pruned', agentIds: prunedIds }));
      }
      if (primaryResult) {
        onChunk(sseEvent({ type: 'selected', agentId: primaryResult.role }));
      }
    }

    // Determine primary result
    if (!primaryResult) {
      if (finalResults.length > 0) {
        primaryResult = finalResults.find(r => r.isPrimary) || finalResults[0];
      } else if (completedResults.length > 0) {
        primaryResult = completedResults[0];
      }
    }

    if (!primaryResult) {
      throw new Error('No successful responses from council agents.');
    }

    // Emit final response tokens (in response event format)
    onChunk(sseEvent({ type: 'response', content: primaryResult.response }));
    // Also emit in solo-compatible choices delta format for backward compatibility
    onChunk(sseEvent({ choices: [{ delta: { content: primaryResult.response } }] }));

    // Build edge matrix from DB record
    let edgeMatrix: any = null;
    const row = db.prepare('SELECT edge_matrix_json FROM session_events WHERE session_id = ? AND event_type = ? ORDER BY ts DESC LIMIT 1')
      .get(sessionId, 'routed_to_council') as { edge_matrix_json: string | null } | undefined;
    if (row && row.edge_matrix_json) {
      edgeMatrix = JSON.parse(row.edge_matrix_json);
    }

    // Emit trace event (includes MoA info when applicable)
    const allResults = finalResults.length > 0 ? finalResults : completedResults;
    const traceInfo = {
      type: 'trace',
      trace: {
        agents: allResults.map(r => ({
          role: r.role,
          modelId: r.modelId,
          sScore: r.sScore,
          isPrimary: r.role === primaryResult?.role,
          usedFallback: r.usedFallback,
          fallbackReason: r.fallbackReason
        })),
        samplingRationale: plan.samplingRationale,
        totalApiCalls: plan.totalApiCalls,
        edgeMatrix,
        executionMode,
        moaConfig: plan.moaConfig,
        // Fetch synthesis rationale from latest session_events row
        synthesisRationale: (() => {
          try {
            const srRow = db.prepare('SELECT synthesis_rationale FROM session_events WHERE session_id = ? AND synthesis_rationale IS NOT NULL ORDER BY ts DESC LIMIT 1').get(sessionId) as { synthesis_rationale: string | null } | undefined;
            return srRow?.synthesis_rationale;
          } catch { return undefined; }
        })()
      }
    };
    onChunk(sseEvent(traceInfo));

    // Record telemetry: completed_in_council
    TelemetryEngine.record({
      session_id: sessionId,
      event_type: 'completed_in_council',
      api_calls: 0,
      ts: Date.now()
    });

    onComplete();
  } catch (err: any) {
    TelemetryEngine.record({
      session_id: sessionId,
      event_type: 'policy_violation',
      synthesis_rationale: err.message,
      ts: Date.now()
    });
    onChunk(sseEvent({ type: 'error', message: err.message }));
    onError(err);
  }
}
