import type { Mat3 } from '../features/index.ts'

/**
 * MediaPipe's facial transformation matrix (4×4, column-major, canonical face
 * → camera, OpenGL axes: y up, z toward the viewer) → the rotation part in
 * features/ image space (y down, z away), matching `estimateHeadPose`.
 * Pure. Used by the debug page to cross-check our landmark-based pose.
 */
export function rotationFromTransform(data: readonly number[]): Mat3 {
  if (data.length !== 16) throw new RangeError(`Expected a 4×4 matrix, got ${data.length} values`)
  // Column-major: element (row i, col j) is data[j * 4 + i]. Normalize each
  // column to strip any scale.
  const col = (j: number) => {
    const c = [data[j * 4], data[j * 4 + 1], data[j * 4 + 2]]
    const len = Math.hypot(c[0], c[1], c[2])
    if (!(len > 0)) throw new RangeError('Degenerate transformation matrix')
    return c.map((v) => v / len)
  }
  const cols = [col(0), col(1), col(2)]
  // Flip y and z on both sides: R_img = F · R_gl · F with F = diag(1, −1, −1).
  const f = [1, -1, -1]
  const m = (i: number, j: number) => f[i] * f[j] * cols[j][i]
  return [
    [m(0, 0), m(0, 1), m(0, 2)],
    [m(1, 0), m(1, 1), m(1, 2)],
    [m(2, 0), m(2, 1), m(2, 2)],
  ]
}

/**
 * Re-express a transformation matrix measured on an image rotated by −roll
 * (see upright.ts) in the original image's frame, i.e. add `roll` degrees of
 * in-plane rotation. An image-space rotation by θ about the viewing axis is a
 * rotation by −θ about the OpenGL z axis. Returns a new column-major 4×4.
 */
export function addInPlaneRoll(data: readonly number[], roll: number): number[] {
  if (data.length !== 16) throw new RangeError(`Expected a 4×4 matrix, got ${data.length} values`)
  const r = (-roll * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  const out = [...data]
  // Left-multiply by Rz: only rows 0 and 1 of each column change.
  for (let j = 0; j < 4; j++) {
    const x = data[j * 4]
    const y = data[j * 4 + 1]
    out[j * 4] = c * x - s * y
    out[j * 4 + 1] = s * x + c * y
  }
  return out
}
