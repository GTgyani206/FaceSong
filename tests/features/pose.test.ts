import { describe, expect, it } from 'vitest'
import { analyzeFace, checkPose, estimateHeadPose, extractFeatures } from '../../src/features/index.ts'
import { canonicalFace, rotate, rotateInPlane, scale, translate } from '../helpers/face.ts'

// The fixture is rounded to 6 decimals, so "zero" is only zero to ~1e-4°.
const PRECISION = 3

describe('estimateHeadPose', () => {
  it('reads the canonical face as frontal', () => {
    const pose = estimateHeadPose(canonicalFace)
    expect(pose.yaw).toBeCloseTo(0, PRECISION)
    expect(pose.pitch).toBeCloseTo(0, PRECISION)
    expect(pose.roll).toBeCloseTo(0, PRECISION)
  })

  it.each([
    [20, 0, 0],
    [-35, 0, 0],
    [0, 18, 0],
    [0, -25, 0],
    [0, 0, 60],
    [10, -8, 30],
    [-14, 14, -120],
  ])('recovers yaw %s°, pitch %s°, roll %s°', (yaw, pitch, roll) => {
    const pose = estimateHeadPose(rotate(canonicalFace, yaw, pitch, roll))
    expect(pose.yaw).toBeCloseTo(yaw, PRECISION)
    expect(pose.pitch).toBeCloseTo(pitch, PRECISION)
    expect(pose.roll).toBeCloseTo(roll, PRECISION)
  })

  it('is unaffected by scale and translation', () => {
    const tilted = rotate(canonicalFace, 12, -9, 5)
    const expected = estimateHeadPose(tilted)
    const moved = estimateHeadPose(translate(scale(tilted, 800), 40, -12, 3))
    expect(moved.yaw).toBeCloseTo(expected.yaw, 9)
    expect(moved.pitch).toBeCloseTo(expected.pitch, 9)
    expect(moved.roll).toBeCloseTo(expected.roll, 9)
  })
})

describe('pose rejection', () => {
  it.each([
    [16, 0, 'yaw'],
    [-20, 0, 'yaw'],
    [40, 5, 'yaw'],
    [0, 16, 'pitch'],
    [0, -22, 'pitch'],
    [5, 30, 'pitch'],
  ] as const)('rejects yaw %s°, pitch %s° (%s)', (yaw, pitch, reason) => {
    const result = analyzeFace(rotate(canonicalFace, yaw, pitch, 0))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.rejected).toBe(reason)
  })

  it.each([
    [0, 0],
    [14, 0],
    [-14, 0],
    [0, 14],
    [0, -14],
    [10, -10],
  ])('accepts yaw %s°, pitch %s°', (yaw, pitch) => {
    expect(analyzeFace(rotate(canonicalFace, yaw, pitch, 0)).ok).toBe(true)
  })

  it('never rejects in-plane roll, and features match the upright face', () => {
    const result = analyzeFace(rotateInPlane(canonicalFace, 75))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.pose.roll).toBeCloseTo(75, PRECISION)
    if (result.ok) expect(result.features.faceAspect).toBeCloseTo(extractFeatures(canonicalFace).faceAspect, 9)
  })

  it('honours custom limits', () => {
    const pose = { yaw: 12, pitch: 3, roll: 0 }
    expect(checkPose(pose)).toBeNull()
    expect(checkPose(pose, { maxYaw: 10, maxPitch: 10 })).toBe('yaw')
    expect(checkPose({ yaw: 0, pitch: -6, roll: 0 }, { maxYaw: 10, maxPitch: 5 })).toBe('pitch')
  })
})
