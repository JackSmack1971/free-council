import { PreflightContext, GateResult } from 'shared';
import { TelemetryEngine } from './telemetryEngine.js';
import { ModelPoolManager } from './modelPoolManager.js';

export const PreflightGate = {
  check(context: PreflightContext): GateResult {
    // 1. API_KEY_MISSING check
    if (!context.apiKeyPresent) {
      TelemetryEngine.record({
        session_id: context.sessionId,
        event_type: 'api_key_missing',
        ts: Date.now()
      });
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

      return {
        allowed: false,
        violation: 'FREE_LOCK_VIOLATION',
        reassignedModelId: fallbackModelId
      };
    }

    // 3. PRIVACY_DISCLOSURE_PENDING check
    if (context.isProviderLogged && !context.privacyDisclosureAcknowledged) {
      return { allowed: false, violation: 'PRIVACY_DISCLOSURE_PENDING' };
    }

    // 4. ZDR_REQUIRED_UNAVAILABLE check
    if (context.zdrRequired && !context.modelSupportsZdr) {
      return { allowed: false, violation: 'ZDR_REQUIRED_UNAVAILABLE' };
    }

    // 5. UPLOAD_DISCLOSURE_PENDING check
    if (context.containsUpload && !context.uploadDisclosureAcknowledged) {
      return { allowed: false, violation: 'UPLOAD_DISCLOSURE_PENDING' };
    }

    // Allowed!
    return { allowed: true };
  }
};
