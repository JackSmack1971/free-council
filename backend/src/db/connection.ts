import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store database at the root of the project
const dbPath = path.resolve(__dirname, '../../../free_council.db');

export const db = new DatabaseSync(dbPath);

// Optimize database for concurrency and resilience
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

console.log(`[Database] Connected to SQLite database at: ${dbPath}`);
