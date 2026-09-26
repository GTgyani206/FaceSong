import fixture from '../fixtures/canonical-face.json'
import type { Landmark } from '../../src/features/index.ts'

/** 478 frontal landmarks from MediaPipe's canonical face model. */
export const canonicalFace: readonly Landmark[] = fixture.landmarks

type Mat3 = number[][]

const DEG = Math.PI / 180

function mul(a: Mat3, b: Mat3): Mat3 {
  return a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)))
}

/** R = Ry(yaw) · Rx(pitch) · Rz(roll), degrees, image space — same convention as HeadPose. */
export function rotationMatrix(yaw: number, pitch: number, roll: number): Mat3 {
  const [cy, sy] = [Math.cos(yaw * DEG), Math.sin(yaw * DEG)]
  const [cp, sp] = [Math.cos(pitch * DEG), Math.sin(pitch * DEG)]
  const [cr, sr] = [Math.cos(roll * DEG), Math.sin(roll * DEG)]
  const ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
  const rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]]
  const rz = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]]
  return mul(mul(ry, rx), rz)
}

function centroid(points: readonly Landmark[]): Landmark {
  const n = points.length
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
    z: points.reduce((s, p) => s + p.z, 0) / n,
  }
}

/** Rigidly rotate about the centroid. */
export function rotate(points: readonly Landmark[], yaw: number, pitch: number, roll: number): Landmark[] {
  const r = rotationMatrix(yaw, pitch, roll)
  const c = centroid(points)
  return points.map((p) => {
    const v = [p.x - c.x, p.y - c.y, p.z - c.z]
    return {
      x: c.x + r[0][0] * v[0] + r[0][1] * v[1] + r[0][2] * v[2],
      y: c.y + r[1][0] * v[0] + r[1][1] * v[1] + r[1][2] * v[2],
      z: c.z + r[2][0] * v[0] + r[2][1] * v[1] + r[2][2] * v[2],
    }
  })
}

/** In-plane rotation about the viewing axis. */
export const rotateInPlane = (points: readonly Landmark[], degrees: number) => rotate(points, 0, 0, degrees)

/** Uniform scale about the origin (all three axes, as a closer/larger photo would). */
export const scale = (points: readonly Landmark[], k: number): Landmark[] =>
  points.map((p) => ({ x: p.x * k, y: p.y * k, z: p.z * k }))

export const translate = (points: readonly Landmark[], dx: number, dy: number, dz = 0): Landmark[] =>
  points.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz }))

/** Copy with landmark `index` moved by (dx, dy). */
export function nudge(points: readonly Landmark[], index: number, dx: number, dy: number): Landmark[] {
  return points.map((p, i) => (i === index ? { x: p.x + dx, y: p.y + dy, z: p.z } : p))
}
