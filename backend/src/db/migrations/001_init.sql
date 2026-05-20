CREATE TABLE IF NOT EXISTS conversations (
  id           TEXT    PRIMARY KEY,
  ts           INTEGER NOT NULL,
  messages_json TEXT
);

CREATE TABLE IF NOT EXISTS model_snapshots (
  snapshot_ts        INTEGER PRIMARY KEY,
  models_json        TEXT,
  card_summaries_json TEXT
);
