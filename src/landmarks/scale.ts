import type { Landmark } from '../features/index.ts'

/** A landmark as MediaPipe returns it: x ∈ [0,1] of image width, y ∈ [0,1] of height. */
export interface NormalizedPoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * MediaPipe normalized coords → isotropic units (pixels), as features/
 * requires: x·width, y·height, and z·width (MediaPipe's z is on the same
 * scale as x). Pure; drops any extra fields such as `visibility`.
 */
export function toIsotropic(points: readonly NormalizedPoint[], width: number, height: number): Landmark[] {
  if (!(width > 0 && height > 0)) throw new RangeError(`Invalid image size ${width}×${height}`)
  return points.map((p) => ({ x: p.x * width, y: p.y * height, z: p.z * width }))
}
