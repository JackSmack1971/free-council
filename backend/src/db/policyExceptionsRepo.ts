import crypto from 'crypto';
import { db } from './connection.js';

export interface PolicyException {
  id: number;
  ts: number;
  violation_type: string;
  model_id: string | null;
  user_action: string;
  session_id: string;
  details_json: string | null;
  previous_hash: string | null;
  hash: string;
}

/**
 * Record a policy exception in the database, appending it to the SHA-256 hash chain.
 */
export function recordException(params: {
  ts: number;
  violation_type: string;
  model_id: string | null;
  user_action: string;
  session_id: string;
  details_json: string | null;
}): PolicyException {
  // Retrieve the hash of the last recorded exception
  const lastRow = db.prepare('SELECT hash FROM policy_exceptions ORDER BY id DESC LIMIT 1').get() as { hash: string } | undefined;
  const previous_hash = lastRow ? lastRow.hash : '';

  // Compute hash: SHA-256(ts || violation_type || model_id || user_action || session_id || details_json || previous_hash)
  const msg = `${params.ts}${params.violation_type || ''}${params.model_id || ''}${params.user_action || ''}${params.session_id || ''}${params.details_json || ''}${previous_hash}`;
  const hash = crypto.createHash('sha256').update(msg).digest('hex');

  const insertStmt = db.prepare(`
    INSERT INTO policy_exceptions (ts, violation_type, model_id, user_action, session_id, details_json, previous_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    params.ts,
    params.violation_type,
    params.model_id,
    params.user_action,
    params.session_id,
    params.details_json,
    previous_hash,
    hash
  );

  const newIdRow = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };

  return {
    id: newIdRow.id,
    ts: params.ts,
    violation_type: params.violation_type,
    model_id: params.model_id,
    user_action: params.user_action,
    session_id: params.session_id,
    details_json: params.details_json,
    previous_hash: previous_hash || null,
    hash
  };
}

/**
 * Verify that the policy exceptions hash chain is fully intact.
 * Returns true if valid, or false and the ID of the tampered record.
 */
export function verifyExceptionChain(): { isValid: boolean; brokenId?: number } {
  const records = db.prepare('SELECT * FROM policy_exceptions ORDER BY id ASC').all() as unknown as PolicyException[];

  let expectedPrevHash = '';
  for (const record of records) {
    if ((record.previous_hash || '') !== expectedPrevHash) {
      return { isValid: false, brokenId: record.id };
    }

    const msg = `${record.ts}${record.violation_type || ''}${record.model_id || ''}${record.user_action || ''}${record.session_id || ''}${record.details_json || ''}${expectedPrevHash}`;
    const computedHash = crypto.createHash('sha256').update(msg).digest('hex');

    if (record.hash !== computedHash) {
      return { isValid: false, brokenId: record.id };
    }

    expectedPrevHash = record.hash;
  }

  return { isValid: true };
}
