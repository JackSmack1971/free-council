CREATE TABLE IF NOT EXISTS policy_exceptions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ts             INTEGER NOT NULL,
  violation_type TEXT    NOT NULL,
  model_id       TEXT,
  user_action    TEXT    NOT NULL,
  session_id     TEXT    NOT NULL,
  details_json   TEXT,
  previous_hash  TEXT,
  hash           TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_exceptions_session
  ON policy_exceptions(session_id);

CREATE INDEX IF NOT EXISTS idx_policy_exceptions_ts
  ON policy_exceptions(ts);
