import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getMigrationVersion(fileName: string): number {
  const match = fileName.match(/^(\d+)/);
  if (!match) {
    throw new Error(`[Migrations] Migration file is missing a numeric prefix: ${fileName}`);
  }
  return parseInt(match[1], 10);
}

export function runMigrations() {
  console.log('[Migrations] Running migrations...');
  
  // Ensure migrations tracking table exists
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

  const migrationsDir = path.resolve(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error(`[Migrations] Migrations directory not found at: ${migrationsDir}`);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = getMigrationVersion(file);
    const checkStmt = db.prepare('SELECT name FROM migrations WHERE name = ?');
    const versionStmt = db.prepare('SELECT version, name, applied_at FROM schema_version WHERE version = ? OR name = ?');
    const alreadyApplied = checkStmt.get(file);
    const trackedVersion = versionStmt.get(version, file) as { version: number; name: string; applied_at: number } | undefined;

    if (alreadyApplied || trackedVersion) {
      if (!alreadyApplied && trackedVersion) {
        db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')
          .run(file, trackedVersion.applied_at);
      }
      if (!trackedVersion && alreadyApplied) {
        db.prepare('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)')
          .run(version, file, Date.now());
      }
      console.log(`[Migrations] Skipping already applied migration: ${file}`);
      continue;
    }

    console.log(`[Migrations] Applying migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      const appliedAt = Date.now();
      db.exec(sql);
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(file, appliedAt);
      db.prepare('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)').run(version, file, appliedAt);
      console.log(`[Migrations] Successfully applied: ${file}`);
    } catch (err) {
      console.error(`[Migrations] Error applying migration ${file}:`, err);
      throw err;
    }
  }

  console.log('[Migrations] All migrations verified successfully.');
}
