-- メール認証を必須にする前に登録済みのユーザーは、認証済みとして扱う。
-- これを適用しないと、既存ユーザーがログインできなくなる。
UPDATE user SET emailVerified = 1 WHERE emailVerified = 0;
