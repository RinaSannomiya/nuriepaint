import { verifyPassword } from 'better-auth/crypto'
import { createAuth, type Env } from './auth'
import { generateDefaultName } from './lib/defaultName'
import { LINEART_CATEGORY_IDS } from './illustrations/categoryIds'

type SessionUser = {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

type ColoringRow = {
  id: string
  title: string
  illustration_id: string
  object_key: string
  is_public: number
  published_at: string | null
  created_at: string
  updated_at: string
}

type PublicColoringRow = ColoringRow & {
  author_name: string | null
  author_image: string | null
  motif_id: string | null
  icon_color: string | null
}

type ProfileRow = {
  motif_id: string
  icon_color: string
  icon_object_key: string | null
  icon_content_type: string | null
  updated_at: string
}

type UploadedLineArtRow = {
  id: string
  title: string
  object_key: string
  content_type: string
  category_id: string
  is_learning: number
  reference_object_key: string | null
  reference_content_type: string | null
  is_public: number
  published_at: string | null
  created_at: string
}

type PublicLineArtRow = UploadedLineArtRow & {
  author_name: string | null
}

type LibraryLineArtRow = UploadedLineArtRow & {
  library_id: string
  added_at: string
  author_name: string | null
}

type PaletteSettingsRow = {
  swatches_json: string
  updated_at: string
}

type QuizAttemptRow = {
  id: string
  illustration_id: string
  category_id: string
  title: string
  score: number
  total: number
  matched: number
  missing: number
  passed: number
  created_at: string
}

const DEFAULT_SWATCHES = [
  { name: '赤', hex: '#ff3b30' },
  { name: 'だいだい', hex: '#ff9500' },
  { name: '黄', hex: '#ffd60a' },
  { name: '緑', hex: '#34c759' },
  { name: '水色', hex: '#5ac8fa' },
  { name: '青', hex: '#007aff' },
  { name: '紫', hex: '#af52de' },
  { name: 'ピンク', hex: '#ff8ac2' },
  { name: '茶', hex: '#8e5a2b' },
  { name: '黒', hex: '#1c1c1e' },
]

const PROFILE_MOTIF_IDS = new Set(['boy', 'girl', 'apple', 'dinosaur', 'teddy', 'dots', 'checker'])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/auth/')) {
      return createAuth(env, request).handler(request)
    }

    if (url.pathname === '/api/me') {
      const session = await getSessionUser(request, env)
      if (!session) return json({ user: null, profile: null })
      const profile = await getUserProfile(env, session.id)
      const safetyLock = await isSafetyLockEnabled(env, session.id)
      return json({ user: session, profile, safetyLock })
    }

    // セーフティーロックのオンオフ。オフにするときだけパスワードが必要（オンにするのは誰でもできる）
    if (url.pathname === '/api/safety-lock' && request.method === 'PUT') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const body = await request.json().catch(() => ({})) as { enabled?: unknown; password?: unknown }
      if (typeof body.enabled !== 'boolean') return json({ error: '設定が正しくありません。' }, 400)
      const now = new Date().toISOString()

      if (!body.enabled && (await isSafetyLockEnabled(env, user.id))) {
        const failure = await checkAccountPassword(env, user.id, body.password)
        if (failure) return failure
      }

      await env.DB.prepare(
        `INSERT INTO user_safety_lock (user_id, enabled, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
      )
        .bind(user.id, body.enabled ? 1 : 0, now)
        .run()
      return json({ safetyLock: body.enabled })
    }

    if (url.pathname === '/api/account' && request.method === 'DELETE') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user

      const coloringRows = await env.DB.prepare(
        `SELECT object_key
         FROM colorings
         WHERE user_id = ?`,
      )
        .bind(user.id)
        .all<{ object_key: string }>()
      const lineartRows = await env.DB.prepare(
        `SELECT object_key, reference_object_key
         FROM uploaded_linearts
         WHERE user_id = ?`,
      )
        .bind(user.id)
        .all<{ object_key: string; reference_object_key: string | null }>()
      const profileRows = await env.DB.prepare(
        `SELECT icon_object_key
         FROM user_profiles
         WHERE user_id = ? AND icon_object_key IS NOT NULL`,
      )
        .bind(user.id)
        .all<{ icon_object_key: string }>()

      const objectKeys = [
        ...(coloringRows.results ?? []).map((row) => row.object_key),
        ...(lineartRows.results ?? []).flatMap((row) => [row.object_key, row.reference_object_key].filter((key): key is string => Boolean(key))),
        ...(profileRows.results ?? []).map((row) => row.icon_object_key),
      ]
      await Promise.all([...new Set(objectKeys)].map((key) => env.ARTWORKS.delete(key)))

      await env.DB.prepare(`DELETE FROM colorings WHERE user_id = ?`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM user_lineart_library WHERE user_id = ?`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM user_lineart_library WHERE lineart_id IN (SELECT id FROM uploaded_linearts WHERE user_id = ?)`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM uploaded_linearts WHERE user_id = ?`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM user_palette_settings WHERE user_id = ?`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM quiz_attempts WHERE user_id = ?`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM user_profiles WHERE user_id = ?`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM user_safety_lock WHERE user_id = ?`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM session WHERE userId = ?`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM account WHERE userId = ?`).bind(user.id).run()
      await env.DB.prepare(`DELETE FROM user WHERE id = ?`).bind(user.id).run()

      return json({ ok: true })
    }

    if (url.pathname === '/api/profile' && request.method === 'GET') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      return json({ profile: await getUserProfile(env, user.id) })
    }

    if (url.pathname === '/api/profile' && request.method === 'PUT') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const contentType = request.headers.get('content-type') ?? ''
      let body: { motifId?: string; iconColor?: string; name?: string } = {}
      let iconFile: File | null = null
      if (contentType.includes('multipart/form-data')) {
        const form = await request.formData()
        body = {
          motifId: String(form.get('motifId') || ''),
          iconColor: String(form.get('iconColor') || ''),
          name: String(form.get('name') || ''),
        }
        const file = form.get('iconImage')
        iconFile = file instanceof File ? file : null
      } else {
        body = await request.json().catch(() => ({})) as { motifId?: string; iconColor?: string }
      }
      const motifId = PROFILE_MOTIF_IDS.has(String(body.motifId)) ? String(body.motifId) : 'boy'
      const iconColor = isHexColor(String(body.iconColor || '')) ? String(body.iconColor).toLowerCase() : '#ef6950'
      const name = (String(body.name || '').trim() || user.name || generateDefaultName()).slice(0, 64)
      const now = new Date().toISOString()
      let iconObjectKey: string | null = null
      let iconContentType: string | null = null
      if (iconFile) {
        if (iconFile.type !== 'image/png') return json({ error: 'アイコン画像はPNGで保存してください。' }, 400)
        iconObjectKey = `${user.id}/profile/icon.png`
        iconContentType = 'image/png'
        await env.ARTWORKS.put(iconObjectKey, await iconFile.arrayBuffer(), {
          httpMetadata: { contentType: 'image/png' },
        })
      }
      const image = iconObjectKey ? `/api/profile-icons/${user.id}?v=${encodeURIComponent(now)}` : `/profile-motifs/${motifId}.png`

      await env.DB.prepare(
        `INSERT INTO user_profiles (user_id, motif_id, icon_color, icon_object_key, icon_content_type, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           motif_id = excluded.motif_id,
           icon_color = excluded.icon_color,
           icon_object_key = COALESCE(excluded.icon_object_key, user_profiles.icon_object_key),
           icon_content_type = COALESCE(excluded.icon_content_type, user_profiles.icon_content_type),
           updated_at = excluded.updated_at`,
      )
        .bind(user.id, motifId, iconColor, iconObjectKey, iconContentType, now)
        .run()
      await env.DB.prepare(
        `UPDATE user
         SET name = ?, image = ?, updatedAt = ?
         WHERE id = ?`,
      )
        .bind(name, image, Date.now(), user.id)
        .run()

      return json({ profile: { motifId, iconColor, imageUrl: image, updatedAt: now } })
    }

    const profileIconMatch = url.pathname.match(/^\/api\/profile-icons\/([^/]+)$/)
    if (profileIconMatch && request.method === 'GET') {
      const row = await env.DB.prepare(
        `SELECT icon_object_key, icon_content_type
         FROM user_profiles
         WHERE user_id = ? AND icon_object_key IS NOT NULL`,
      )
        .bind(profileIconMatch[1])
        .first<{ icon_object_key: string; icon_content_type: string | null }>()
      if (!row) return json({ error: 'アイコンが見つかりません。' }, 404)
      const object = await env.ARTWORKS.get(row.icon_object_key)
      if (!object) return json({ error: 'アイコンが見つかりません。' }, 404)
      return new Response(object.body, {
        headers: {
          'content-type': row.icon_content_type ?? object.httpMetadata?.contentType ?? 'image/png',
          'cache-control': 'public, max-age=300',
        },
      })
    }

    if (url.pathname === '/api/palette-settings' && request.method === 'GET') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const row = await env.DB.prepare(
        `SELECT swatches_json, updated_at
         FROM user_palette_settings
         WHERE user_id = ?`,
      )
        .bind(user.id)
        .first<PaletteSettingsRow>()

      if (!row) return json({ swatches: null, updatedAt: null })

      return json({
        swatches: normalizeSwatches(parseJson(row.swatches_json)),
        updatedAt: row.updated_at,
      })
    }

    if (url.pathname === '/api/palette-settings' && request.method === 'PUT') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const body = await request.json().catch(() => ({})) as { swatches?: unknown }
      const swatches = normalizeSwatches(body.swatches)
      const now = new Date().toISOString()

      await env.DB.prepare(
        `INSERT INTO user_palette_settings (user_id, swatches_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           swatches_json = excluded.swatches_json,
           updated_at = excluded.updated_at`,
      )
        .bind(user.id, JSON.stringify(swatches), now)
        .run()

      return json({ swatches, updatedAt: now })
    }

    if (url.pathname === '/api/quiz-progress' && request.method === 'GET') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const rows = await env.DB.prepare(
        `SELECT id, illustration_id, category_id, title, score, total, matched, missing, passed, created_at
         FROM quiz_attempts
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
        .bind(user.id)
        .all<QuizAttemptRow>()
      return json({
        attempts: (rows.results ?? []).map((row) => ({
          id: row.id,
          illustrationId: row.illustration_id,
          categoryId: row.category_id,
          title: row.title,
          score: row.score,
          total: row.total,
          matched: row.matched,
          missing: row.missing,
          passed: Boolean(row.passed),
          createdAt: row.created_at,
        })),
      })
    }

    if (url.pathname === '/api/quiz-attempts' && request.method === 'POST') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const body = await request.json().catch(() => ({})) as {
        illustrationId?: string
        categoryId?: string
        title?: string
        score?: number
        total?: number
        matched?: number
        missing?: number
        passed?: boolean
      }
      const illustrationId = String(body.illustrationId || '').slice(0, 128)
      const categoryId = String(body.categoryId || '').slice(0, 64)
      const title = String(body.title || '').trim().slice(0, 120)
      if (!illustrationId || !categoryId || !title) return json({ error: 'クイズ結果を保存できませんでした。' }, 400)
      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      await env.DB.prepare(
        `INSERT INTO quiz_attempts (id, user_id, illustration_id, category_id, title, score, total, matched, missing, passed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          user.id,
          illustrationId,
          categoryId,
          title,
          clampInt(body.score, 0, 100),
          clampInt(body.total, 0, 1_000_000),
          clampInt(body.matched, 0, 1_000_000),
          clampInt(body.missing, 0, 1_000_000),
          body.passed ? 1 : 0,
          now,
        )
        .run()
      return json({ ok: true, attempt: { id, illustrationId, categoryId, title, score: clampInt(body.score, 0, 100), passed: Boolean(body.passed), createdAt: now } })
    }

    if (url.pathname === '/api/colorings' && request.method === 'GET') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const rows = await env.DB.prepare(
        `SELECT id, title, illustration_id, object_key, is_public, published_at, created_at, updated_at
         FROM colorings
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
      )
        .bind(user.id)
        .all<ColoringRow>()

      const colorings = (rows.results ?? []) as ColoringRow[]
      return json({
        colorings: colorings.map((row) => ({
          id: row.id,
          title: row.title,
          illustrationId: row.illustration_id,
          imageUrl: `/api/colorings/${row.id}/image`,
          isPublic: Boolean(row.is_public),
          publishedAt: row.published_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      })
    }

    if (url.pathname === '/api/colorings' && request.method === 'POST') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user

      const form = await request.formData()
      const file = form.get('image')
      const title = String(form.get('title') || '塗り絵')
      const illustrationId = String(form.get('illustrationId') || 'unknown')

      if (!(file instanceof File) || !file.type.startsWith('image/png')) {
        return json({ error: 'PNG画像が必要です。' }, 400)
      }

      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const objectKey = `${user.id}/${id}.png`
      await env.ARTWORKS.put(objectKey, await file.arrayBuffer(), {
        httpMetadata: {
          contentType: 'image/png',
        },
      })

      await env.DB.prepare(
        `INSERT INTO colorings (id, user_id, title, illustration_id, object_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, user.id, title.slice(0, 80), illustrationId, objectKey, now, now)
        .run()

      return json({
        coloring: {
          id,
          title,
          illustrationId,
          imageUrl: `/api/colorings/${id}/image`,
          isPublic: false,
          publishedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      })
    }

    if (url.pathname === '/api/public-colorings' && request.method === 'GET') {
      const rows = await env.DB.prepare(
        `SELECT colorings.id, colorings.title, colorings.illustration_id, colorings.object_key,
                colorings.is_public, colorings.published_at, colorings.created_at, colorings.updated_at,
                user.name AS author_name, user.image AS author_image,
                user_profiles.motif_id, user_profiles.icon_color
         FROM colorings
         LEFT JOIN user ON user.id = colorings.user_id
         LEFT JOIN user_profiles ON user_profiles.user_id = colorings.user_id
         WHERE colorings.is_public = 1
           AND colorings.illustration_id NOT LIKE 'flag-%'
           AND NOT EXISTS (
             SELECT 1
             FROM user_lineart_library
             INNER JOIN uploaded_linearts ON uploaded_linearts.id = user_lineart_library.lineart_id
             WHERE ('library-' || user_lineart_library.id) = colorings.illustration_id
               AND uploaded_linearts.is_learning = 1
           )
         ORDER BY colorings.published_at DESC, colorings.updated_at DESC
         LIMIT 80`,
      )
        .bind()
        .all<PublicColoringRow>()

      const colorings = (rows.results ?? []) as PublicColoringRow[]
      return json({
        colorings: colorings.map((row) => ({
          id: row.id,
          title: row.title,
          illustrationId: row.illustration_id,
          authorName: row.author_name,
          authorImage: row.author_image,
          authorProfile: row.motif_id ? {
            motifId: row.motif_id,
            iconColor: row.icon_color ?? '#ef6950',
            imageUrl: row.author_image ?? `/profile-motifs/${row.motif_id}.png`,
          } : null,
          imageUrl: `/api/public-colorings/${row.id}/image`,
          downloadUrl: `/api/public-colorings/${row.id}/image?download=1`,
          publishedAt: row.published_at,
          updatedAt: row.updated_at,
        })),
      })
    }

    const imageMatch = url.pathname.match(/^\/api\/colorings\/([^/]+)\/image$/)
    if (imageMatch && request.method === 'GET') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const id = imageMatch[1]
      const row = await env.DB.prepare(
        `SELECT object_key
         FROM colorings
         WHERE id = ? AND user_id = ?`,
      )
        .bind(id, user.id)
        .first<{ object_key: string }>()
      if (!row) return json({ error: '見つかりません。' }, 404)

      const object = await env.ARTWORKS.get(row.object_key)
      if (!object) return json({ error: '画像が見つかりません。' }, 404)
      return new Response(object.body, {
        headers: {
          'content-type': object.httpMetadata?.contentType ?? 'image/png',
          'cache-control': 'private, max-age=60',
        },
      })
    }

    const publicImageMatch = url.pathname.match(/^\/api\/public-colorings\/([^/]+)\/image$/)
    if (publicImageMatch && request.method === 'GET') {
      const id = publicImageMatch[1]
      const row = await env.DB.prepare(
        `SELECT object_key, title
         FROM colorings
         WHERE id = ? AND is_public = 1`,
      )
        .bind(id)
        .first<{ object_key: string; title: string }>()
      if (!row) return json({ error: '見つかりません。' }, 404)

      const object = await env.ARTWORKS.get(row.object_key)
      if (!object) return json({ error: '画像が見つかりません。' }, 404)
      const headers = new Headers({
        'content-type': object.httpMetadata?.contentType ?? 'image/png',
        'cache-control': 'public, max-age=300',
      })
      if (url.searchParams.get('download')) {
        headers.set('content-disposition', `attachment; filename="${encodeURIComponent(row.title)}.png"`)
      }
      return new Response(object.body, { headers })
    }

    const coloringMatch = url.pathname.match(/^\/api\/colorings\/([^/]+)$/)
    if (coloringMatch && request.method === 'PATCH') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const id = coloringMatch[1]
      const body = await request.json().catch(() => ({})) as { isPublic?: boolean }
      const isPublic = body.isPublic ? 1 : 0
      if (isPublic) {
        const row = await env.DB.prepare(
          `SELECT illustration_id
           FROM colorings
           WHERE id = ? AND user_id = ?`,
        )
          .bind(id, user.id)
          .first<{ illustration_id: string }>()
        if (!row) return json({ error: '見つかりません。' }, 404)
        const isLearningColoring = row.illustration_id.startsWith('flag-')
          || await isLibraryLearningColoring(env, row.illustration_id)
        if (isLearningColoring) {
          return json({ error: 'まなぶのぬりえは公開できません。' }, 400)
        }
      }
      const publishedAt = isPublic ? new Date().toISOString() : null
      const result = await env.DB.prepare(
        `UPDATE colorings
         SET is_public = ?, published_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
        .bind(isPublic, publishedAt, new Date().toISOString(), id, user.id)
        .run()
      return json({ ok: true, result, isPublic: Boolean(isPublic), publishedAt })
    }

    if (coloringMatch && request.method === 'DELETE') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const id = coloringMatch[1]
      const row = await env.DB.prepare(
        `SELECT object_key
         FROM colorings
         WHERE id = ? AND user_id = ?`,
      )
        .bind(id, user.id)
        .first<{ object_key: string }>()
      if (!row) return json({ error: '見つかりません。' }, 404)

      await env.ARTWORKS.delete(row.object_key)
      await env.DB.prepare(
        `DELETE FROM colorings
         WHERE id = ? AND user_id = ?`,
      )
        .bind(id, user.id)
        .run()

      return json({ ok: true })
    }

    if (url.pathname === '/api/linearts' && request.method === 'GET') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const rows = await env.DB.prepare(
        `SELECT id, title, object_key, content_type, category_id, is_learning,
                reference_object_key, reference_content_type, is_public, published_at, created_at
         FROM uploaded_linearts
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
        .bind(user.id)
        .all<UploadedLineArtRow>()

      const linearts = (rows.results ?? []) as UploadedLineArtRow[]
      return json({
        linearts: linearts.map((row) => ({
          id: row.id,
          title: row.title,
          imageUrl: `/api/linearts/${row.id}/image`,
          categoryId: row.category_id,
          isLearning: Boolean(row.is_learning),
          referenceImageUrl: row.reference_object_key ? `/api/linearts/${row.id}/reference` : null,
          isPublic: Boolean(row.is_public),
          publishedAt: row.published_at,
          createdAt: row.created_at,
        })),
      })
    }

    if (url.pathname === '/api/linearts' && request.method === 'POST') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const form = await request.formData()
      // セーフティーロックがオンのときは、パスワードが合っていないとアップロードできない
      if (await isSafetyLockEnabled(env, user.id)) {
        const failure = await checkAccountPassword(env, user.id, form.get('password'))
        if (failure) return failure
      }
      const file = form.get('image')
      const referenceFile = form.get('referenceImage')
      const title = String(form.get('title') || 'アップロードぬりえ')
      const categoryId = String(form.get('categoryId') || '')
      const isPublic = String(form.get('isPublic') || '') === 'true'
      const isLearning = String(form.get('isLearning') || '') === 'true'
      if (!LINEART_CATEGORY_IDS.has(categoryId)) {
        return json({ error: 'カテゴリーを選んでください。' }, 400)
      }
      if (!(file instanceof File) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        return json({ error: 'PNG、JPEG、WebP画像をアップロードしてください。' }, 400)
      }
      if (isLearning && !(referenceFile instanceof File)) {
        return json({ error: '学習用ぬりえには見本画像が必要です。' }, 400)
      }
      if (referenceFile instanceof File && !['image/png', 'image/jpeg', 'image/webp'].includes(referenceFile.type)) {
        return json({ error: '見本画像はPNG、JPEG、WebPで登録してください。' }, 400)
      }

      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'
      const objectKey = `${user.id}/linearts/${id}.${ext}`
      await env.ARTWORKS.put(objectKey, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      })
      let referenceObjectKey: string | null = null
      let referenceContentType: string | null = null
      if (referenceFile instanceof File) {
        const referenceExt = referenceFile.type === 'image/jpeg' ? 'jpg' : referenceFile.type === 'image/webp' ? 'webp' : 'png'
        referenceObjectKey = `${user.id}/linearts/${id}-reference.${referenceExt}`
        referenceContentType = referenceFile.type
        await env.ARTWORKS.put(referenceObjectKey, await referenceFile.arrayBuffer(), {
          httpMetadata: { contentType: referenceFile.type },
        })
      }
      await env.DB.prepare(
        `INSERT INTO uploaded_linearts (
           id, user_id, title, object_key, content_type, category_id, is_learning,
           reference_object_key, reference_content_type, is_public, published_at, created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, user.id, title.slice(0, 80), objectKey, file.type, categoryId, isLearning ? 1 : 0, referenceObjectKey, referenceContentType, isPublic ? 1 : 0, isPublic ? now : null, now)
        .run()

      await env.DB.prepare(
        `INSERT OR IGNORE INTO user_lineart_library (id, user_id, lineart_id, category_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(crypto.randomUUID(), user.id, id, categoryId, now)
        .run()

      return json({
        lineart: {
          id,
          title,
          imageUrl: `/api/linearts/${id}/image`,
          categoryId,
          isLearning,
          referenceImageUrl: referenceObjectKey ? `/api/linearts/${id}/reference` : null,
          isPublic,
          publishedAt: isPublic ? now : null,
          createdAt: now,
        },
      })
    }

    if (url.pathname === '/api/public-linearts' && request.method === 'GET') {
      const user = await getSessionUser(request, env)
      const rows = await env.DB.prepare(
        `SELECT uploaded_linearts.id, uploaded_linearts.title, uploaded_linearts.object_key,
                uploaded_linearts.content_type, uploaded_linearts.category_id, uploaded_linearts.is_learning,
                uploaded_linearts.reference_object_key, uploaded_linearts.reference_content_type,
                uploaded_linearts.is_public, uploaded_linearts.published_at,
                uploaded_linearts.created_at, user.name AS author_name
         FROM uploaded_linearts
         LEFT JOIN user ON user.id = uploaded_linearts.user_id
         WHERE uploaded_linearts.is_public = 1
         ORDER BY uploaded_linearts.published_at DESC, uploaded_linearts.created_at DESC
         LIMIT 80`,
      )
        .bind()
        .all<PublicLineArtRow>()
      const libraryRows = user
        ? await env.DB.prepare(
          `SELECT lineart_id
           FROM user_lineart_library
           WHERE user_id = ?`,
        )
          .bind(user.id)
          .all<{ lineart_id: string }>()
        : { results: [] }
      const added = new Set((libraryRows.results ?? []).map((row) => row.lineart_id))
      const linearts = (rows.results ?? []) as PublicLineArtRow[]
      return json({
        linearts: linearts.map((row) => ({
          id: row.id,
          title: row.title,
          authorName: row.author_name,
          imageUrl: `/api/linearts/${row.id}/image`,
          categoryId: row.category_id,
          isLearning: Boolean(row.is_learning),
          referenceImageUrl: row.reference_object_key ? `/api/linearts/${row.id}/reference` : null,
          added: added.has(row.id),
          publishedAt: row.published_at,
          createdAt: row.created_at,
        })),
      })
    }

    if (url.pathname === '/api/library-linearts' && request.method === 'GET') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const rows = await env.DB.prepare(
        `SELECT user_lineart_library.id AS library_id, user_lineart_library.created_at AS added_at,
                uploaded_linearts.id, uploaded_linearts.title, uploaded_linearts.object_key,
                uploaded_linearts.content_type,
                COALESCE(user_lineart_library.category_id, uploaded_linearts.category_id) AS category_id,
                uploaded_linearts.is_learning,
                uploaded_linearts.reference_object_key, uploaded_linearts.reference_content_type,
                uploaded_linearts.is_public, uploaded_linearts.published_at,
                uploaded_linearts.created_at, user.name AS author_name
         FROM user_lineart_library
         INNER JOIN uploaded_linearts ON uploaded_linearts.id = user_lineart_library.lineart_id
         LEFT JOIN user ON user.id = uploaded_linearts.user_id
         WHERE user_lineart_library.user_id = ?
         ORDER BY user_lineart_library.created_at DESC`,
      )
        .bind(user.id)
        .all<LibraryLineArtRow>()
      const linearts = (rows.results ?? []) as LibraryLineArtRow[]
      return json({
        linearts: linearts.map((row) => ({
          id: row.library_id,
          lineartId: row.id,
          title: row.title,
          authorName: row.author_name,
          imageUrl: `/api/linearts/${row.id}/image`,
          categoryId: row.category_id,
          isLearning: Boolean(row.is_learning),
          referenceImageUrl: row.reference_object_key ? `/api/linearts/${row.id}/reference` : null,
          createdAt: row.added_at,
        })),
      })
    }

    if (url.pathname === '/api/library-linearts' && request.method === 'POST') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const body = await request.json().catch(() => ({})) as { lineartId?: string; categoryId?: string }
      const lineartId = String(body.lineartId || '')
      const categoryId = String(body.categoryId || '')
      if (!LINEART_CATEGORY_IDS.has(categoryId)) {
        return json({ error: 'カテゴリーを選んでください。' }, 400)
      }
      const lineart = await env.DB.prepare(
        `SELECT id
         FROM uploaded_linearts
         WHERE id = ? AND (is_public = 1 OR user_id = ?)`,
      )
        .bind(lineartId, user.id)
        .first<{ id: string }>()
      if (!lineart) return json({ error: '追加できるぬりえが見つかりません。' }, 404)

      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      await env.DB.prepare(
        `INSERT OR IGNORE INTO user_lineart_library (id, user_id, lineart_id, category_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(id, user.id, lineartId, categoryId, now)
        .run()
      return json({ ok: true })
    }

    const libraryLineartMatch = url.pathname.match(/^\/api\/library-linearts\/([^/]+)$/)
    if (libraryLineartMatch && request.method === 'DELETE') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      await env.DB.prepare(
        `DELETE FROM user_lineart_library
         WHERE id = ? AND user_id = ?`,
      )
        .bind(libraryLineartMatch[1], user.id)
        .run()
      return json({ ok: true })
    }

    const lineartMatch = url.pathname.match(/^\/api\/linearts\/([^/]+)$/)
    if (lineartMatch && request.method === 'PATCH') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const body = await request.json().catch(() => ({})) as { isPublic?: boolean; categoryId?: string }
      const current = await env.DB.prepare(
        `SELECT is_public, category_id
         FROM uploaded_linearts
         WHERE id = ? AND user_id = ?`,
      )
        .bind(lineartMatch[1], user.id)
        .first<{ is_public: number; category_id: string }>()
      if (!current) return json({ error: '見つかりません。' }, 404)
      const categoryId = typeof body.categoryId === 'string' && LINEART_CATEGORY_IDS.has(body.categoryId)
        ? body.categoryId
        : current.category_id
      const isPublic = typeof body.isPublic === 'boolean' ? (body.isPublic ? 1 : 0) : current.is_public
      const publishedAt = isPublic ? new Date().toISOString() : null
      await env.DB.prepare(
        `UPDATE uploaded_linearts
         SET is_public = ?, published_at = ?, category_id = ?
         WHERE id = ? AND user_id = ?`,
      )
        .bind(isPublic, publishedAt, categoryId, lineartMatch[1], user.id)
        .run()
      await env.DB.prepare(
        `UPDATE user_lineart_library
         SET category_id = ?
         WHERE lineart_id = ? AND user_id = ?`,
      )
        .bind(categoryId, lineartMatch[1], user.id)
        .run()
      return json({ ok: true, isPublic: Boolean(isPublic), publishedAt, categoryId })
    }

    if (lineartMatch && request.method === 'DELETE') {
      const user = await requireUser(request, env)
      if (user instanceof Response) return user
      const row = await env.DB.prepare(
        `SELECT object_key, reference_object_key
         FROM uploaded_linearts
         WHERE id = ? AND user_id = ?`,
      )
        .bind(lineartMatch[1], user.id)
        .first<{ object_key: string; reference_object_key: string | null }>()
      if (!row) return json({ error: '見つかりません。' }, 404)

      await env.ARTWORKS.delete(row.object_key)
      if (row.reference_object_key) await env.ARTWORKS.delete(row.reference_object_key)
      await env.DB.prepare(
        `DELETE FROM uploaded_linearts
         WHERE id = ? AND user_id = ?`,
      )
        .bind(lineartMatch[1], user.id)
        .run()
      return json({ ok: true })
    }

    const lineartImageMatch = url.pathname.match(/^\/api\/linearts\/([^/]+)\/image$/)
    if (lineartImageMatch && request.method === 'GET') {
      const user = await getSessionUser(request, env)
      const row = await env.DB.prepare(
        `SELECT object_key, content_type
         FROM uploaded_linearts
         WHERE id = ? AND (
           is_public = 1
           OR user_id = ?
           OR EXISTS (
             SELECT 1
             FROM user_lineart_library
             WHERE user_lineart_library.lineart_id = uploaded_linearts.id
               AND user_lineart_library.user_id = ?
           )
         )`,
      )
        .bind(lineartImageMatch[1], user?.id ?? '', user?.id ?? '')
        .first<{ object_key: string; content_type: string }>()
      if (!row) return json({ error: '見つかりません。' }, 404)

      const object = await env.ARTWORKS.get(row.object_key)
      if (!object) return json({ error: '画像が見つかりません。' }, 404)
      return new Response(object.body, {
        headers: {
          'content-type': row.content_type,
          'cache-control': 'private, max-age=60',
        },
      })
    }

    const lineartReferenceMatch = url.pathname.match(/^\/api\/linearts\/([^/]+)\/reference$/)
    if (lineartReferenceMatch && request.method === 'GET') {
      const user = await getSessionUser(request, env)
      const row = await env.DB.prepare(
        `SELECT reference_object_key, reference_content_type
         FROM uploaded_linearts
         WHERE id = ? AND reference_object_key IS NOT NULL AND (
           is_public = 1
           OR user_id = ?
           OR EXISTS (
             SELECT 1
             FROM user_lineart_library
             WHERE user_lineart_library.lineart_id = uploaded_linearts.id
               AND user_lineart_library.user_id = ?
           )
         )`,
      )
        .bind(lineartReferenceMatch[1], user?.id ?? '', user?.id ?? '')
        .first<{ reference_object_key: string; reference_content_type: string | null }>()
      if (!row) return json({ error: '見本画像が見つかりません。' }, 404)

      const object = await env.ARTWORKS.get(row.reference_object_key)
      if (!object) return json({ error: '見本画像が見つかりません。' }, 404)
      return new Response(object.body, {
        headers: {
          'content-type': row.reference_content_type ?? object.httpMetadata?.contentType ?? 'image/png',
          'cache-control': 'private, max-age=60',
        },
      })
    }

    return env.ASSETS.fetch(request)
  },
}

async function getSessionUser(request: Request, env: Env): Promise<SessionUser | null> {
  const session = await createAuth(env, request).api.getSession({
    headers: request.headers,
  })
  return (session?.user as SessionUser | undefined) ?? null
}

async function requireUser(request: Request, env: Env): Promise<SessionUser | Response> {
  const user = await getSessionUser(request, env)
  if (!user) return json({ error: 'ログインが必要です。' }, 401)
  return user
}

async function getUserProfile(env: Env, userId: string) {
  const row = await env.DB.prepare(
    `SELECT motif_id, icon_color, icon_object_key, icon_content_type, updated_at
     FROM user_profiles
     WHERE user_id = ?`,
  )
    .bind(userId)
    .first<ProfileRow>()
  if (!row) return null
  return {
    motifId: row.motif_id,
    iconColor: row.icon_color,
    imageUrl: row.icon_object_key ? `/api/profile-icons/${userId}?v=${encodeURIComponent(row.updated_at)}` : `/profile-motifs/${row.motif_id}.png`,
    updatedAt: row.updated_at,
  }
}

// パスワードを続けて間違えたときに、しばらく試せなくする回数と時間
const SAFETY_LOCK_MAX_FAILURES = 5
const SAFETY_LOCK_COOLDOWN_MS = 5 * 60 * 1000

async function isSafetyLockEnabled(env: Env, userId: string) {
  const row = await env.DB.prepare(`SELECT enabled FROM user_safety_lock WHERE user_id = ?`)
    .bind(userId)
    .first<{ enabled: number }>()
  return Boolean(row?.enabled)
}

// ログイン中のアカウントのパスワードが合っているか確認する。
// 合っていれば null、だめなら返すべきエラーレスポンスを返す。
// （セーフティーロックの解除・アップロード用。総当たりで試されないよう、続けて間違えるとしばらく確認できなくする）
async function checkAccountPassword(env: Env, userId: string, password: unknown): Promise<Response | null> {
  if (typeof password !== 'string' || !password) {
    return json({ error: 'パスワードを入力してください。', code: 'PASSWORD_REQUIRED' }, 403)
  }
  const now = Date.now()
  const state = await env.DB.prepare(`SELECT failed_count, locked_until FROM user_safety_lock WHERE user_id = ?`)
    .bind(userId)
    .first<{ failed_count: number; locked_until: number | null }>()
  if (state?.locked_until && state.locked_until > now) {
    const minutes = Math.max(1, Math.ceil((state.locked_until - now) / 60000))
    return json({ error: `パスワードを間違えた回数が多いため、あと${minutes}分ほどたってからお試しください。`, code: 'TOO_MANY_ATTEMPTS' }, 429)
  }

  const account = await env.DB.prepare(`SELECT password FROM account WHERE userId = ? AND providerId = 'credential'`)
    .bind(userId)
    .first<{ password: string | null }>()
  const ok = Boolean(account?.password) && (await verifyPassword({ hash: account!.password!, password }).catch(() => false))

  if (ok) {
    if (state && (state.failed_count || state.locked_until)) {
      await env.DB.prepare(`UPDATE user_safety_lock SET failed_count = 0, locked_until = NULL WHERE user_id = ?`).bind(userId).run()
    }
    return null
  }

  const failedCount = (state?.locked_until && state.locked_until <= now ? 0 : state?.failed_count ?? 0) + 1
  const lockNow = failedCount >= SAFETY_LOCK_MAX_FAILURES
  await env.DB.prepare(
    `INSERT INTO user_safety_lock (user_id, enabled, failed_count, locked_until, updated_at)
     VALUES (?, 0, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       failed_count = excluded.failed_count,
       locked_until = excluded.locked_until`,
  )
    .bind(userId, lockNow ? 0 : failedCount, lockNow ? now + SAFETY_LOCK_COOLDOWN_MS : null, new Date().toISOString())
    .run()
  return json({ error: 'パスワードが違います。', code: 'PASSWORD_INVALID' }, 403)
}

async function isLibraryLearningColoring(env: Env, illustrationId: string) {
  if (!illustrationId.startsWith('library-')) return false
  const libraryId = illustrationId.slice('library-'.length)
  const row = await env.DB.prepare(
    `SELECT uploaded_linearts.is_learning
     FROM user_lineart_library
     INNER JOIN uploaded_linearts ON uploaded_linearts.id = user_lineart_library.lineart_id
     WHERE user_lineart_library.id = ?
     LIMIT 1`,
  )
    .bind(libraryId)
    .first<{ is_learning: number }>()
  return Boolean(row?.is_learning)
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  })
}

function normalizeSwatches(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_SWATCHES

  const incoming = value
    .filter((swatch): swatch is { name: string; hex: string } => {
      if (!swatch || typeof swatch !== 'object') return false
      const item = swatch as { name?: unknown; hex?: unknown }
      return typeof item.name === 'string' && typeof item.hex === 'string' && isHexColor(item.hex)
    })
    .slice(0, DEFAULT_SWATCHES.length)
    .map((swatch, index) => ({
      name: swatch.name.trim().slice(0, 24) || DEFAULT_SWATCHES[index].name,
      hex: swatch.hex.toLowerCase(),
    }))

  return [...incoming, ...DEFAULT_SWATCHES.slice(incoming.length)].slice(0, DEFAULT_SWATCHES.length)
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

function clampInt(value: unknown, min: number, max: number) {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : min
  return Math.min(max, Math.max(min, Math.round(number)))
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}
