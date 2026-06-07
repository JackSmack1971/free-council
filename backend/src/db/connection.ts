import { DatabaseSync } from 'node:sqlite';
import { resolveDbPath } from './resolveDbPath.js';

const dbPath = resolveDbPath();

export const db = new DatabaseSync(dbPath);

// Optimize database for concurrency and resilience
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

console.log(`[Database] Connected to SQLite database at: ${dbPath}`);

export function checkpointDatabase(): void {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
}

export function closeDatabase(): void {
  db.close();
}
