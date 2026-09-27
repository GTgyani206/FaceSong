import { expect, test } from '@playwright/test'

// The main app starts fetching MediaPipe's wasm and model on load, before
// any capture. Asset requests (not the `?import` module shims Vite serves).
test('the app prefetches the model and wasm on first load, without interaction', async ({ page }) => {
  const isAsset = (url: string, file: RegExp) => file.test(new URL(url).pathname) && !url.includes('?import')
  const wasm = page.waitForResponse((r) => isAsset(r.url(), /vision_wasm_internal[^/]*\.wasm$/) && r.ok(), { timeout: 30_000 })
  const model = page.waitForResponse((r) => isAsset(r.url(), /face_landmarker[^/]*\.task$/) && r.ok(), { timeout: 30_000 })
  await page.goto('/')
  await expect(wasm).resolves.toBeTruthy()
  await expect(model).resolves.toBeTruthy()
})
