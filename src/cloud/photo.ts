/** Longest side of an uploaded photo, in pixels. */
export const MAX_PHOTO_SIDE = 1024

/**
 * Re-encode a decoded photo for upload: downscaled JPEG. Re-encoding from the
 * decoded pixels drops ALL metadata (EXIF, including GPS location), and the
 * image is already upright because decodeImage applied the EXIF orientation.
 */
export async function preparePhoto(image: ImageBitmap): Promise<Blob> {
  const k = Math.min(1, MAX_PHOTO_SIDE / Math.max(image.width, image.height))
  const w = Math.max(1, Math.round(image.width * k))
  const h = Math.max(1, Math.round(image.height * k))
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, w, h)
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 })
}
