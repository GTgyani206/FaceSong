import type { Landmark } from '../features/index.ts'

/*
 * Upright normalization. MediaPipe's landmarks are least accurate when the
 * face is tilted in the image plane, and that noise is enough to change
 * feature bins. So: estimate roll from the eye corners, redraw the image
 * rotated upright, detect again, and map the landmarks back into the
 * original image's pixel frame. Everything here is pure geometry; the
 * canvas work lives in detector.ts.
 */

/** Re-detect on an upright copy when |roll| exceeds this, in degrees. */
export const UPRIGHT_THRESHOLD_DEG = 3

/**
 * In-plane roll in degrees from the eye line: eye centres are mean(33, 133)
 * (subject's right, image left) and mean(362, 263). 0 = level, positive =
 * clockwise on screen (image y points down). Range (−180, 180].
 */
export function eyeRoll(landmarks: readonly Landmark[]): number {
  const r = landmarks
  const dx = (r[362].x + r[263].x - r[33].x - r[133].x) / 2
  const dy = (r[362].y + r[263].y - r[33].y - r[133].y) / 2
  if (dx === 0 && dy === 0) throw new RangeError('Degenerate landmarks: eyes coincide')
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

/**
 * How to draw a srcWidth×srcHeight image rotated by −roll onto a canvas
 * just large enough to hold it (nothing is cropped).
 */
export interface UprightPlan {
  /** Roll being removed, in degrees. The canvas is rotated by −roll. */
  readonly roll: number
  readonly srcWidth: number
  readonly srcHeight: number
  /** Canvas size, in whole pixels. */
  readonly width: number
  readonly height: number
}

export function planUpright(srcWidth: number, srcHeight: number, roll: number): UprightPlan {
  const r = (roll * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  // Shave float noise (cos 90° ≈ 6e-17) so exact sizes don't round up a pixel.
  const fit = (v: number) => Math.ceil(v - 1e-6)
  return { roll, srcWidth, srcHeight, width: fit(srcWidth * c + srcHeight * s), height: fit(srcWidth * s + srcHeight * c) }
}

/** Rotate (x, y) by `deg` in image space: x′ = x·cos − y·sin, y′ = x·sin + y·cos (as canvas `rotate`). */
function rotate2(x: number, y: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [x * c - y * s, x * s + y * c]
}

/** Original-image pixel → upright-canvas pixel. z is untouched (in-plane rotation). */
export function toUpright(plan: UprightPlan, p: Landmark): Landmark {
  const [x, y] = rotate2(p.x - plan.srcWidth / 2, p.y - plan.srcHeight / 2, -plan.roll)
  return { x: x + plan.width / 2, y: y + plan.height / 2, z: p.z }
}

/** Upright-canvas pixel → original-image pixel. Inverse of `toUpright`. */
export function fromUpright(plan: UprightPlan, p: Landmark): Landmark {
  const [x, y] = rotate2(p.x - plan.width / 2, p.y - plan.height / 2, plan.roll)
  return { x: x + plan.srcWidth / 2, y: y + plan.srcHeight / 2, z: p.z }
}
