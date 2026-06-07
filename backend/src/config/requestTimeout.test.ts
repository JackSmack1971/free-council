import { describe, test } from 'node:test';
import assert from 'node:assert';
import { getRequestTimeoutMs } from './requestTimeout.js';

describe('requestTimeout', () => {
  test('uses the default timeout when REQUEST_TIMEOUT_MS is unset', () => {
    assert.strictEqual(getRequestTimeoutMs(undefined), 30000);
  });

  test('uses REQUEST_TIMEOUT_MS when provided', () => {
    assert.strictEqual(getRequestTimeoutMs('60000'), 60000);
  });

  test('falls back to the default timeout for invalid values', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message?: any) => {
      warnings.push(String(message));
    };

    try {
      assert.strictEqual(getRequestTimeoutMs('not-a-number'), 30000);
      assert.strictEqual(getRequestTimeoutMs('0'), 30000);
      assert.strictEqual(getRequestTimeoutMs('60s'), 30000);
    } finally {
      console.warn = originalWarn;
    }

    assert.strictEqual(warnings.length, 3);
    assert.ok(warnings.some((warning) => warning.includes('REQUEST_TIMEOUT_MS "60s"')));
  });
});
