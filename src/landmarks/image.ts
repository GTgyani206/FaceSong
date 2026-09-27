/**
 * Decode an uploaded photo the way the user sees it: EXIF orientation is
 * applied, so a phone portrait tagged "rotate 90°" arrives upright.
 */
export function decodeImage(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' })
}
