import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readExifOrientation, withExifOrientation } from './exif.ts'

describe('EXIF test helper', () => {
  const fixture = new Uint8Array(readFileSync('tests/fixtures/images/exif-orientation-6.jpg'))

  it('the committed fixture carries orientation 6', () => {
    expect(readExifOrientation(fixture)).toBe(6)
  })

  it('writes an orientation that reads back', () => {
    const plain = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9])
    expect(readExifOrientation(plain)).toBeNull()
    for (const o of [1, 3, 6, 8]) expect(readExifOrientation(withExifOrientation(plain, o))).toBe(o)
  })

  it('rejects non-JPEG input', () => {
    expect(() => withExifOrientation(new Uint8Array([0x89, 0x50]), 6)).toThrow(/JPEG/)
  })
})
