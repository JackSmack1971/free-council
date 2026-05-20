import { PreflightContext, GateResult } from 'shared';
import { PreflightGate } from '../modules/preflightGate.js';
import { TelemetryEngine } from '../modules/telemetryEngine.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';

const FALLBACK_MODELS: Record<string, string> = {
  'inclusionai/ring-2.6-1t:free': 'openrouter/free',
  'openrouter/owl-alpha': 'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-coder:free': 'poolside/laguna-m.1:free',
  'openai/gpt-oss-120b:free': 'meta-llama/llama-3.3-70b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free': 'arcee-ai/trinity-large-thinking:free',
  'liquid/lfm-2.5-1.2b-instruct:free': 'meta-llama/llama-3.2-3b-instruct:free',
  'nvidia/nemotron-nano-12b-v2-vl:free': 'meta-llama/llama-3.2-3b-instruct:free'
};

export function limitContext(messages: any[], contextLimit: number): any[] {
  // Estimate tokens: 1 token ≈ 4 characters
  const charLimit = contextLimit * 4;
  let currentChars = 0;
  const result: any[] = [];

  let systemMessage: any = null;
  let startIndex = 0;
  if (messages[0] && messages[0].role === 'system') {
    systemMessage = messages[0];
    currentChars += JSON.stringify(systemMessage).length;
    startIndex = 1;
  }

  const reversedToKeep: any[] = [];
  for (let i = messages.length - 1; i >= startIndex; i--) {
    const msg = messages[i];
    const msgLen = JSON.stringify(msg).length;
    if (currentChars + msgLen > charLimit) {
      break;
    }
    currentChars += msgLen;
    reversedToKeep.push(msg);
  }

  if (systemMessage) {
    result.push(systemMessage);
  }
  result.push(...reversedToKeep.reverse());
  return result;
}

interface DispatchOptions {
  sessionId: string;
  modelId: string;
  messages: any[];
  runSettings: Record<string, any>;
  apiKey: string;
  freeLockEnabled: boolean;
  privacyDisclosureAcknowledged?: boolean;
  zdrRequired?: boolean;
  uploadDisclosureAcknowledged?: boolean;
  containsUpload?: boolean;
  onChunk: (chunk: string) => void;
  onError: (err: any) => void;
  onComplete: () => void;
}

export async function dispatchSoloChat(options: DispatchOptions): Promise<void> {
  const {
    sessionId,
    modelId,
    messages,
    runSettings,
    apiKey,
    freeLockEnabled,
    privacyDisclosureAcknowledged = false,
    zdrRequired = false,
    uploadDisclosureAcknowledged = false,
    containsUpload = false,
    onChunk,
    onError,
    onComplete
  } = options;

  // 1. Resolve normalized capabilities for the model
  const freeModels = ModelPoolManager.getFreeModels();
  const cachedModel = freeModels.find(m => m.modelId === modelId);

  const isFreeModel = cachedModel ? cachedModel.is_free : false;
  const isProviderLogged = cachedModel ? cachedModel.is_provider_logged : false;
  const modelSupportsZdr = cachedModel ? cachedModel.supports_zdr : false;
  const contextLength = cachedModel ? cachedModel.contextLength : 8000;

  // 2. Build PreflightContext
  const preflightCtx: PreflightContext = {
    modelId,
    isProviderLogged,
    isFreeModel,
    apiKeyPresent: !!apiKey && apiKey.trim().length > 0,
    freeLockEnabled,
    activeAgentCount: 1,
    requestedApiCalls: 1,
    promptClass: 'simple',
    privacyDisclosureAcknowledged,
    zdrRequired,
    modelSupportsZdr,
    containsUpload,
    uploadDisclosureAcknowledged,
    sessionId
  };

  // 3. PreflightGate Check
  let gateResult = PreflightGate.check(preflightCtx);
  let activeModelId = modelId;

  if (!gateResult.allowed) {
    if (gateResult.violation === 'FREE_LOCK_VIOLATION' && gateResult.reassignedModelId) {
      activeModelId = gateResult.reassignedModelId;
      console.log(`[soloDispatch] FREE_LOCK_VIOLATION. Reassigning ${modelId} -> ${activeModelId}`);
    } else {
      onError(new Error(`Preflight check failed: ${gateResult.violation}`));
      return;
    }
  }

  // 4. Truncate context to min(model_context_window, 8000 tokens)
  const tokenLimit = Math.min(contextLength, 8000);
  const trimmedMessages = limitContext(messages, tokenLimit);

  // 5. Execution stream function with timeout and retries
  let attempts = 0;
  const maxAttempts = 2;

  // 429 backoff: retry same model up to 2 times before escalating to fallback
  const with429Backoff = async (
    modelId: string,
    body: object,
    isFast: boolean
  ): Promise<Response> => {
    const maxRetries = isFast ? 1 : 2;
    let retryAttempt = 0;
    while (true) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      let response: Response;
      try {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'FreeCouncil'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (response.status !== 429 || retryAttempt >= maxRetries) {
        return response;
      }
      retryAttempt++;
      TelemetryEngine.record({
        session_id: sessionId,
        event_type: 'retry',
        synthesis_rationale: `429_rate_limit attempt ${retryAttempt}`,
        ts: Date.now()
      });
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retryAttempt) * 1000;
      console.log(`[soloDispatch] 429 rate limit. Waiting ${waitMs}ms before retry ${retryAttempt}/${maxRetries}`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  };

  const executeCall = async (currentModelId: string): Promise<boolean> => {
    attempts++;
    const isFast = (runSettings.reasoningEffort || '').toLowerCase() === 'fast';

    try {
      console.log(`[soloDispatch] POST to OpenRouter using model: ${currentModelId} (Attempt ${attempts})`);
      const body = {
        model: currentModelId,
        messages: trimmedMessages,
        stream: true,
        ...runSettings
      };

      const response = await with429Backoff(currentModelId, body, isFast);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      // Stream data
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      TelemetryEngine.record({
        session_id: sessionId,
        event_type: 'routed_to_solo',
        api_calls: 1,
        ts: Date.now()
      });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunkStr = decoder.decode(value, { stream: true });
        onChunk(chunkStr);
      }

      onComplete();
      return true;
    } catch (err: any) {
      console.error(`[soloDispatch] Attempt ${attempts} failed:`, err.message || err);
      if (attempts < maxAttempts) {
        // Try fallback
        const fallback = FALLBACK_MODELS[currentModelId] || 'meta-llama/llama-3.3-70b-instruct:free';
        console.log(`[soloDispatch] Retrying fallback: ${fallback}`);
        return await executeCall(fallback);
      } else {
        onError(err);
        return false;
      }
    }
  };

  await executeCall(activeModelId);
}
