import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations() {
  console.log('[Migrations] Running migrations...');
  
  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
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
    const checkStmt = db.prepare('SELECT name FROM migrations WHERE name = ?');
    const alreadyApplied = checkStmt.get(file);

    if (alreadyApplied) {
      console.log(`[Migrations] Skipping already applied migration: ${file}`);
      continue;
    }

    console.log(`[Migrations] Applying migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      // Run the migration
      db.exec(sql);

      // Record that migration has been applied
      const insertStmt = db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)');
      insertStmt.run(file, Date.now());
      console.log(`[Migrations] Successfully applied: ${file}`);
    } catch (err) {
      console.error(`[Migrations] Error applying migration ${file}:`, err);
      throw err;
    }
  }

  console.log('[Migrations] All migrations verified successfully.');
}
