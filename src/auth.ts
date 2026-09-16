import { betterAuth } from 'better-auth'
import { withCloudflare } from 'better-auth-cloudflare'

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
}

export function createAuth(env: Env, request: Request) {
  return betterAuth({
    baseURL: new URL(request.url).origin,
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
        },
        user: {
          changeEmail: {
            enabled: true,
            updateEmailWithoutVerification: true,
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
