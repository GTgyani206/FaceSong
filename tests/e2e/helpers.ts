import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, type Page, type Request, type Route } from '@playwright/test'

/** MediaPipe's own sample portrait, downloaded once into .cache/ and pinned by SHA-256. */
const PORTRAIT_URL = 'https://storage.googleapis.com/mediapipe-assets/portrait.jpg'
const PORTRAIT_SHA256 = 'a6f11efaa834706db23f275b6115058fa87fc7f14362681e6abe14e82749de3e'
const CACHE = '.cache/test-images'

export async function portrait(): Promise<Buffer> {
  const path = `${CACHE}/portrait.jpg`
  if (!existsSync(path)) {
    const res = await fetch(PORTRAIT_URL)
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
    mkdirSync(CACHE, { recursive: true })
    writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  }
  const buf = readFileSync(path)
  expect(createHash('sha256').update(buf).digest('hex')).toBe(PORTRAIT_SHA256)
  return buf
}

/** Rotate (degrees, clockwise on screen) and/or mirror an image on a canvas in the page. */
export async function transformImage(page: Page, src: Buffer, deg: number, mirror: boolean, type: string): Promise<Buffer> {
  const b64 = await page.evaluate(
    async ({ src, deg, mirror, type }) => {
      const img = new Image()
      img.src = `data:image/jpeg;base64,${src}`
      await img.decode()
      const r = (deg * Math.PI) / 180
      const [w, h] = [img.width, img.height]
      const cw = Math.round(Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r)))
      const ch = Math.round(Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)))
      const c = document.createElement('canvas')
      c.width = cw
      c.height = ch
      const g = c.getContext('2d')!
      g.fillStyle = '#808080'
      g.fillRect(0, 0, cw, ch)
      g.translate(cw / 2, ch / 2)
      g.rotate(r)
      if (mirror) g.scale(-1, 1)
      g.drawImage(img, -w / 2, -h / 2)
      return c.toDataURL(type, 0.95).split(',')[1]
    },
    { src: src.toString('base64'), deg, mirror, type },
  )
  return Buffer.from(b64, 'base64')
}

/** Matches playwright.config.ts: the e2e dev server runs with these fake Supabase settings. */
export const SUPABASE_URL = 'https://facesong-test.supabase.co'
export const TEST_USER_ID = '11111111-2222-4333-8444-555555555555'

export interface RecordedRequest {
  method: string
  path: string
  search: string
  headers: Record<string, string>
  body: Buffer | null
}

/**
 * In-memory fake of the Supabase endpoints the app uses (auth, PostgREST
 * `songs`, Storage `face-photos`). Records every request for assertions.
 */
export async function mockSupabase(page: Page) {
  const requests: RecordedRequest[] = []
  const songs: Record<string, unknown>[] = []
  const photos = new Map<string, Buffer>()

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route(`${SUPABASE_URL}/**`, async (route, request: Request) => {
    const url = new URL(request.url())
    const body = request.postDataBuffer()
    requests.push({ method: request.method(), path: url.pathname, search: url.search, headers: request.headers(), body })
    const p = url.pathname
    const now = Math.floor(Date.now() / 1000)

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })

    if (p === '/auth/v1/signup') {
      return json(route, 200, {
        access_token: 'test-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: 'test-refresh-token',
        user: {
          id: TEST_USER_ID,
          aud: 'authenticated',
          role: 'authenticated',
          is_anonymous: true,
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      })
    }
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204 })

    if (p === '/rest/v1/songs') {
      if (request.method() === 'POST') {
        const row = { ...JSON.parse(body!.toString()), created_at: new Date().toISOString() }
        songs.push(row)
        return json(route, 201, request.headers()['accept']?.includes('vnd.pgrst.object') ? row : [row])
      }
      if (request.method() === 'GET') return json(route, 200, [...songs].reverse())
      if (request.method() === 'DELETE') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '')
        const user = url.searchParams.get('user_id')?.replace(/^eq\./, '')
        for (let i = songs.length - 1; i >= 0; i--) if (songs[i].id === id || songs[i].user_id === user) songs.splice(i, 1)
        return route.fulfill({ status: 204 })
      }
    }

    const upload = p.match(/^\/storage\/v1\/object\/face-photos\/(.+)$/)
    if (upload && request.method() === 'POST') {
      // supabase-js sends a Blob as multipart form data; keep just the file bytes, like Storage does.
      photos.set(decodeURIComponent(upload[1]), filePart(body ?? Buffer.alloc(0), request.headers()['content-type'] ?? ''))
      return json(route, 200, { Key: `face-photos/${upload[1]}`, Id: 'test-object-id' })
    }
    if (p === '/storage/v1/object/sign/face-photos' && request.method() === 'POST') {
      const { paths } = JSON.parse(body!.toString()) as { paths: string[] }
      return json(route, 200, paths.map((path) => ({ path, signedURL: `/object/sign/face-photos/${path}?token=t`, error: null })))
    }
    const signed = p.match(/^\/storage\/v1\/object\/sign\/face-photos\/(.+)$/)
    if (signed) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: photos.get(decodeURIComponent(signed[1])) ?? Buffer.alloc(0) })
    if (p === '/storage/v1/object/list/face-photos') {
      const { prefix } = JSON.parse(body!.toString()) as { prefix: string }
      const names = [...photos.keys()].filter((k) => k.startsWith(`${prefix}/`)).map((k) => ({ name: k.slice(prefix.length + 1) }))
      return json(route, 200, names)
    }
    if (p === '/storage/v1/object/face-photos' && request.method() === 'DELETE') {
      const { prefixes } = JSON.parse(body!.toString()) as { prefixes: string[] }
      for (const k of prefixes) photos.delete(k)
      return json(route, 200, prefixes.map((name) => ({ name })))
    }

    return json(route, 404, { message: `unmocked ${request.method()} ${p}` })
  })

  return { requests, songs, photos }
}

/** The single file part of a multipart/form-data body (or the body itself if not multipart). */
function filePart(body: Buffer, contentType: string): Buffer {
  const boundary = contentType.match(/boundary=(.+)$/)?.[1]
  if (!boundary) return body
  for (const part of body.toString('latin1').split(`--${boundary}`)) {
    const split = part.indexOf('\r\n\r\n')
    if (split < 0 || !/filename=/i.test(part.slice(0, split))) continue
    return Buffer.from(part.slice(split + 4).replace(/\r\n$/, ''), 'latin1')
  }
  return body
}
