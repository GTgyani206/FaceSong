import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { CONTINUOUS_IDENTITY, DISCRETE_IDENTITY, IDENTITY_FEATURES, type QuantizedIdentity } from '../../src/features/index.ts'
import { withExifOrientation } from '../helpers/exif.ts'

/*
 * Same face, different framing → same identity. Uses MediaPipe's own
 * sample portrait (downloaded once into .cache/, pinned by SHA-256) and
 * derives rotated / mirrored / EXIF-tagged variants from it in the browser.
 */

const PORTRAIT_URL = 'https://storage.googleapis.com/mediapipe-assets/portrait.jpg'
const PORTRAIT_SHA256 = 'a6f11efaa834706db23f275b6115058fa87fc7f14362681e6abe14e82749de3e'
const CACHE = '.cache/test-images'

async function portrait(): Promise<Buffer> {
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

interface Card {
  file: string
  size: string
  roll: number
  straightened: number
  identity: QuantizedIdentity
  features: Record<string, number>
  pose: { yaw: number; pitch: number; roll: number }
}

async function openDebug(page: Page) {
  await page.goto('/debug')
  await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 60_000 })
}

async function upload(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]): Promise<Card[]> {
  await page.setInputFiles('input[type=file]', files)
  const cards = page.getByTestId('photo-card')
  await expect(cards).toHaveCount(files.length, { timeout: 90_000 })
  await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 90_000 })
  return cards.evaluateAll((els) =>
    els.map((el) => {
      const d = (el as HTMLElement).dataset
      const json = (v?: string) => (v ? JSON.parse(v) : null)
      return {
        file: d.file!,
        size: d.size!,
        roll: Number(d.roll),
        straightened: Number(d.straightened),
        identity: json(d.identity),
        features: json(d.features),
        pose: json(d.pose),
      }
    }),
  )
}

/** Rotate (degrees, clockwise on screen) and/or mirror an image on a canvas; returns base64 of `type`. */
async function transformImage(page: Page, src: Buffer, deg: number, mirror: boolean, type: string): Promise<Buffer> {
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

test('rotated and EXIF-tagged copies keep identity: spread < 5%, same discrete bins', async ({ page }) => {
  const original = await portrait()
  await openDebug(page)

  const png = (name: string, buffer: Buffer) => ({ name, mimeType: 'image/png', buffer })
  // Pixels rotated 90° counter-clockwise, tagged "rotate 90° clockwise to display".
  const exifRotated = withExifOrientation(await transformImage(page, original, -90, false, 'image/jpeg'), 6)
  const files = [
    { name: 'original.jpg', mimeType: 'image/jpeg', buffer: original },
    png('rot+10.png', await transformImage(page, original, 10, false, 'image/png')),
    png('rot-10.png', await transformImage(page, original, -10, false, 'image/png')),
    png('rot+90.png', await transformImage(page, original, 90, false, 'image/png')),
    png('mirrored.png', await transformImage(page, original, 0, true, 'image/png')),
    { name: 'exif-orientation-6.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(exifRotated) },
  ]
  const cards = await upload(page, files)
  const byName = Object.fromEntries(cards.map((c) => [c.file, c]))
  const base = byName['original.jpg']
  expect(base.identity, 'original has a face').not.toBeNull()

  // Spread = (max − min) / |mean| over the original and its rotated copies.
  const rotated = ['original.jpg', 'rot+10.png', 'rot-10.png', 'rot+90.png'].map((n) => byName[n])
  const spread = Object.fromEntries(
    IDENTITY_FEATURES.map((n) => {
      const vals = rotated.map((c) => c.features[n])
      const mean = vals.reduce((a, b) => a + b) / vals.length
      return [n, (Math.max(...vals) - Math.min(...vals)) / Math.abs(mean)]
    }),
  )

  // Report for humans.
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/rotation-report.json', JSON.stringify({ cards, spread }, null, 2))
  console.table(
    cards.map((c) => ({
      file: c.file,
      roll: c.roll.toFixed(1),
      ...Object.fromEntries(DISCRETE_IDENTITY.map((n) => [n, `${c.features[n].toFixed(3)} [${c.identity.discrete[n]}]`])),
      ...Object.fromEntries(CONTINUOUS_IDENTITY.map((n) => [n, c.features[n].toFixed(3)])),
    })),
  )
  console.table(Object.fromEntries(IDENTITY_FEATURES.map((n) => [n, `${(spread[n] * 100).toFixed(2)}%`])))

  // Every photo takes the upright path, whatever its roll.
  for (const c of cards) expect(c.straightened, `${c.file} straightened`).toBeCloseTo(-c.roll, 6)

  for (const name of IDENTITY_FEATURES) expect(spread[name], `${name} spread across rotations`).toBeLessThan(0.05)

  for (const name of ['rot+10.png', 'rot-10.png', 'rot+90.png']) {
    expect(byName[name].identity.discrete, `${name} discrete bins`).toEqual(base.identity.discrete)
  }

  // EXIF: decoded upright (portrait size, level face) and same discrete bins.
  const exif = byName['exif-orientation-6.jpg']
  expect(exif.size).toBe(base.size)
  expect(Math.abs(exif.roll)).toBeLessThan(3)
  expect(exif.identity.discrete).toEqual(base.identity.discrete)
})

test('uploads honour EXIF orientation (synthetic fixture)', async ({ page }) => {
  await openDebug(page)
  const buffer = readFileSync('tests/fixtures/images/exif-orientation-6.jpg')

  // Through the debug page: displayed size, not stored size.
  const [card] = await upload(page, [{ name: 'exif-orientation-6.jpg', mimeType: 'image/jpeg', buffer }])
  expect(card.size).toBe('40x60')

  // Directly through decodeImage: the red band must end up on top.
  const pixels = await page.evaluate(async (b64) => {
    // Served by the Vite dev server; typed against the source module.
    const modulePath: string = '/src/landmarks/image.ts'
    const { decodeImage }: typeof import('../../src/landmarks/image.ts') = await import(modulePath)
    const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob()
    const bmp = await decodeImage(blob)
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const g = c.getContext('2d')!
    g.drawImage(bmp, 0, 0)
    const at = (x: number, y: number) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)]
    return { width: bmp.width, height: bmp.height, top: at(20, 5), bottom: at(20, 55) }
  }, buffer.toString('base64'))
  expect(pixels).toMatchObject({ width: 40, height: 60 })
  expect(pixels.top[0]).toBeGreaterThan(200) // red
  expect(pixels.top[2]).toBeLessThan(60)
  expect(pixels.bottom[2]).toBeGreaterThan(200) // blue
  expect(pixels.bottom[0]).toBeLessThan(60)
})
