// Builds tests/fixtures/images/exif-orientation-6.jpg: a synthetic image whose
// pixels are stored rotated 90° counter-clockwise, tagged EXIF Orientation 6.
// Displayed correctly it is 40×60 (portrait) with the top third red and the
// rest blue; a decoder that ignores EXIF shows 60×40 with red on the left.
//
// Usage: node scripts/build-exif-fixture.ts   (Node ≥ 22.18 runs .ts directly)
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { withExifOrientation } from '../tests/helpers/exif.ts'

const browser = await chromium.launch()
const page = await browser.newPage()
const base64: string = await page.evaluate(() => {
  const c = document.createElement('canvas')
  c.width = 60 // stored width = displayed height
  c.height = 40
  const g = c.getContext('2d')!
  g.fillStyle = '#0000ff'
  g.fillRect(0, 0, 60, 40)
  g.fillStyle = '#ff0000'
  g.fillRect(0, 0, 20, 40) // left third of storage = top third once rotated CW
  return c.toDataURL('image/jpeg', 0.95).split(',')[1]
})
await browser.close()

const jpeg = withExifOrientation(new Uint8Array(Buffer.from(base64, 'base64')), 6)
writeFileSync(new URL('../tests/fixtures/images/exif-orientation-6.jpg', import.meta.url), jpeg)
console.log(`wrote exif-orientation-6.jpg (${jpeg.length} bytes)`)
