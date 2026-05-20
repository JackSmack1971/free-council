CREATE TABLE uploaded_files (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  fts_indexed INTEGER NOT NULL DEFAULT 0,
  ts INTEGER NOT NULL
);
