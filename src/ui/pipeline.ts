import { composeSong, type SongSpec } from '../engine/index.ts'
import { analyzeFace, quantizeIdentity, type QuantizedIdentity } from '../features/index.ts'
import { loadFaceDetector, type FaceDetection } from '../landmarks/index.ts'

/** Photo → song, through every layer. Nothing here leaves the device. */

export type SongResult =
  | {
      readonly ok: true
      readonly spec: SongSpec
      readonly identity: QuantizedIdentity
      readonly detection: FaceDetection
      readonly warnings: readonly string[]
    }
  | { readonly ok: false; readonly reason: 'no-face' | 'yaw' | 'pitch'; readonly message: string }

/** Identity features assume a closed mouth; above this jawOpen score we warn. */
export const JAW_OPEN_WARNING = 0.15

export async function songFromPhoto(image: ImageBitmap): Promise<SongResult> {
  const detector = await loadFaceDetector()
  const detection = detector.detect(image)
  if (!detection) {
    return { ok: false, reason: 'no-face', message: 'No face found. Try a well-lit photo where your whole face is visible.' }
  }

  const analysis = analyzeFace(detection.landmarks)
  if (!analysis.ok) {
    return analysis.rejected === 'yaw'
      ? { ok: false, reason: 'yaw', message: 'Your face is turned too far to the side. Look straight at the camera.' }
      : { ok: false, reason: 'pitch', message: 'Your head is tilted too far up or down. Hold it level.' }
  }

  const warnings: string[] = []
  if ((detection.blendshapes.jawOpen ?? 0) > JAW_OPEN_WARNING) {
    warnings.push('Your mouth looks open. Close it for a song that stays the same every time.')
  }
  if (detection.faceCount > 1) warnings.push('More than one face is in the photo; the song uses just one of them.')

  const identity = quantizeIdentity(analysis.features)
  return { ok: true, spec: composeSong(identity), identity, detection, warnings }
}
