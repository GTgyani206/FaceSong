/**
 * landmarks/ — MediaPipe wrapper only (browser). Emits isotropic landmarks
 * for features/ (see CLAUDE.md).
 *
 * This entry point is light: MediaPipe's JS, wasm runtime and model are only
 * fetched when `loadFaceDetector()` is first called.
 */
import type { FaceDetector } from './detector.ts'

export type { FaceDetection, FaceDetector } from './detector.ts'

let detector: Promise<FaceDetector> | null = null

/** Lazily loads MediaPipe and creates the shared detector (once). */
export function loadFaceDetector(): Promise<FaceDetector> {
  detector ??= import('./detector.ts').then((m) => m.createFaceDetector())
  detector.catch(() => (detector = null)) // allow a retry after a failed load
  return detector
}

export { decodeImage } from './image.ts'
export { toIsotropic } from './scale.ts'
export type { NormalizedPoint } from './scale.ts'
export { addInPlaneRoll, rotationFromTransform } from './transform.ts'
export { eyeRoll, fromUpright, planUpright, toUpright, UPRIGHT_THRESHOLD_DEG } from './upright.ts'
export type { UprightPlan } from './upright.ts'
