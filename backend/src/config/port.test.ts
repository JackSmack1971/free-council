import { describe, test } from 'node:test';
import assert from 'node:assert';
import { resolvePort } from './port.js';

describe('port', () => {
  test('uses the default port when PORT is unset', () => {
    assert.strictEqual(resolvePort(undefined), 3001);
  });

  test('uses PORT when provided', () => {
    assert.strictEqual(resolvePort('3002'), 3002);
  });

  test('throws a clear error for invalid PORT values', () => {
    assert.throws(
      () => resolvePort('abc'),
      /PORT must be an integer between 1 and 65535/
    );
    assert.throws(
      () => resolvePort('0'),
      /PORT must be an integer between 1 and 65535/
    );
  });
});
