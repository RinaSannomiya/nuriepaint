ALTER TABLE uploaded_linearts ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE uploaded_linearts ADD COLUMN published_at TEXT;

CREATE INDEX IF NOT EXISTS uploaded_linearts_public_created_idx ON uploaded_linearts(is_public, created_at DESC);

CREATE TABLE IF NOT EXISTS user_lineart_library (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  lineart_id TEXT NOT NULL REFERENCES uploaded_linearts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, lineart_id)
);

CREATE INDEX IF NOT EXISTS user_lineart_library_user_created_idx ON user_lineart_library(user_id, created_at DESC);
