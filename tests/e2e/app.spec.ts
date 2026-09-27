import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { mockSupabase, portrait, TEST_USER_ID, transformImage } from './helpers.ts'

/*
 * The real app, end to end: photo → song → play → save. Supabase is faked at
 * the network layer (see helpers.ts), so these tests also prove what is and
 * isn't uploaded.
 */

async function makeSong(page: Page, name: string, buffer: Buffer, mimeType = 'image/jpeg') {
  await page.getByTestId('upload').setInputFiles({ name, mimeType, buffer })
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 })
  return {
    seed: await page.getByTestId('result').getAttribute('data-seed'),
    title: await page.getByTestId('song-title').innerText(),
  }
}

test('upload → song → play → WAV, without contacting Supabase', async ({ page }) => {
  const supabase = await mockSupabase(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Your face, as a song.' })).toBeVisible()

  const song = await makeSong(page, 'portrait.jpg', await portrait())
  expect(song.title).toMatch(/^\w+ \w+$/)
  await expect(page.locator('.chips li')).toHaveCount(3)
  await expect(page.locator('svg.roll rect.note').first()).toBeVisible()

  await page.getByTestId('play').click()
  await expect(page.getByTestId('stop')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('stop').click()
  await expect(page.getByTestId('play')).toBeVisible()

  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.getByRole('button', { name: 'Download WAV' }).click()])
  expect(download.suggestedFilename()).toMatch(/\.wav$/)
  const wav = readFileSync((await download.path())!)
  expect(wav.subarray(0, 4).toString()).toBe('RIFF')
  expect(wav.length).toBeGreaterThan(1_000_000)

  // Visiting and making a song never creates an account or sends anything.
  expect(supabase.requests).toEqual([])
})

test('the same face gives the same song, even rotated', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/')
  const original = await portrait()
  const first = await makeSong(page, 'portrait.jpg', original)

  await page.getByRole('button', { name: 'New photo' }).click()
  const again = await makeSong(page, 'portrait.jpg', original)
  expect(again).toEqual(first)

  await page.getByRole('button', { name: 'New photo' }).click()
  const tilted = await makeSong(page, 'tilted.png', await transformImage(page, original, 10, false, 'image/png'), 'image/png')
  expect(tilted).toEqual(first)
})

test('a photo without a face is rejected with a clear message', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/')
  await page.getByTestId('upload').setInputFiles('tests/fixtures/images/exif-orientation-6.jpg')
  await expect(page.getByTestId('rejection')).toContainText('No face found', { timeout: 60_000 })
})

test('saving without consent stores the song only — nothing goes to storage', async ({ page }) => {
  const supabase = await mockSupabase(page)
  await page.goto('/')
  await makeSong(page, 'portrait.jpg', await portrait())

  await expect(page.getByTestId('photo-consent')).not.toBeChecked()
  await page.getByTestId('save').click()
  await expect(page.locator('.notice.ok')).toHaveText(/^Saved\. Open My songs$/)

  expect(supabase.requests.some((r) => r.path.startsWith('/storage/'))).toBe(false)
  expect(supabase.photos.size).toBe(0)
  expect(supabase.songs).toHaveLength(1)
  expect(supabase.songs[0]).toMatchObject({ user_id: TEST_USER_ID, photo_path: null, photo_consent_at: null })
})

test('saving with consent uploads one metadata-free JPEG to the user’s folder; delete-all removes everything', async ({ page }) => {
  const supabase = await mockSupabase(page)
  await page.goto('/')
  await makeSong(page, 'portrait.jpg', await portrait())

  await page.getByTestId('photo-consent').check()
  await page.getByTestId('save').click()
  await expect(page.locator('.notice.ok')).toHaveText(/^Saved with your photo\. Open My songs$/)

  const [row] = supabase.songs
  expect(row.photo_path).toBe(`${TEST_USER_ID}/${row.id}.jpg`)
  expect(row.photo_consent_at).toEqual(expect.any(String))

  expect([...supabase.photos.keys()]).toEqual([row.photo_path])
  const uploaded = supabase.photos.get(row.photo_path as string)!
  expect([...uploaded.subarray(0, 3)], 'is a JPEG').toEqual([0xff, 0xd8, 0xff])
  expect(uploaded.includes(Buffer.from('Exif\0\0')), 'EXIF stripped').toBe(false)
  expect(supabase.requests.find((r) => r.path.startsWith('/storage/v1/object/face-photos/'))?.headers['content-type']).toMatch(
    /multipart\/form-data|image\/jpeg/,
  )

  // My songs shows it with its photo, then delete-all clears storage and rows.
  await page.getByRole('button', { name: 'Open My songs' }).click()
  await expect(page.getByTestId('song-card')).toHaveCount(1)
  const thumb = page.locator('.song-card img.thumb')
  await expect(thumb).toBeVisible()
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

  page.on('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Delete all my songs and photos' }).click()
  await expect(page.getByText('No saved songs yet.')).toBeVisible()
  expect(supabase.photos.size).toBe(0)
  expect(supabase.songs).toHaveLength(0)
})
