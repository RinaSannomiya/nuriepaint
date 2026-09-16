ALTER TABLE uploaded_linearts ADD COLUMN category_id TEXT NOT NULL DEFAULT 'ringo-mikan-lemon';
ALTER TABLE uploaded_linearts ADD COLUMN is_learning INTEGER NOT NULL DEFAULT 0;
ALTER TABLE uploaded_linearts ADD COLUMN reference_object_key TEXT;
ALTER TABLE uploaded_linearts ADD COLUMN reference_content_type TEXT;

CREATE INDEX IF NOT EXISTS uploaded_linearts_category_created_idx ON uploaded_linearts(category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS uploaded_linearts_learning_category_idx ON uploaded_linearts(is_learning, category_id, created_at DESC);
