CREATE TABLE IF NOT EXISTS user_palette_settings (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  swatches_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
