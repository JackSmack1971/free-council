import { describe, test } from 'node:test';
import assert from 'node:assert';
import { getDailyApiQuotaLimit } from './dailyQuota.js';

describe('dailyQuota', () => {
  test('uses the default quota when DAILY_API_QUOTA is unset', () => {
    assert.strictEqual(getDailyApiQuotaLimit(undefined), 200);
  });

  test('uses DAILY_API_QUOTA when provided', () => {
    assert.strictEqual(getDailyApiQuotaLimit('50'), 50);
  });

  test('falls back to the default quota for invalid values', () => {
    assert.strictEqual(getDailyApiQuotaLimit('not-a-number'), 200);
    assert.strictEqual(getDailyApiQuotaLimit('0'), 200);
  });
});
