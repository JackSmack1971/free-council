import crypto from 'node:crypto';

export interface SessionState {
  sessionId: string;
  modelId: string;
  mode: string;
  ownerApiKeyHash: string;
}

const sessions = new Map<string, SessionState>();

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export const SessionRegistry = {
  createSession(sessionId: string, modelId: string, mode: string, apiKey: string): SessionState {
    const session: SessionState = {
      sessionId,
      modelId,
      mode,
      ownerApiKeyHash: hashApiKey(apiKey)
    };

    sessions.set(sessionId, session);
    return session;
  },

  getSession(sessionId: string): SessionState | null {
    return sessions.get(sessionId) ?? null;
  },

  listOwnedSessionIds(apiKey: string): string[] {
    const ownerHash = hashApiKey(apiKey);
    return Array.from(sessions.values())
      .filter((session) => session.ownerApiKeyHash === ownerHash)
      .map((session) => session.sessionId);
  },

  isOwnedBy(sessionId: string, apiKey: string): boolean {
    const session = sessions.get(sessionId);
    return !!session && session.ownerApiKeyHash === hashApiKey(apiKey);
  },

  updateMode(sessionId: string, mode: string): void {
    const session = sessions.get(sessionId);
    if (session) {
      session.mode = mode;
    }
  },

  clearForTests(): void {
    sessions.clear();
  }
};
