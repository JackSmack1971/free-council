CREATE TABLE uploaded_file_chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  start_char INTEGER NOT NULL,
  end_char INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE VIRTUAL TABLE uploaded_file_chunks_fts USING fts5(
  chunk_id,
  file_id,
  content
);
