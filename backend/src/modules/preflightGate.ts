import { PreflightContext, GateResult, PolicyViolation } from 'shared';
import { TelemetryEngine } from './telemetryEngine.js';
import { ModelPoolManager } from './modelPoolManager.js';
import { recordException } from '../db/policyExceptionsRepo.js';

function logException(violation: PolicyViolation, modelId: string | null, userAction: string, sessionId: string, details: any = null) {
  try {
    recordException({
      ts: Date.now(),
      violation_type: violation,
      model_id: modelId,
      user_action: userAction,
      session_id: sessionId,
      details_json: details ? JSON.stringify(details) : null
    });
  } catch (err: any) {
    console.error('[PreflightGate] Failed to record policy exception:', err.message);
  }
}

function resolveFreeLockFallbackModelId(): string {
  const freeModels = ModelPoolManager.getFreeModels();
  let fallbackModelId = 'openrouter/free';

  if (freeModels.length > 0) {
    const preferred = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.5-flash',
      'openrouter/free'
    ];
    const found = preferred.find(id => freeModels.some(m => m.modelId === id));
    fallbackModelId = found || freeModels[0].modelId;
  }

  return fallbackModelId;
}

function resolveAggregatorFallbackModelId(proposerModelIds: string[] = []): string {
  const freeModels = ModelPoolManager.getFreeModels();
  const candidateModels = freeModels.filter(m => !proposerModelIds.includes(m.modelId));
  const reasoningCandidate = candidateModels.find(m => m.reasoning);
  return reasoningCandidate?.modelId || candidateModels[0]?.modelId || 'meta-llama/llama-3.3-70b-instruct:free';
}

type PolicyEvaluationDependencies = {
  freeLockFallbackModelId?: string;
  aggregatorFallbackModelId?: string;
};

export function evaluatePreflightPolicy(
  context: PreflightContext,
  dependencies: PolicyEvaluationDependencies = {}
): GateResult {
  const freeLockFallbackModelId = dependencies.freeLockFallbackModelId || 'openrouter/free';
  const aggregatorFallbackModelId = dependencies.aggregatorFallbackModelId || 'meta-llama/llama-3.3-70b-instruct:free';

  if (!context.apiKeyPresent) {
    return { allowed: false, violation: 'API_KEY_MISSING' };
  }

  if (context.freeLockEnabled && !context.isFreeModel) {
    return {
      allowed: false,
      violation: 'FREE_LOCK_VIOLATION',
      reassignedModelId: freeLockFallbackModelId
    };
  }

  if (context.isProviderLogged && !context.privacyDisclosureAcknowledged) {
    return { allowed: false, violation: 'PRIVACY_DISCLOSURE_PENDING' };
  }

  if (context.zdrRequired && !context.modelSupportsZdr) {
    return { allowed: false, violation: 'ZDR_REQUIRED_UNAVAILABLE' };
  }

  if (context.containsUpload && !context.uploadDisclosureAcknowledged) {
    return { allowed: false, violation: 'UPLOAD_DISCLOSURE_PENDING' };
  }

  const isSimplePromptMultiAgent = context.promptClass === 'simple' && context.requestedApiCalls > 1;
  const isOverCallLimit = context.requestedApiCalls > 5;
  if ((isSimplePromptMultiAgent || isOverCallLimit) && !context.budgetEscalated) {
    return { allowed: false, violation: 'BUDGET_VIOLATION' };
  }

  if (context.aggregatorModelId && context.proposerModelIds && context.proposerModelIds.includes(context.aggregatorModelId)) {
    return {
      allowed: false,
      violation: 'AGGREGATOR_ROLE_CONFLICT',
      reassignedModelId: aggregatorFallbackModelId
    };
  }

  if (context.structuredOutputRequested && !context.modelSupportsStructuredOutput) {
    return { allowed: false, violation: 'STRUCTURED_OUTPUT_UNAVAILABLE' };
  }

  if (context.activeAgentCount > 5) {
    return { allowed: true, violation: 'AGENT_CAP_VIOLATION' };
  }

  return { allowed: true };
}

function recordPolicyOutcome(context: PreflightContext, result: GateResult): void {
  if (!result.violation) {
    return;
  }

  switch (result.violation) {
    case 'API_KEY_MISSING':
      TelemetryEngine.record({
        session_id: context.sessionId,
        event_type: 'api_key_missing',
        ts: Date.now()
      });
      logException('API_KEY_MISSING', context.modelId, 'dismissed', context.sessionId);
      return;
    case 'FREE_LOCK_VIOLATION':
      TelemetryEngine.record({
        session_id: context.sessionId,
        event_type: 'free_lock_rejection',
        ts: Date.now()
      });
      logException('FREE_LOCK_VIOLATION', context.modelId, 'lock_disabled', context.sessionId, {
        reassignedModelId: result.reassignedModelId
      });
      return;
    case 'PRIVACY_DISCLOSURE_PENDING':
      TelemetryEngine.record({
        session_id: context.sessionId,
        event_type: 'privacy_disclosure_pending',
        ts: Date.now()
      });
      logException('PRIVACY_DISCLOSURE_PENDING', context.modelId, 'acknowledged', context.sessionId);
      return;
    case 'ZDR_REQUIRED_UNAVAILABLE':
      logException('ZDR_REQUIRED_UNAVAILABLE', context.modelId, 'zdr_disabled', context.sessionId);
      return;
    case 'UPLOAD_DISCLOSURE_PENDING':
      logException('UPLOAD_DISCLOSURE_PENDING', context.modelId, 'acknowledged', context.sessionId);
      return;
    case 'BUDGET_VIOLATION':
      logException('BUDGET_VIOLATION', context.modelId, 'escalated', context.sessionId, {
        promptClass: context.promptClass,
        requestedApiCalls: context.requestedApiCalls
      });
      return;
    case 'AGGREGATOR_ROLE_CONFLICT':
      logException('AGGREGATOR_ROLE_CONFLICT', context.modelId, 'acknowledged', context.sessionId, {
        aggregatorModelId: context.aggregatorModelId,
        proposerModelIds: context.proposerModelIds,
        reassignedModelId: result.reassignedModelId
      });
      return;
    case 'STRUCTURED_OUTPUT_UNAVAILABLE':
      TelemetryEngine.record({
        session_id: context.sessionId,
        event_type: 'policy_violation',
        ts: Date.now()
      });
      logException('STRUCTURED_OUTPUT_UNAVAILABLE', context.modelId, 'dismissed', context.sessionId, {
        structuredOutputRequested: true,
        modelSupportsStructuredOutput: false
      });
      return;
    case 'AGENT_CAP_VIOLATION':
      logException('AGENT_CAP_VIOLATION', context.modelId, 'acknowledged', context.sessionId, {
        originalAgentCount: context.activeAgentCount,
        truncatedCount: 5
      });
      return;
    default:
      return;
  }
}

export const PreflightGate = {
  check(context: PreflightContext): GateResult {
    const result = evaluatePreflightPolicy(context, {
      freeLockFallbackModelId: resolveFreeLockFallbackModelId(),
      aggregatorFallbackModelId: resolveAggregatorFallbackModelId(context.proposerModelIds)
    });
    recordPolicyOutcome(context, result);
    return result;
  }
};
