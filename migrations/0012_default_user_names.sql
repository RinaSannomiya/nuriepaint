-- 名前がメールアドレスの「@より前」のままになっているユーザーを、デフォルトのなまえ（ぬりえペインター＋4桁の数字）に置き換える。
-- （ひろげるページなどで「@より前」が他の人にも見えてしまっていたため）
UPDATE user
SET name = 'ぬりえペインター' || printf('%04d', abs(random()) % 10000)
WHERE instr(email, '@') > 1
  AND lower(trim(name)) = lower(substr(email, 1, instr(email, '@') - 1));
