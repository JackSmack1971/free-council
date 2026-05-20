import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { PreflightGate } from './preflightGate.js';
import { runMigrations } from '../db/migrationRunner.js';
import { db } from '../db/connection.js';

describe('PreflightGate Tests', () => {
  before(() => {
    runMigrations();
  });

  test('should return API_KEY_MISSING if api key is not present', () => {
    const sessionId = 'test-session-' + Date.now();
    const context = {
      modelId: 'openai/gpt-oss-120b:free',
      isProviderLogged: false,
      isFreeModel: true,
      apiKeyPresent: false,
      freeLockEnabled: true,
      activeAgentCount: 1,
      requestedApiCalls: 1,
      promptClass: 'simple' as const,
      privacyDisclosureAcknowledged: false,
      zdrRequired: false,
      modelSupportsZdr: false,
      containsUpload: false,
      uploadDisclosureAcknowledged: false,
      sessionId
    };

    const res = PreflightGate.check(context);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.violation, 'API_KEY_MISSING');

    // Verify telemetry recorded
    const stmt = db.prepare('SELECT * FROM session_events WHERE session_id = ? AND event_type = ?');
    const row = stmt.get(sessionId, 'api_key_missing');
    assert.ok(row);
  });

  test('should return FREE_LOCK_VIOLATION if lock is enabled and model is not free', () => {
    const sessionId = 'test-session-' + Date.now();
    const context = {
      modelId: 'openai/gpt-4o',
      isProviderLogged: false,
      isFreeModel: false,
      apiKeyPresent: true,
      freeLockEnabled: true,
      activeAgentCount: 1,
      requestedApiCalls: 1,
      promptClass: 'simple' as const,
      privacyDisclosureAcknowledged: false,
      zdrRequired: false,
      modelSupportsZdr: false,
      containsUpload: false,
      uploadDisclosureAcknowledged: false,
      sessionId
    };

    const res = PreflightGate.check(context);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.violation, 'FREE_LOCK_VIOLATION');
    assert.ok(res.reassignedModelId);

    // Verify telemetry recorded
    const stmt = db.prepare('SELECT * FROM session_events WHERE session_id = ? AND event_type = ?');
    const row = stmt.get(sessionId, 'free_lock_rejection');
    assert.ok(row);
  });

  test('should return allowed: true if all checks pass', () => {
    const sessionId = 'test-session-' + Date.now();
    const context = {
      modelId: 'openai/gpt-oss-120b:free',
      isProviderLogged: false,
      isFreeModel: true,
      apiKeyPresent: true,
      freeLockEnabled: true,
      activeAgentCount: 1,
      requestedApiCalls: 1,
      promptClass: 'simple' as const,
      privacyDisclosureAcknowledged: false,
      zdrRequired: false,
      modelSupportsZdr: false,
      containsUpload: false,
      uploadDisclosureAcknowledged: false,
      sessionId
    };

    const res = PreflightGate.check(context);
    assert.strictEqual(res.allowed, true);
  });
});
