import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { runMigrations } from './migrationRunner.js';
import { db } from './connection.js';
import { recordException, verifyExceptionChain, PolicyException } from './policyExceptionsRepo.js';

describe('policyExceptionsRepo tests', () => {
  before(() => {
    // Run migrations to ensure policy_exceptions table is created
    runMigrations();
    // Clear out table for clean test state
    db.exec('DELETE FROM policy_exceptions');
  });

  after(() => {
    // Clean up
    db.exec('DELETE FROM policy_exceptions');
  });

  test('should record policy exceptions and compute valid hash chain', () => {
    const exception1 = recordException({
      ts: 1716200000000,
      violation_type: 'FREE_LOCK_VIOLATION',
      model_id: 'openai/gpt-4o',
      user_action: 'BLOCK',
      session_id: 'session-xyz-123',
      details_json: JSON.stringify({ reason: 'Free lock is enabled' })
    });

    assert.ok(exception1.id);
    assert.strictEqual(exception1.previous_hash, null);
    assert.ok(exception1.hash);
    
    // Check in database directly
    const row1 = db.prepare('SELECT * FROM policy_exceptions WHERE id = ?').get(exception1.id) as any;
    assert.ok(row1);
    assert.strictEqual(row1.previous_hash, '');
    assert.strictEqual(row1.hash, exception1.hash);

    // Record a second exception, should link to first
    const exception2 = recordException({
      ts: 1716200010000,
      violation_type: 'API_KEY_MISSING',
      model_id: null,
      user_action: 'WARN',
      session_id: 'session-xyz-123',
      details_json: null
    });

    assert.ok(exception2.id);
    assert.strictEqual(exception2.previous_hash, exception1.hash);
    assert.ok(exception2.hash);

    // Check direct in DB
    const row2 = db.prepare('SELECT * FROM policy_exceptions WHERE id = ?').get(exception2.id) as any;
    assert.ok(row2);
    assert.strictEqual(row2.previous_hash, exception1.hash);
    assert.strictEqual(row2.hash, exception2.hash);

    // Verify exception chain holds
    const verification = verifyExceptionChain();
    assert.strictEqual(verification.isValid, true);
  });

  test('should detect tampering if hash chain is mutated', () => {
    // Record a third exception
    const exception3 = recordException({
      ts: 1716200020000,
      violation_type: 'AGENT_CAP_VIOLATION',
      model_id: 'google/gemini-pro',
      user_action: 'TRUNCATE',
      session_id: 'session-xyz-123',
      details_json: JSON.stringify({ count: 6 })
    });

    assert.strictEqual(verifyExceptionChain().isValid, true);

    // Tamper with record 2 details in database
    db.prepare("UPDATE policy_exceptions SET violation_type = 'TAMPERED' WHERE violation_type = ?").run('API_KEY_MISSING');

    // Verification should now detect the broken chain
    const verification = verifyExceptionChain();
    assert.strictEqual(verification.isValid, false);
    assert.ok(verification.brokenId);
  });
});
