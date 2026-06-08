import { db } from '../db/connection.js';

export interface SessionRecord {
  sessionId: string;
  modelId: string;
  mode: string;
  createdAt: number;
  lastActivity: number;
  ownerApiKeyHash?: string | null;
}

interface SessionRow {
  id: string;
  model_id: string;
  mode: string;
  created_at: number;
  last_activity: number;
  owner_api_key_hash?: string | null;
}

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function mapSessionRow(row: SessionRow | undefined): SessionRecord | null {
  if (!row) {
    return null;
  }

  return {
    sessionId: row.id,
    modelId: row.model_id,
    mode: row.mode,
    createdAt: row.created_at,
    lastActivity: row.last_activity,
    ownerApiKeyHash: row.owner_api_key_hash ?? null
  };
}

export const SessionStore = {
  createSession(
    sessionId: string,
    modelId: string,
    mode: string,
    ownerApiKeyHash: string | null = null,
    now = Date.now()
  ): SessionRecord {
    db.prepare(`
      INSERT INTO sessions (id, model_id, mode, created_at, last_activity, owner_api_key_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, modelId, mode, now, now, ownerApiKeyHash);

    return {
      sessionId,
      modelId,
      mode,
      createdAt: now,
      lastActivity: now,
      ownerApiKeyHash
    };
  },

  getSession(sessionId: string): SessionRecord | null {
    const row = db.prepare(`
      SELECT id, model_id, mode, created_at, last_activity, owner_api_key_hash
      FROM sessions
      WHERE id = ?
    `).get(sessionId) as SessionRow | undefined;

    return mapSessionRow(row);
  },

  touchSession(sessionId: string, now = Date.now()): void {
    db.prepare(`
      UPDATE sessions
      SET last_activity = ?
      WHERE id = ?
    `).run(now, sessionId);
  },

  updateSessionMode(sessionId: string, mode: string, now = Date.now()): SessionRecord | null {
    db.prepare(`
      UPDATE sessions
      SET mode = ?, last_activity = ?
      WHERE id = ?
    `).run(mode, now, sessionId);

    return this.getSession(sessionId);
  },

  deleteExpiredSessions(now = Date.now(), ttlMs = SESSION_TTL_MS): number {
    const cutoffTs = now - ttlMs;
    const result = db.prepare(`
      DELETE FROM sessions
      WHERE last_activity < ?
    `).run(cutoffTs);

    return Number(result.changes);
  }
};
