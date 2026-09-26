import { describe, expect, it } from 'vitest'
import { extractFeatures, eulerFromRotation } from '../../src/features/index.ts'
import { toIsotropic } from '../../src/landmarks/scale.ts'
import { rotationFromTransform } from '../../src/landmarks/transform.ts'
import { canonicalFace, rotationMatrix } from '../helpers/face.ts'

describe('toIsotropic', () => {
  it('scales x and z by width, y by height', () => {
    expect(toIsotropic([{ x: 0.5, y: 0.25, z: -0.1 }], 800, 600)).toEqual([{ x: 400, y: 150, z: -80 }])
  })

  it('drops extra MediaPipe fields', () => {
    const [p] = toIsotropic([{ x: 0, y: 0, z: 0, visibility: 1 } as never], 10, 10)
    expect(Object.keys(p).sort()).toEqual(['x', 'y', 'z'])
  })

  it('undoes non-square normalization, so features match the true geometry', () => {
    // Treat the canonical fixture as pixel coords in a 1000×1000 frame, then
    // normalize it as MediaPipe would for an 820×1024 image.
    const [w, h] = [820, 1024]
    const normalized = canonicalFace.map((p) => ({ x: (p.x * 1000) / w, y: (p.y * 1000) / h, z: (p.z * 1000) / w }))
    const expected = extractFeatures(canonicalFace)
    const actual = extractFeatures(toIsotropic(normalized, w, h))
    for (const [name, value] of Object.entries(expected)) {
      expect(actual[name as keyof typeof expected], name).toBeCloseTo(value, 9)
    }
    // Without the fix-up, the non-square image distorts the face.
    expect(extractFeatures(normalized).faceAspect).not.toBeCloseTo(expected.faceAspect, 2)
  })

  it('rejects an invalid image size', () => {
    expect(() => toIsotropic([], 0, 10)).toThrow(RangeError)
  })
})

describe('rotationFromTransform', () => {
  /** Image-space rotation → MediaPipe-style column-major GL matrix with scale and translation. */
  function toMediaPipeMatrix(yaw: number, pitch: number, roll: number, scale = 1.3): number[] {
    const r = rotationMatrix(yaw, pitch, roll)
    const f = [1, -1, -1]
    const data = new Array<number>(16).fill(0)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) data[j * 4 + i] = f[i] * f[j] * r[i][j] * scale
    data[12] = 1.5
    data[13] = -2
    data[14] = -45
    data[15] = 1
    return data
  }

  it.each([
    [0, 0, 0],
    [20, 0, 0],
    [0, -12, 0],
    [0, 0, 90],
    [9, 7, -30],
  ])('recovers yaw %s°, pitch %s°, roll %s°', (yaw, pitch, roll) => {
    const pose = eulerFromRotation(rotationFromTransform(toMediaPipeMatrix(yaw, pitch, roll)))
    expect(pose.yaw).toBeCloseTo(yaw, 9)
    expect(pose.pitch).toBeCloseTo(pitch, 9)
    expect(pose.roll).toBeCloseTo(roll, 9)
  })

  it('rejects a non-4×4 matrix', () => {
    expect(() => rotationFromTransform([1, 0, 0])).toThrow(RangeError)
  })
})
