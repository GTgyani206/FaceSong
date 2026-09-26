import { LANDMARK_COUNT, type Landmark } from './types.ts'

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z)
  if (!(len > 0)) throw new RangeError('Cannot normalize a zero-length vector')
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

export function mean(points: readonly Vec3[]): Vec3 {
  let x = 0
  let y = 0
  let z = 0
  for (const p of points) {
    x += p.x
    y += p.y
    z += p.z
  }
  return { x: x / points.length, y: y / points.length, z: z / points.length }
}

/** Distance in the image plane (ignores z). */
export const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

/** Angle at `vertex` between rays to `a` and `b`, in the image plane, in degrees. */
export function angle2(a: Vec2, vertex: Vec2, b: Vec2): number {
  const ax = a.x - vertex.x
  const ay = a.y - vertex.y
  const bx = b.x - vertex.x
  const by = b.y - vertex.y
  // atan2 of cross/dot is better conditioned than acos near 0° and 180°.
  return (Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by) * 180) / Math.PI
}

export const toDegrees = (rad: number): number => (rad * 180) / Math.PI

/** Throws unless `landmarks` is a full MediaPipe face mesh with finite coordinates. */
export function assertLandmarks(landmarks: readonly Landmark[]): void {
  if (landmarks.length !== LANDMARK_COUNT) {
    throw new RangeError(`Expected ${LANDMARK_COUNT} landmarks, got ${landmarks.length}`)
  }
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i]
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      throw new RangeError(`Landmark ${i} has a non-finite coordinate`)
    }
  }
}
