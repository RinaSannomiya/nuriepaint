CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  illustration_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  matched INTEGER NOT NULL,
  missing INTEGER NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_created_idx ON quiz_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_user_illustration_idx ON quiz_attempts(user_id, illustration_id);
