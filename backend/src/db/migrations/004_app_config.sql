CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_config (key, value) VALUES ('default_mode', 'council');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('council_reevaluated_after_ts', '0');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('demoted_by_retention', 'false');
