import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { resolveApiBase } from './api.js';

describe('resolveApiBase', () => {
  test('uses configured NEXT_PUBLIC_API_URL when provided', () => {
    const apiBase = resolveApiBase({
      NEXT_PUBLIC_API_URL: 'https://example.com/api/v1',
      NODE_ENV: 'production'
    });

    assert.equal(apiBase, 'https://example.com/api/v1');
  });

  test('uses localhost fallback in development when env is missing', () => {
    const apiBase = resolveApiBase({
      NODE_ENV: 'development'
    });

    assert.equal(apiBase, 'http://localhost:3001/api/v1');
  });

  test('uses relative API path in production when env is missing', () => {
    const apiBase = resolveApiBase({
      NODE_ENV: 'production'
    });

    assert.equal(apiBase, '/api/v1');
  });
});
