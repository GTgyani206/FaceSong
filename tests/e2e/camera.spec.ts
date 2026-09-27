import { expect, test } from '@playwright/test'
import { mockSupabase } from './helpers.ts'

// Chromium's fake camera shows a test pattern (no face) without a permission prompt.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
})

test('captures a frame from the camera and runs it through the pipeline', async ({ page }) => {
  const supabase = await mockSupabase(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Use camera' }).click()
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeEnabled({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Take photo' }).click()
  await expect(page.getByTestId('rejection')).toContainText('No face found', { timeout: 60_000 })
  expect(supabase.requests).toEqual([])
})
