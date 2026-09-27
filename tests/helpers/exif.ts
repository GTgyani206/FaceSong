/**
 * Minimal EXIF writer/reader for test images: inserts an APP1 segment whose
 * only IFD0 entry is Orientation (tag 0x0112). Pure; works on JPEG bytes.
 *
 * Orientation 6 = "rotate 90° clockwise to display", 8 = "90° counter-clockwise",
 * 3 = "180°", 1 = as stored.
 */
export function withExifOrientation(jpeg: Uint8Array, orientation: number): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('Not a JPEG (missing SOI)')
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD0 at offset 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, // Orientation, SHORT, count 1
    (orientation >> 8) & 0xff, orientation & 0xff, 0x00, 0x00, // value, padding
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff] // "Exif\0\0"
  const length = payload.length + 2
  const app1 = [0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload]

  // Insert after SOI and any APP0 (JFIF) segment.
  let at = 2
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) at = 4 + ((jpeg[4] << 8) | jpeg[5])
  const out = new Uint8Array(jpeg.length + app1.length)
  out.set(jpeg.subarray(0, at), 0)
  out.set(app1, at)
  out.set(jpeg.subarray(at), at + app1.length)
  return out
}

/** Reads the EXIF Orientation written by `withExifOrientation` (or any big-endian EXIF). */
export function readExifOrientation(jpeg: Uint8Array): number | null {
  let i = 2
  while (i + 4 < jpeg.length && jpeg[i] === 0xff) {
    const marker = jpeg[i + 1]
    const len = (jpeg[i + 2] << 8) | jpeg[i + 3]
    if (marker === 0xe1 && String.fromCharCode(...jpeg.subarray(i + 4, i + 8)) === 'Exif') {
      const t = i + 10
      const be = jpeg[t] === 0x4d
      const u16 = (o: number) => (be ? (jpeg[t + o] << 8) | jpeg[t + o + 1] : jpeg[t + o] | (jpeg[t + o + 1] << 8))
      const u32 = (o: number) => (be ? (u16(o) << 16) | u16(o + 2) : u16(o) | (u16(o + 2) << 16))
      const ifd = u32(4)
      for (let e = 0; e < u16(ifd); e++) {
        const entry = ifd + 2 + e * 12
        if (u16(entry) === 0x0112) return u16(entry + 8)
      }
      return null
    }
    if (marker === 0xda) break // start of scan: no more metadata
    i += 2 + len
  }
  return null
}
