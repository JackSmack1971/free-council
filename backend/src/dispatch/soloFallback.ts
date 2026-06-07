import { AgentResult } from 'shared';
import { TelemetryEngine } from '../modules/telemetryEngine.js';
import { dispatchSoloChat } from './soloDispatch.js';
import { getOpenRouterHttpReferer } from '../config/openRouterHeaders.js';
import { getRequestTimeoutMs } from '../config/requestTimeout.js';

export const DEFAULT_SOLO_FALLBACK_MODEL_ID = 'meta-llama/llama-3.3-70b-instruct:free';

function recordSoloFallback(sessionId: string, reason: string): void {
  TelemetryEngine.record({
    session_id: sessionId,
    event_type: 'routed_to_solo',
    api_calls: 1,
    synthesis_rationale: reason,
    ts: Date.now()
  });
}

export async function dispatchViaSoloFallback(
  reason: string,
  options: Parameters<typeof dispatchSoloChat>[0]
): Promise<void> {
  recordSoloFallback(options.sessionId, reason);
  await dispatchSoloChat(options);
}

export async function executeSoloFallback(
  prompt: string,
  apiKey: string,
  sessionId: string,
  reason: string
): Promise<AgentResult> {
  recordSoloFallback(sessionId, reason);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': getOpenRouterHttpReferer(),
        'X-Title': 'FreeCouncil'
      },
      body: JSON.stringify({
        model: DEFAULT_SOLO_FALLBACK_MODEL_ID,
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
      modelId: DEFAULT_SOLO_FALLBACK_MODEL_ID,
      response: text,
      isPrimary: true,
      status: 'completed',
      usedFallback: true,
      fallbackReason: reason
    };
  } catch (err: any) {
    return {
      role: 'SoloFallback',
      modelId: DEFAULT_SOLO_FALLBACK_MODEL_ID,
      response: 'Error during Solo fallback: ' + err.message,
      isPrimary: true,
      status: 'failed',
      error: err.message,
      usedFallback: true,
      fallbackReason: reason
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
