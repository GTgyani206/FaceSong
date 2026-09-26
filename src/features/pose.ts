import { assertLandmarks, cross, mean, normalize, sub, toDegrees, type Vec3 } from './geometry.ts'
import type { HeadPose, Landmark } from './types.ts'

/*
 * Head pose from a face-anchored frame.
 *
 * We build an orthonormal frame from averaged landmark groups — a
 * right→left axis and a chin→forehead axis — for both the observed face and
 * MediaPipe's canonical (frontal) face model. The rotation between the two
 * frames is the head pose, so the canonical face reads as exactly 0/0/0 and
 * no pitch calibration constant is needed.
 *
 * Landmark groups (MediaPipe indices, subject's right/left):
 *   right side: 234 face edge, 33 eye outer corner, 61 mouth corner, 172 jaw
 *   left side:  454 face edge, 263 eye outer corner, 291 mouth corner, 397 jaw
 *   upper midline: 10 forehead top, 168 nasion
 *   lower midline: 152 chin, 17 lower-lip bottom
 *
 * Accuracy depends on MediaPipe's z being on roughly the same scale as x,
 * which it is documented to be.
 */

const RIGHT = [234, 33, 61, 172] as const
const LEFT = [454, 263, 291, 397] as const
const UP = [10, 168] as const
const DOWN = [152, 17] as const

/**
 * MediaPipe canonical_face_model.obj vertices for the indices above,
 * converted to image space (x, −y, −z). Units: cm.
 */
const CANONICAL: Readonly<Record<number, Vec3>> = {
  234: { x: -7.664182, y: -0.673132, z: 2.435867 },
  33: { x: -4.445859, y: -2.663991, z: -3.173422 },
  61: { x: -2.456206, y: 4.342621, z: -4.283884 },
  172: { x: -5.940524, y: 6.223629, z: 0.631468 },
  454: { x: 7.664182, y: -0.673132, z: 2.435867 },
  263: { x: 4.445859, y: -2.663991, z: -3.173422 },
  291: { x: 2.456206, y: 4.342621, z: -4.283884 },
  397: { x: 5.940524, y: 6.223629, z: 0.631468 },
  10: { x: 0, y: -8.261778, z: -4.481535 },
  168: { x: 0, y: -3.271027, z: -5.236015 },
  152: { x: 0, y: 9.403378, z: -4.264492 },
  17: { x: 0, y: 5.365123, z: -5.535441 },
}

/** Rotation matrix, row-major: m[row][col]. */
type Mat3 = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]]

/** Columns: across (right→left), up (in-plane, ⟂ across), normal. */
function faceFrame(at: (i: number) => Vec3): Mat3 {
  const group = (ids: readonly number[]) => mean(ids.map(at))
  const u = normalize(sub(group(LEFT), group(RIGHT)))
  const w = sub(group(UP), group(DOWN))
  const n = normalize(cross(u, w))
  const v = cross(n, u)
  return [
    [u.x, v.x, n.x],
    [u.y, v.y, n.y],
    [u.z, v.z, n.z],
  ]
}

const CANONICAL_FRAME = faceFrame((i) => CANONICAL[i])

export function estimateHeadPose(landmarks: readonly Landmark[]): HeadPose {
  assertLandmarks(landmarks)
  const f = faceFrame((i) => landmarks[i])
  const c = CANONICAL_FRAME
  // R = F_observed · F_canonicalᵀ
  const r = (i: number, j: number) => f[i][0] * c[j][0] + f[i][1] * c[j][1] + f[i][2] * c[j][2]

  // Decompose R = Ry(yaw) · Rx(pitch) · Rz(roll).
  return {
    yaw: toDegrees(Math.atan2(r(0, 2), r(2, 2))),
    pitch: toDegrees(Math.asin(Math.max(-1, Math.min(1, -r(1, 2))))),
    roll: toDegrees(Math.atan2(r(1, 0), r(1, 1))),
  }
}

export interface PoseLimits {
  /** Max |yaw| in degrees. */
  readonly maxYaw: number
  /** Max |pitch| in degrees. */
  readonly maxPitch: number
}

export const DEFAULT_POSE_LIMITS: PoseLimits = { maxYaw: 15, maxPitch: 15 }

export type PoseRejection = 'yaw' | 'pitch'

/**
 * Returns why the pose is unusable, or null if it is acceptable.
 * Roll is never rejected: features are invariant to in-plane rotation.
 */
export function checkPose(pose: HeadPose, limits: PoseLimits = DEFAULT_POSE_LIMITS): PoseRejection | null {
  if (Math.abs(pose.yaw) > limits.maxYaw) return 'yaw'
  if (Math.abs(pose.pitch) > limits.maxPitch) return 'pitch'
  return null
}
