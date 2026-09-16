ALTER TABLE colorings ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE colorings ADD COLUMN published_at TEXT;

CREATE INDEX IF NOT EXISTS colorings_public_updated_idx ON colorings(is_public, updated_at DESC);

CREATE TABLE IF NOT EXISTS uploaded_linearts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS uploaded_linearts_user_created_idx ON uploaded_linearts(user_id, created_at DESC);
