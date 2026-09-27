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

/**
 * Start downloading MediaPipe (JS chunk, wasm, model) and building the
 * detector once the page is idle, so a later capture doesn't wait on the
 * network. Call once at app start. Failures are swallowed here and retried
 * by the next `loadFaceDetector()`.
 */
export function preloadFaceDetector(): void {
  const start = () => void loadFaceDetector().catch(() => {})
  if ('requestIdleCallback' in globalThis) requestIdleCallback(start, { timeout: 2000 })
  else setTimeout(start, 200)
}

export { decodeImage } from './image.ts'
export { toIsotropic } from './scale.ts'
export type { NormalizedPoint } from './scale.ts'
export { addInPlaneRoll, rotationFromTransform } from './transform.ts'
export { eyeRoll, fromUpright, planUpright, toUpright } from './upright.ts'
export type { UprightPlan } from './upright.ts'
