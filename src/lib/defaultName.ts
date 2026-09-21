// ニックネームを決めなかったときに付ける、デフォルトのなまえ（例: ぬりえペインター4821）。
// メールアドレスの「@より前」は、ひろげるページの「○○ さん」などで他の人にも見えてしまうので、
// 名前には一切使わない。画面（App.tsx）とサーバー（worker.ts / auth.ts）の両方から使う。
export const DEFAULT_NAME_PREFIX = 'ぬりえペインター'

export function generateDefaultName(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000
  return `${DEFAULT_NAME_PREFIX}${String(n).padStart(4, '0')}`
}

// 名前が空、またはメールアドレスの「@より前」と同じなら、デフォルトのなまえに置き換える。
export function safeDefaultName(name: unknown, email: string): string {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  const local = email.split('@')[0].trim().toLowerCase()
  if (!trimmed || trimmed.toLowerCase() === local) return generateDefaultName()
  return trimmed
}
