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

    // Verify policy exception recorded
    const excStmt = db.prepare('SELECT * FROM policy_exceptions WHERE session_id = ? AND violation_type = ?');
    const excRow = excStmt.get(sessionId, 'API_KEY_MISSING');
    assert.ok(excRow);
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

    // Verify policy exception recorded
    const excStmt = db.prepare('SELECT * FROM policy_exceptions WHERE session_id = ? AND violation_type = ?');
    const excRow = excStmt.get(sessionId, 'FREE_LOCK_VIOLATION');
    assert.ok(excRow);
  });

  test('should return PRIVACY_DISCLOSURE_PENDING if provider logged and not acknowledged', () => {
    const sessionId = 'test-session-' + Date.now();
    const context = {
      modelId: 'some-provider-logged-model',
      isProviderLogged: true,
      isFreeModel: true,
      apiKeyPresent: true,
      freeLockEnabled: false,
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
    assert.strictEqual(res.violation, 'PRIVACY_DISCLOSURE_PENDING');

    const excStmt = db.prepare('SELECT * FROM policy_exceptions WHERE session_id = ? AND violation_type = ?');
    const excRow = excStmt.get(sessionId, 'PRIVACY_DISCLOSURE_PENDING');
    assert.ok(excRow);

    const telStmt = db.prepare('SELECT * FROM session_events WHERE session_id = ? AND event_type = ?');
    const telRow = telStmt.get(sessionId, 'privacy_disclosure_pending');
    assert.ok(telRow);
  });

  test('should return ZDR_REQUIRED_UNAVAILABLE if zdr is required but model does not support it', () => {
    const sessionId = 'test-session-' + Date.now();
    const context = {
      modelId: 'some-model',
      isProviderLogged: false,
      isFreeModel: true,
      apiKeyPresent: true,
      freeLockEnabled: false,
      activeAgentCount: 1,
      requestedApiCalls: 1,
      promptClass: 'simple' as const,
      privacyDisclosureAcknowledged: true,
      zdrRequired: true,
      modelSupportsZdr: false,
      containsUpload: false,
      uploadDisclosureAcknowledged: false,
      sessionId
    };

    const res = PreflightGate.check(context);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.violation, 'ZDR_REQUIRED_UNAVAILABLE');

    const excStmt = db.prepare('SELECT * FROM policy_exceptions WHERE session_id = ? AND violation_type = ?');
    const excRow = excStmt.get(sessionId, 'ZDR_REQUIRED_UNAVAILABLE');
    assert.ok(excRow);
  });

  test('should return BUDGET_VIOLATION if simple prompt tries to make multi-agent calls and not escalated', () => {
    const sessionId = 'test-session-' + Date.now();
    const context = {
      modelId: 'some-model',
      isProviderLogged: false,
      isFreeModel: true,
      apiKeyPresent: true,
      freeLockEnabled: false,
      activeAgentCount: 1,
      requestedApiCalls: 2, // multi-agent call for simple prompt!
      promptClass: 'simple' as const,
      privacyDisclosureAcknowledged: true,
      zdrRequired: false,
      modelSupportsZdr: true,
      containsUpload: false,
      uploadDisclosureAcknowledged: false,
      sessionId,
      budgetEscalated: false
    };

    const res = PreflightGate.check(context);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.violation, 'BUDGET_VIOLATION');

    const excStmt = db.prepare('SELECT * FROM policy_exceptions WHERE session_id = ? AND violation_type = ?');
    const excRow = excStmt.get(sessionId, 'BUDGET_VIOLATION');
    assert.ok(excRow);
  });

  test('should allow BUDGET_VIOLATION triggers if escalated', () => {
    const sessionId = 'test-session-' + Date.now();
    const context = {
      modelId: 'some-model',
      isProviderLogged: false,
      isFreeModel: true,
      apiKeyPresent: true,
      freeLockEnabled: false,
      activeAgentCount: 1,
      requestedApiCalls: 6, // > 5 calls
      promptClass: 'non_trivial' as const,
      privacyDisclosureAcknowledged: true,
      zdrRequired: false,
      modelSupportsZdr: true,
      containsUpload: false,
      uploadDisclosureAcknowledged: false,
      sessionId,
      budgetEscalated: true // explicitly escalated!
    };

    const res = PreflightGate.check(context);
    assert.strictEqual(res.allowed, true);
  });

  test('should return AGGREGATOR_ROLE_CONFLICT if aggregator model is inside proposers list', () => {
    const sessionId = 'test-session-' + Date.now();
    const context = {
      modelId: 'some-model',
      isProviderLogged: false,
      isFreeModel: true,
      apiKeyPresent: true,
      freeLockEnabled: false,
      activeAgentCount: 1,
      requestedApiCalls: 1,
      promptClass: 'simple' as const,
      privacyDisclosureAcknowledged: true,
      zdrRequired: false,
      modelSupportsZdr: true,
      containsUpload: false,
      uploadDisclosureAcknowledged: false,
      sessionId,
      aggregatorModelId: 'google/gemini-2.5-flash',
      proposerModelIds: ['google/gemini-2.5-flash', 'qwen/qwen-2.5-72b-instruct:free']
    };

    const res = PreflightGate.check(context);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.violation, 'AGGREGATOR_ROLE_CONFLICT');
    assert.ok(res.reassignedModelId);
    assert.notStrictEqual(res.reassignedModelId, 'google/gemini-2.5-flash');

    const excStmt = db.prepare('SELECT * FROM policy_exceptions WHERE session_id = ? AND violation_type = ?');
    const excRow = excStmt.get(sessionId, 'AGGREGATOR_ROLE_CONFLICT');
    assert.ok(excRow);
  });

  test('should return AGENT_CAP_VIOLATION but return allowed: true if planned agents > 5', () => {
    const sessionId = 'test-session-' + Date.now();
    const context = {
      modelId: 'some-model',
      isProviderLogged: false,
      isFreeModel: true,
      apiKeyPresent: true,
      freeLockEnabled: false,
      activeAgentCount: 6, // > 5 agents!
      requestedApiCalls: 1,
      promptClass: 'non_trivial' as const,
      privacyDisclosureAcknowledged: true,
      zdrRequired: false,
      modelSupportsZdr: true,
      containsUpload: false,
      uploadDisclosureAcknowledged: false,
      sessionId
    };

    const res = PreflightGate.check(context);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.violation, 'AGENT_CAP_VIOLATION');

    const excStmt = db.prepare('SELECT * FROM policy_exceptions WHERE session_id = ? AND violation_type = ?');
    const excRow = excStmt.get(sessionId, 'AGENT_CAP_VIOLATION');
    assert.ok(excRow);
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
