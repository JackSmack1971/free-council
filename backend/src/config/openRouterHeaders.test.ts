import { describe, test } from 'node:test';
import assert from 'node:assert';
import { getOpenRouterHttpReferer } from './openRouterHeaders.js';

describe('openRouterHeaders', () => {
  test('uses localhost default when FRONTEND_URL is unset', () => {
    assert.strictEqual(getOpenRouterHttpReferer(undefined), 'http://localhost:3000');
  });

  test('uses FRONTEND_URL when provided', () => {
    assert.strictEqual(getOpenRouterHttpReferer('https://example.com'), 'https://example.com');
  });

  test('ignores blank FRONTEND_URL values', () => {
    assert.strictEqual(getOpenRouterHttpReferer('   '), 'http://localhost:3000');
  });
});
