import { PreflightContext, GateResult } from 'shared';
import { PreflightGate } from '../modules/preflightGate.js';
import { TelemetryEngine } from '../modules/telemetryEngine.js';
import { ModelPoolManager } from '../modules/modelPoolManager.js';
import { getOpenRouterHttpReferer } from '../config/openRouterHeaders.js';
import { getRequestTimeoutMs } from '../config/requestTimeout.js';

function getFallbackModels(): Record<string, string> {
  const envJson = process.env.FALLBACK_MODELS_JSON?.trim();
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson) as Record<string, string>;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      console.warn('[soloDispatch] Invalid FALLBACK_MODELS_JSON env var; using compiled defaults');
    }
  }
  return {
    'inclusionai/ring-2.6-1t:free': 'openrouter/free',
    'openrouter/owl-alpha': 'nvidia/nemotron-3-super-120b-a12b:free',
    'qwen/qwen3-coder:free': 'poolside/laguna-m.1:free',
    'openai/gpt-oss-120b:free': 'meta-llama/llama-3.3-70b-instruct:free',
    'nvidia/nemotron-3-super-120b-a12b:free': 'arcee-ai/trinity-large-thinking:free',
    'liquid/lfm-2.5-1.2b-instruct:free': 'meta-llama/llama-3.2-3b-instruct:free',
    'nvidia/nemotron-nano-12b-v2-vl:free': 'meta-llama/llama-3.2-3b-instruct:free'
  };
}

const FALLBACK_MODELS = getFallbackModels();

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
  abortSignal?: AbortSignal;
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
    abortSignal,
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
      const signal = abortSignal ? AbortSignal.any([controller.signal, abortSignal]) : controller.signal;
      const timeoutId = setTimeout(() => controller.abort(), getRequestTimeoutMs());
      let response: Response;
      try {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': getOpenRouterHttpReferer(),
            'X-Title': 'FreeCouncil'
          },
          body: JSON.stringify(body),
          signal
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

  const isFast = (runSettings.reasoningEffort || '').toLowerCase() === 'fast';
  const structuredOutput = !!runSettings.structuredOutput;
  const jsonSchema = runSettings.jsonSchema || null;

  // Validate JSON response against optional schema (subset check)
  function validateResponseJson(text: string): Array<{ path: string; message: string }> {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [{ path: '$', message: 'Response is not valid JSON' }];
    }
    if (!jsonSchema || typeof jsonSchema !== 'object') return [];

    const errors: Array<{ path: string; message: string }> = [];
    function check(value: any, schema: any, path: string) {
      if (!schema || typeof schema !== 'object') return;
      if (schema.type) {
        const actual = Array.isArray(value) ? 'array' : typeof value;
        if (schema.type === 'array' && !Array.isArray(value)) {
          errors.push({ path, message: `Expected array, got ${actual}` });
        } else if (schema.type !== 'array' && schema.type !== 'null' && actual !== schema.type && !(schema.type === 'integer' && actual === 'number')) {
          errors.push({ path, message: `Expected ${schema.type}, got ${actual}` });
        }
      }
      if (schema.required && Array.isArray(schema.required) && typeof value === 'object' && value !== null) {
        for (const key of schema.required) {
          if (!(key in value)) errors.push({ path: `${path}.${key}`, message: `Required property '${key}' missing` });
        }
      }
      if (schema.properties && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const [k, ps] of Object.entries(schema.properties)) {
          if (k in value) check(value[k], ps, `${path}.${k}`);
        }
      }
      if (schema.items && Array.isArray(value)) {
        value.forEach((item: any, i: number) => check(item, schema.items, `${path}[${i}]`));
      }
    }
    check(parsed, jsonSchema, '$');
    return errors;
  }

  // Non-streaming call for structured output mode
  const callNonStream = async (msgList: any[], currentModelId: string): Promise<string> => {
    const { stream: _s, structuredOutput: _so, jsonSchema: _js, ...baseSettings } = runSettings;
    const responseFormat = jsonSchema
      ? { type: 'json_schema', json_schema: { name: 'response', schema: jsonSchema } }
      : { type: 'json_object' };
    const body = {
      model: currentModelId,
      messages: msgList,
      stream: false,
      response_format: responseFormat,
      ...baseSettings
    };
    const controller = new AbortController();
    const signal = abortSignal ? AbortSignal.any([controller.signal, abortSignal]) : controller.signal;
    const timeoutId = setTimeout(() => controller.abort(), getRequestTimeoutMs());
    let resp: Response;
    try {
      resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': getOpenRouterHttpReferer(),
          'X-Title': 'FreeCouncil'
        },
        body: JSON.stringify(body),
        signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`OpenRouter HTTP ${resp.status}: ${txt}`);
    }
    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content || '';
  };

  // Emit a complete response as SSE chunks
  const emitAsSSE = (content: string, validationErrors?: Array<{ path: string; message: string }>) => {
    const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
    onChunk(chunk);
    if (validationErrors && validationErrors.length > 0) {
      const errChunk = `data: ${JSON.stringify({ type: 'validation_errors', errors: validationErrors })}\n\n`;
      onChunk(errChunk);
    }
    onChunk('data: [DONE]\n\n');
  };

  const executeCall = async (currentModelId: string): Promise<boolean> => {
    attempts++;

    try {
      console.log(`[soloDispatch] POST to OpenRouter using model: ${currentModelId} (Attempt ${attempts})`);

      // Structured output path: non-streaming with retry-on-invalid-JSON
      if (structuredOutput) {
        let msgList = [...trimmedMessages];
        let lastContent = '';
        let lastErrors: Array<{ path: string; message: string }> = [];
        const maxJsonRetries = isFast ? 0 : 2;

        for (let attempt = 0; attempt <= maxJsonRetries; attempt++) {
          if (attempt > 0) {
            // Build correction prompt
            const errorList = lastErrors.map(e => `- ${e.path}: ${e.message}`).join('\n');
            msgList = [
              ...trimmedMessages,
              { role: 'assistant', content: lastContent },
              {
                role: 'user',
                content: `Your previous response had JSON validation errors. Please fix them and respond with valid JSON only.\n\nErrors:\n${errorList}\n\nRequired schema:\n${JSON.stringify(jsonSchema || {}, null, 2)}`
              }
            ];
            TelemetryEngine.record({
              session_id: sessionId,
              event_type: 'structured_output_retry',
              api_calls: attempt,
              ts: Date.now()
            });
          }

          lastContent = await callNonStream(msgList, currentModelId);
          lastErrors = validateResponseJson(lastContent);

          if (lastErrors.length === 0) break;
        }

        TelemetryEngine.record({
          session_id: sessionId,
          event_type: 'routed_to_solo',
          api_calls: 1,
          ts: Date.now()
        });

        if (lastErrors.length > 0) {
          TelemetryEngine.record({
            session_id: sessionId,
            event_type: 'validation_failure',
            ts: Date.now()
          });
        }

        emitAsSSE(lastContent, lastErrors.length > 0 ? lastErrors : undefined);
        onComplete();
        return true;
      }

      // Standard streaming path
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
        const fallback = FALLBACK_MODELS[currentModelId]
          || process.env.FINAL_FALLBACK_MODEL?.trim()
          || 'meta-llama/llama-3.3-70b-instruct:free';
        if (!FALLBACK_MODELS[currentModelId]) {
          console.warn(`[soloDispatch] Fallback chain exhausted for ${currentModelId}; using last-resort model ${fallback}`);
        } else {
          console.log(`[soloDispatch] Retrying fallback: ${fallback}`);
        }
        return await executeCall(fallback);
      } else {
        onError(err);
        return false;
      }
    }
  };

  await executeCall(activeModelId);
}
