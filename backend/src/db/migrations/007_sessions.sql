CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_last_activity
  ON sessions(last_activity);
