-- セーフティーロック（オンのあいだは、ぬりえのアップロード時にアカウントのパスワードが必要）
CREATE TABLE IF NOT EXISTS user_safety_lock (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,
  -- パスワードを続けて間違えた回数（一定回数でしばらく試せなくする）
  failed_count INTEGER NOT NULL DEFAULT 0,
  -- この時刻（ミリ秒）まではパスワードの確認ができない
  locked_until INTEGER,
  updated_at TEXT NOT NULL
);
