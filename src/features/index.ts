/**
 * features/ — PURE: landmarks → normalized, quantizable feature vector.
 * No DOM, no MediaPipe, no randomness. Runs in Node and the browser.
 */
import { extractFeatures } from './extract.ts'
import { checkPose, DEFAULT_POSE_LIMITS, estimateHeadPose, type PoseLimits, type PoseRejection } from './pose.ts'
import type { FaceFeatures, HeadPose, Landmark } from './types.ts'

export { extractFeatures } from './extract.ts'
export { checkPose, DEFAULT_POSE_LIMITS, estimateHeadPose } from './pose.ts'
export type { PoseLimits, PoseRejection } from './pose.ts'
export { DEFAULT_BINS, FEATURE_RANGES, quantize } from './quantize.ts'
export type { QuantizedFeatures } from './quantize.ts'
export { FEATURE_NAMES, LANDMARK_COUNT } from './types.ts'
export type { FaceFeatures, FeatureName, HeadPose, Landmark } from './types.ts'

export type FaceAnalysis =
  | { readonly ok: true; readonly pose: HeadPose; readonly features: FaceFeatures }
  | { readonly ok: false; readonly pose: HeadPose; readonly rejected: PoseRejection }

/** Pose-gated feature extraction: rejects faces turned or tilted too far from the camera. */
export function analyzeFace(landmarks: readonly Landmark[], limits: PoseLimits = DEFAULT_POSE_LIMITS): FaceAnalysis {
  const pose = estimateHeadPose(landmarks)
  const rejected = checkPose(pose, limits)
  if (rejected) return { ok: false, pose, rejected }
  return { ok: true, pose, features: extractFeatures(landmarks) }
}
