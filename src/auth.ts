import { betterAuth } from 'better-auth'
import { withCloudflare } from 'better-auth-cloudflare'
import { existingAccountEmail, passwordResetEmail, sendMail, verificationEmail } from './mail'

export type Env = {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>
  }
  DB: {
    prepare: (query: string) => {
      bind: (...values: unknown[]) => {
        all: <T = unknown>() => Promise<{ results?: T[] }>
        first: <T = unknown>() => Promise<T | null>
        run: () => Promise<unknown>
      }
    }
  }
  ARTWORKS: {
    put: (
      key: string,
      value: ArrayBuffer | Blob | string | null,
      options?: { httpMetadata?: { contentType?: string } },
    ) => Promise<unknown>
    get: (key: string) => Promise<{
      body: BodyInit | null
      httpMetadata?: { contentType?: string }
    } | null>
    delete: (key: string) => Promise<unknown>
  }
  BETTER_AUTH_SECRET: string
  RESEND_API_KEY: string
  MAIL_FROM: string
}

// 認証メールのリンクを開いたあとに戻ってくる画面の目印（App.tsx の readVerifyRedirect と対応）
const VERIFY_DONE_CALLBACK = '/?verify=done'
// パスワード再設定メールのリンクを開いたあとに戻ってくる画面の目印（App.tsx の readVerifyRedirect と対応）
const RESET_PASSWORD_CALLBACK = '/?reset=1'

export function createAuth(env: Env, request: Request) {
  const origin = new URL(request.url).origin

  return betterAuth({
    baseURL: origin,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    ...withCloudflare(
      {
        autoDetectIpAddress: false,
        geolocationTracking: false,
        d1Native: env.DB as never,
      },
      {
        emailAndPassword: {
          enabled: true,
          // メール認証が済むまでログインできない
          requireEmailVerification: true,
          // すでに認証済みのメールアドレスで登録しようとした場合は、その旨をメールで知らせる
          // （画面上は「確認メールを送りました」と同じ表示にして、登録済みかどうかを外から分からなくする）
          onExistingUserSignUp: async ({ user }) => {
            if (!user.emailVerified) return
            const mail = existingAccountEmail(origin)
            await sendMail(env, { to: user.email, ...mail })
          },
          // パスワードの再設定は、登録メールアドレスに届くリンクから行う（リンクの有効期限は1時間）
          resetPasswordTokenExpiresIn: 60 * 60,
          // 再設定したら、ほかの端末のログインはいったん解除する
          revokeSessionsOnPasswordReset: true,
          sendResetPassword: async ({ user, url }) => {
            const link = new URL(url)
            // 戻り先が指定されていない場合も「新しいパスワードを入力する画面」に戻す
            if (!link.searchParams.get('callbackURL')) {
              link.searchParams.set('callbackURL', RESET_PASSWORD_CALLBACK)
            }
            const mail = passwordResetEmail(link.toString())
            await sendMail(env, { to: user.email, ...mail })
          },
        },
        emailVerification: {
          sendOnSignUp: true,
          // 未認証のままログインしようとしたとき（パスワードが合っている場合だけ）確認メールを再送する
          sendOnSignIn: true,
          // リンクを開いたらそのままログイン状態にする
          autoSignInAfterVerification: true,
          expiresIn: 60 * 60 * 24,
          sendVerificationEmail: async ({ user, url }) => {
            const link = new URL(url)
            // callbackURL が指定されていない（既定の "/"）場合は「アカウントが作成できました」画面に戻す
            if (link.searchParams.get('callbackURL') === '/') {
              link.searchParams.set('callbackURL', VERIFY_DONE_CALLBACK)
            }
            const mail = verificationEmail(link.toString())
            await sendMail(env, { to: user.email, ...mail })
          },
        },
        user: {
          changeEmail: {
            // 認証済みのユーザーは、新しいメールアドレスに届くリンクを開いて初めて変更が反映される
            enabled: true,
          },
        },
        advanced: {
          database: {
            validateSchema: false,
          },
        },
      },
    ),
  })
}
