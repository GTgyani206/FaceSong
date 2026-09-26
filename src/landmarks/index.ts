/**
 * landmarks/ — MediaPipe wrapper only (browser). Emits isotropic landmarks
 * for features/ (see CLAUDE.md).
 */
export { createFaceDetector } from './detector.ts'
export type { FaceDetection, FaceDetector } from './detector.ts'
export { toIsotropic } from './scale.ts'
export type { NormalizedPoint } from './scale.ts'
export { rotationFromTransform } from './transform.ts'
