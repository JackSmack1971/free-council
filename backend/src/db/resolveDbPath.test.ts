import assert from 'node:assert/strict';
import path from 'path';
import { describe, test } from 'node:test';

import { resolveDbPath } from './resolveDbPath.js';

describe('resolveDbPath', () => {
  test('uses DATABASE_PATH when configured', () => {
    const dbPath = resolveDbPath({
      DATABASE_PATH: './data/test.db'
    });

    assert.equal(dbPath, path.resolve('./data/test.db'));
  });

  test('falls back to the repository root database path', () => {
    const dbPath = resolveDbPath({}, 'C:/repo/backend/src/db');

    assert.equal(dbPath, path.resolve('C:/repo/free_council.db'));
  });
});
