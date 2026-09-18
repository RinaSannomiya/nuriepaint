// Resend の HTTP API でメールを送る（Cloudflare Workers からは SMTP が使えないため）。
// RESEND_API_KEY は秘密情報（.dev.vars / wrangler secret）、MAIL_FROM は wrangler.jsonc の vars で設定する。

export type MailEnv = {
  RESEND_API_KEY?: string
  MAIL_FROM?: string
}

type MailMessage = {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendMail(env: MailEnv, message: MailMessage) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    throw new Error('メール送信の設定（RESEND_API_KEY / MAIL_FROM）がありません')
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend の送信に失敗しました (${res.status}): ${detail}`)
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function layout(bodyHtml: string) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#333;line-height:1.7">
<h1 style="font-size:18px;margin:0 0 16px">ぬりえペイント</h1>
${bodyHtml}
<p style="margin-top:24px;font-size:12px;color:#888">このメールに心当たりがない場合は、そのまま破棄してください。</p>
</div>`
}

export function verificationEmail(url: string) {
  return {
    subject: '【ぬりえペイント】メールアドレスの確認',
    text: [
      'ぬりえペイントをご利用いただきありがとうございます。',
      '下のリンクを開くと、メールアドレスの確認が完了します。',
      '',
      url,
      '',
      'リンクの有効期限は24時間です。',
      'このメールに心当たりがない場合は、そのまま破棄してください。',
    ].join('\n'),
    html: layout(`<p>ぬりえペイントをご利用いただきありがとうございます。<br>下のボタンを開くと、メールアドレスの確認が完了します。</p>
<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background:#ff6b5b;color:#fff;text-decoration:none;border-radius:999px;font-weight:bold">メールアドレスを確認する</a></p>
<p style="font-size:13px;color:#666">ボタンが開けない場合は、次のリンクをブラウザに貼り付けてください。<br><a href="${escapeHtml(url)}" style="color:#666;word-break:break-all">${escapeHtml(url)}</a></p>
<p style="font-size:13px;color:#666">リンクの有効期限は24時間です。</p>`),
  }
}

export function existingAccountEmail(siteUrl: string) {
  return {
    subject: '【ぬりえペイント】すでに登録されているメールアドレスです',
    text: [
      'このメールアドレスでアカウント作成のお申し込みがありましたが、すでにアカウントが登録されています。',
      '下のリンクからログインしてください。',
      '',
      siteUrl,
      '',
      'このメールに心当たりがない場合は、そのまま破棄してください。',
    ].join('\n'),
    html: layout(`<p>このメールアドレスでアカウント作成のお申し込みがありましたが、すでにアカウントが登録されています。</p>
<p style="margin:24px 0"><a href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:12px 24px;background:#ff6b5b;color:#fff;text-decoration:none;border-radius:999px;font-weight:bold">ログインしにいく</a></p>`),
  }
}
