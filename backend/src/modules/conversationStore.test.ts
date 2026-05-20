import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { ConversationStore } from './conversationStore.js';
import { runMigrations } from '../db/migrationRunner.js';

describe('ConversationStore Tests', () => {
  before(() => {
    runMigrations();
  });

  test('should save and retrieve conversations successfully', () => {
    const sessionId = 'test-session-conv-' + Date.now();
    const messages = [
      { role: 'user', content: 'Hello there!' },
      { role: 'assistant', content: 'Hi! How can I help you?' }
    ];

    ConversationStore.saveConversation(sessionId, messages);

    const retrieved = ConversationStore.getConversation(sessionId);
    assert.deepEqual(retrieved, messages);
  });

  test('should return null for non-existent session ID', () => {
    const retrieved = ConversationStore.getConversation('non-existent-session-id');
    assert.strictEqual(retrieved, null);
  });
});
