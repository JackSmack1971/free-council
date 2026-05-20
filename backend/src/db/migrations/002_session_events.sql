CREATE TABLE IF NOT EXISTS session_events (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id           TEXT    NOT NULL,
  event_type           TEXT    NOT NULL,
  agent_count          INTEGER,
  api_calls            INTEGER,
  edge_matrix_json     TEXT,
  layer_count          INTEGER,
  proposer_models_json TEXT,
  aggregation_calls    INTEGER,
  synthesis_rationale  TEXT,
  synthesis_quality    INTEGER,
  ts                   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_events_type_ts
  ON session_events(event_type, ts);

CREATE INDEX IF NOT EXISTS idx_session_events_session_ts
  ON session_events(session_id, ts);
