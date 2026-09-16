CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  motif_id TEXT NOT NULL,
  icon_color TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
