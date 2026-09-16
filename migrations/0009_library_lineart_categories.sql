ALTER TABLE user_lineart_library ADD COLUMN category_id TEXT NOT NULL DEFAULT 'ringo-mikan-lemon';

UPDATE user_lineart_library
SET category_id = (
  SELECT uploaded_linearts.category_id
  FROM uploaded_linearts
  WHERE uploaded_linearts.id = user_lineart_library.lineart_id
)
WHERE category_id = 'ringo-mikan-lemon'
  AND EXISTS (
    SELECT 1
    FROM uploaded_linearts
    WHERE uploaded_linearts.id = user_lineart_library.lineart_id
  );

CREATE INDEX IF NOT EXISTS user_lineart_library_category_idx ON user_lineart_library(user_id, category_id, created_at DESC);
