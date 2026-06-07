import { before, describe, test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './connection.js';
import { runMigrations } from './migrationRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('migrationRunner', () => {
  before(() => {
    const migrationFiles = fs.readdirSync(path.resolve(__dirname, 'migrations'))
      .filter(file => file.endsWith('.sql'))
      .sort();

    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        name TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
    `);

    for (const file of migrationFiles) {
      const version = parseInt(file.split('_', 1)[0], 10);
      const appliedAt = Date.now();
      db.prepare('INSERT OR IGNORE INTO migrations (name, applied_at) VALUES (?, ?)').run(file, appliedAt);
      db.prepare('INSERT OR IGNORE INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)').run(version, file, appliedAt);
    }
  });

  test('tracks applied migrations in schema_version across repeat runs', () => {
    db.prepare('DELETE FROM schema_version').run();

    runMigrations();
    runMigrations();

    const migrationFiles = fs.readdirSync(path.resolve(__dirname, 'migrations'))
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrationCount = (db.prepare('SELECT COUNT(*) AS count FROM migrations').get() as { count: number }).count;
    const schemaVersionRows = db.prepare('SELECT version, name FROM schema_version ORDER BY version').all() as Array<{ version: number; name: string }>;

    assert.strictEqual(migrationCount, migrationFiles.length);
    assert.strictEqual(schemaVersionRows.length, migrationFiles.length);
    assert.deepStrictEqual(
      schemaVersionRows.map(row => row.name),
      migrationFiles
    );
    assert.deepStrictEqual(
      schemaVersionRows.map(row => row.version),
      migrationFiles.map(file => parseInt(file.split('_', 1)[0], 10))
    );
  });
});
