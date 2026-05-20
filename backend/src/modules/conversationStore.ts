import { db } from '../db/connection.js';

export const ConversationStore = {
  saveConversation(sessionId: string, messages: any[]): void {
    const ts = Date.now();
    const messagesJson = JSON.stringify(messages);
    try {
      const stmt = db.prepare(`
        INSERT INTO conversations (id, ts, messages_json)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          ts = excluded.ts,
          messages_json = excluded.messages_json
      `);
      stmt.run(sessionId, ts, messagesJson);
      console.log(`[ConversationStore] Saved conversation for session '${sessionId}'`);
    } catch (err) {
      console.error(`[ConversationStore] Failed to save conversation:`, err);
    }
  },

  getConversation(sessionId: string): any[] | null {
    try {
      const stmt = db.prepare('SELECT messages_json FROM conversations WHERE id = ?');
      const row = stmt.get(sessionId) as { messages_json: string } | undefined;
      if (!row) return null;
      return JSON.parse(row.messages_json);
    } catch (err) {
      console.error(`[ConversationStore] Failed to retrieve conversation:`, err);
      return null;
    }
  }
};
