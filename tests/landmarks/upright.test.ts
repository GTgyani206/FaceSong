import { describe, expect, it } from 'vitest'
import { estimateHeadPose, eulerFromRotation } from '../../src/features/index.ts'
import { addInPlaneRoll, rotationFromTransform } from '../../src/landmarks/transform.ts'
import { eyeRoll, fromUpright, planUpright, toUpright } from '../../src/landmarks/upright.ts'
import { canonicalFace, rotateInPlane, rotationMatrix, scale } from '../helpers/face.ts'

// Canonical face as pixels in an 800×1000 photo.
const face = scale(canonicalFace, 1000)
const [W, H] = [800, 1000]

describe('eyeRoll', () => {
  it('reads a level face as 0°', () => {
    expect(eyeRoll(face)).toBeCloseTo(0, 6)
  })

  it.each([3, 10, -10, 45, 90, -135, 180])('recovers an in-plane rotation of %s°', (deg) => {
    const expected = deg === 180 ? 180 : deg
    expect(Math.abs(eyeRoll(rotateInPlane(face, deg)))).toBeCloseTo(Math.abs(expected), 6)
    if (deg !== 180) expect(eyeRoll(rotateInPlane(face, deg))).toBeCloseTo(deg, 6)
  })

  it('agrees with the head-pose roll', () => {
    const tilted = rotateInPlane(face, 27)
    expect(eyeRoll(tilted)).toBeCloseTo(estimateHeadPose(tilted).roll, 3)
  })
})

describe('upright plan', () => {
  it('sizes the canvas to fit the rotated image', () => {
    expect(planUpright(W, H, 0)).toMatchObject({ width: 800, height: 1000 })
    expect(planUpright(W, H, 90)).toMatchObject({ width: 1000, height: 800 })
    const p = planUpright(W, H, 10)
    expect(p.width).toBe(Math.ceil(800 * Math.cos(Math.PI / 18) + 1000 * Math.sin(Math.PI / 18)))
  })

  it('keeps every image corner on the canvas', () => {
    for (const roll of [7, -33, 90, 150]) {
      const plan = planUpright(W, H, roll)
      for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
        const q = toUpright(plan, { x, y, z: 0 })
        expect(q.x).toBeGreaterThanOrEqual(-1e-9)
        expect(q.y).toBeGreaterThanOrEqual(-1e-9)
        expect(q.x).toBeLessThanOrEqual(plan.width + 1e-9)
        expect(q.y).toBeLessThanOrEqual(plan.height + 1e-9)
      }
    }
  })

  it('round-trips points between the two frames', () => {
    const plan = planUpright(W, H, -23)
    for (const p of face.slice(0, 50)) {
      const back = fromUpright(plan, toUpright(plan, p))
      expect(back.x).toBeCloseTo(p.x, 9)
      expect(back.y).toBeCloseTo(p.y, 9)
      expect(back.z).toBe(p.z)
    }
  })

  it.each([10, -10, 90, -170])('straightens a face tilted by %s°', (deg) => {
    const tilted = rotateInPlane(face, deg)
    const plan = planUpright(W, H, eyeRoll(tilted))
    expect(eyeRoll(tilted.map((p) => toUpright(plan, p)))).toBeCloseTo(0, 6)
  })
})

describe('addInPlaneRoll', () => {
  function gl(yaw: number, pitch: number, roll: number): number[] {
    const r = rotationMatrix(yaw, pitch, roll)
    const f = [1, -1, -1]
    const data = new Array<number>(16).fill(0)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) data[j * 4 + i] = f[i] * f[j] * r[i][j]
    data[14] = -50
    data[15] = 1
    return data
  }

  it('adds roll to a frontal pose', () => {
    const pose = eulerFromRotation(rotationFromTransform(addInPlaneRoll(gl(0, 0, 5), 20)))
    expect(pose.roll).toBeCloseTo(25, 9)
    expect(pose.yaw).toBeCloseTo(0, 9)
    expect(pose.pitch).toBeCloseTo(0, 9)
  })

  it('equals left-multiplying the image-space rotation by Rz(roll)', () => {
    const rolled = rotationFromTransform(addInPlaneRoll(gl(12, -7, 3), 40))
    const rz = rotationMatrix(0, 0, 40)
    const base = rotationFromTransform(gl(12, -7, 3))
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const expected = rz[i][0] * base[0][j] + rz[i][1] * base[1][j] + rz[i][2] * base[2][j]
        expect(rolled[i][j]).toBeCloseTo(expected, 9)
      }
  })

  it('leaves the translation z and homogeneous row alone', () => {
    const out = addInPlaneRoll(gl(0, 0, 0), 30)
    expect(out[14]).toBe(-50)
    expect(out[15]).toBe(1)
  })
})
