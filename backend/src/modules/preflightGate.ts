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

export const PreflightGate = {
  check(context: PreflightContext): GateResult {
    // 1. API_KEY_MISSING check
    if (!context.apiKeyPresent) {
      TelemetryEngine.record({
        session_id: context.sessionId,
        event_type: 'api_key_missing',
        ts: Date.now()
      });
      logException('API_KEY_MISSING', context.modelId, 'dismissed', context.sessionId);
      return { allowed: false, violation: 'API_KEY_MISSING' };
    }

    // 2. FREE_LOCK_VIOLATION check
    if (context.freeLockEnabled && !context.isFreeModel) {
      TelemetryEngine.record({
        session_id: context.sessionId,
        event_type: 'free_lock_rejection',
        ts: Date.now()
      });

      // Find fallback free model
      const freeModels = ModelPoolManager.getFreeModels();
      let fallbackModelId = 'openrouter/free'; // Default fallback

      if (freeModels.length > 0) {
        // Prefer a popular general free model if it's available
        const preferred = [
          'meta-llama/llama-3.3-70b-instruct:free',
          'google/gemini-2.5-flash',
          'openrouter/free'
        ];
        const found = preferred.find(id => freeModels.some(m => m.modelId === id));
        if (found) {
          fallbackModelId = found;
        } else {
          fallbackModelId = freeModels[0].modelId;
        }
      }

      logException('FREE_LOCK_VIOLATION', context.modelId, 'lock_disabled', context.sessionId, {
        reassignedModelId: fallbackModelId
      });

      return {
        allowed: false,
        violation: 'FREE_LOCK_VIOLATION',
        reassignedModelId: fallbackModelId
      };
    }

    // 3. PRIVACY_DISCLOSURE_PENDING check
    if (context.isProviderLogged && !context.privacyDisclosureAcknowledged) {
      TelemetryEngine.record({
        session_id: context.sessionId,
        event_type: 'privacy_disclosure_pending',
        ts: Date.now()
      });
      logException('PRIVACY_DISCLOSURE_PENDING', context.modelId, 'acknowledged', context.sessionId);
      return { allowed: false, violation: 'PRIVACY_DISCLOSURE_PENDING' };
    }

    // 4. ZDR_REQUIRED_UNAVAILABLE check
    if (context.zdrRequired && !context.modelSupportsZdr) {
      logException('ZDR_REQUIRED_UNAVAILABLE', context.modelId, 'zdr_disabled', context.sessionId);
      return { allowed: false, violation: 'ZDR_REQUIRED_UNAVAILABLE' };
    }

    // 5. UPLOAD_DISCLOSURE_PENDING check
    if (context.containsUpload && !context.uploadDisclosureAcknowledged) {
      logException('UPLOAD_DISCLOSURE_PENDING', context.modelId, 'acknowledged', context.sessionId);
      return { allowed: false, violation: 'UPLOAD_DISCLOSURE_PENDING' };
    }

    // 6. BUDGET_VIOLATION check
    const isSimplePromptMultiAgent = context.promptClass === 'simple' && context.requestedApiCalls > 1;
    const isOverCallLimit = context.requestedApiCalls > 5;
    if ((isSimplePromptMultiAgent || isOverCallLimit) && !context.budgetEscalated) {
      logException('BUDGET_VIOLATION', context.modelId, 'escalated', context.sessionId, {
        promptClass: context.promptClass,
        requestedApiCalls: context.requestedApiCalls
      });
      return { allowed: false, violation: 'BUDGET_VIOLATION' };
    }

    // 7. AGGREGATOR_ROLE_CONFLICT check
    if (context.aggregatorModelId && context.proposerModelIds && context.proposerModelIds.includes(context.aggregatorModelId)) {
      const freeModels = ModelPoolManager.getFreeModels();
      const proposers = context.proposerModelIds;
      const candidateModels = freeModels.filter(m => !proposers.includes(m.modelId));
      let fallbackAggregatorModelId = 'meta-llama/llama-3.3-70b-instruct:free'; // Default fallback

      if (candidateModels.length > 0) {
        const reasoningCandidate = candidateModels.find(m => m.reasoning);
        if (reasoningCandidate) {
          fallbackAggregatorModelId = reasoningCandidate.modelId;
        } else {
          fallbackAggregatorModelId = candidateModels[0].modelId;
        }
      }

      logException('AGGREGATOR_ROLE_CONFLICT', context.modelId, 'acknowledged', context.sessionId, {
        aggregatorModelId: context.aggregatorModelId,
        proposerModelIds: context.proposerModelIds,
        reassignedModelId: fallbackAggregatorModelId
      });

      return {
        allowed: false,
        violation: 'AGGREGATOR_ROLE_CONFLICT',
        reassignedModelId: fallbackAggregatorModelId
      };
    }

    // 8. AGENT_CAP_VIOLATION check
    if (context.activeAgentCount > 5) {
      logException('AGENT_CAP_VIOLATION', context.modelId, 'acknowledged', context.sessionId, {
        originalAgentCount: context.activeAgentCount,
        truncatedCount: 5
      });
      return { allowed: true, violation: 'AGENT_CAP_VIOLATION' };
    }

    // Allowed!
    return { allowed: true };
  }
};
