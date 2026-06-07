import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildCorsOptions, isCorsOriginAllowed, parseCorsOrigins } from './corsOptions.js';

describe('corsOptions', () => {
  test('uses configured origins when CORS_ORIGINS is set', () => {
    const origins = parseCorsOrigins({
      CORS_ORIGINS: 'https://app.example.com, https://staging.example.com'
    });

    assert.deepEqual(origins, ['https://app.example.com', 'https://staging.example.com']);
  });

  test('falls back to localhost during local development', () => {
    const origins = parseCorsOrigins({});

    assert.deepEqual(origins, ['http://localhost:3000']);
  });

  test('allows requests from configured origins', () => {
    assert.equal(
      isCorsOriginAllowed('https://app.example.com', ['https://app.example.com']),
      true
    );
  });

  test('rejects requests from unconfigured origins', () => {
    assert.equal(
      isCorsOriginAllowed('https://evil.example.com', ['https://app.example.com']),
      false
    );
  });

  test('treats missing origin as allowed for non-browser clients', async () => {
    const options = buildCorsOptions({
      CORS_ORIGINS: 'https://app.example.com'
    });
    const originHandler = options.origin;

    assert.equal(typeof originHandler, 'function');
    if (typeof originHandler !== 'function') {
      throw new Error('Expected CORS origin handler to be a function.');
    }

    const invokeOrigin = originHandler as (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void
    ) => void;

    await new Promise<void>((resolve, reject) => {
      invokeOrigin(undefined, (error: Error | null, allowed?: boolean) => {
        try {
          assert.equal(error, null);
          assert.equal(allowed, true);
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      });
    });
  });
});
