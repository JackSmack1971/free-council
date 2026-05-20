const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export interface ModelInfo {
  modelId: string;
  is_free: boolean;
  is_provider_logged: boolean;
  supports_zdr: boolean;
  contextLength: number;
  capabilityFlags: string[];
  controls: any[];
}

export interface QuotaInfo {
  usedToday: number;
  dailyLimit: number;
  isEstimated: boolean;
  updatedAt: number;
}

export const apiClient = {
  async createSession(modelId: string): Promise<string> {
    const res = await fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, mode: 'solo' })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create session: HTTP ${res.status}`);
    }
    const body = await res.json();
    return body.sessionId;
  },

  async getModels(apiKey: string): Promise<{ models: ModelInfo[]; snapshotTs: number; unavailableModels: string[] }> {
    const res = await fetch(`${API_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch models: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getQuota(): Promise<QuotaInfo> {
    const res = await fetch(`${API_BASE}/quota`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch quota: HTTP ${res.status}`);
    }
    return res.json();
  },

  async getSessionMessages(sessionId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/session/${sessionId}/messages`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch messages: HTTP ${res.status}`);
    }
    const body = await res.json();
    return body.messages || [];
  },

  async getSessions(): Promise<{ id: string; ts: number }[]> {
    const res = await fetch(`${API_BASE}/sessions`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch sessions: HTTP ${res.status}`);
    }
    const body = await res.json();
    return body.sessions || [];
  },

  async recordEvent(sessionId: string, eventType: string, apiCalls: number): Promise<void> {
    const res = await fetch(`${API_BASE}/session/${sessionId}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, apiCalls })
    });
    if (!res.ok) {
      console.warn('Failed to log telemetry event');
    }
  },

  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async dispatchStream(
    sessionId: string,
    messages: any[],
    settings: any,
    apiKey: string,
    onToken: (token: string) => void
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ sessionId, messages, settings })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('ReadableStream is not supported by response');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            const text = parsed.choices?.[0]?.delta?.content || '';
            onToken(text);
          } catch (e: any) {
            if (e.message) throw e;
          }
        }
      }
    }
  }
};
