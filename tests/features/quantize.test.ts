import { describe, expect, it } from 'vitest'
import { DEFAULT_BINS, extractFeatures, FEATURE_NAMES, FEATURE_RANGES, quantize, type FaceFeatures } from '../../src/features/index.ts'
import { canonicalFace } from '../helpers/face.ts'

const base = extractFeatures(canonicalFace)

/** Every feature set to the same fraction t of its range. */
function atFraction(t: number): FaceFeatures {
  const f = {} as Record<keyof FaceFeatures, number>
  for (const name of FEATURE_NAMES) {
    const [min, max] = FEATURE_RANGES[name]
    f[name] = min + t * (max - min)
  }
  return f
}

describe('quantize', () => {
  it('maps every feature to an integer bin within range', () => {
    const q = quantize(base)
    expect(Object.keys(q).sort()).toEqual([...FEATURE_NAMES].sort())
    for (const name of FEATURE_NAMES) {
      expect(Number.isInteger(q[name]), name).toBe(true)
      expect(q[name]).toBeGreaterThanOrEqual(0)
      expect(q[name]).toBeLessThan(DEFAULT_BINS)
    }
  })

  it('puts the canonical face in the middle bin, away from bin edges', () => {
    // Canonical values sit mid-range (except symmetry, which is at its max).
    const q = quantize(base)
    for (const name of FEATURE_NAMES) expect(q[name], name).toBe(name === 'symmetry' ? DEFAULT_BINS - 1 : 2)
  })

  it('splits the range into equal bins', () => {
    expect(Object.values(quantize(atFraction(0)))).toEqual(FEATURE_NAMES.map(() => 0))
    expect(Object.values(quantize(atFraction(0.19)))).toEqual(FEATURE_NAMES.map(() => 0))
    expect(Object.values(quantize(atFraction(0.21)))).toEqual(FEATURE_NAMES.map(() => 1))
    expect(Object.values(quantize(atFraction(0.99)))).toEqual(FEATURE_NAMES.map(() => 4))
    expect(Object.values(quantize(atFraction(1)))).toEqual(FEATURE_NAMES.map(() => 4))
  })

  it('clamps out-of-range values to the edge bins', () => {
    expect(Object.values(quantize(atFraction(-3)))).toEqual(FEATURE_NAMES.map(() => 0))
    expect(Object.values(quantize(atFraction(7)))).toEqual(FEATURE_NAMES.map(() => DEFAULT_BINS - 1))
  })

  it('respects a custom bin count', () => {
    expect(quantize(atFraction(0.55), 10).faceAspect).toBe(5)
    expect(quantize(atFraction(0.5), 1).faceAspect).toBe(0)
  })

  it('rejects invalid bin counts and non-finite features', () => {
    expect(() => quantize(base, 0)).toThrow(RangeError)
    expect(() => quantize(base, 2.5)).toThrow(RangeError)
    expect(() => quantize({ ...base, jawAngle: Number.NaN })).toThrow(/jawAngle/)
  })

  it('has a valid range for every feature', () => {
    for (const name of FEATURE_NAMES) {
      const [min, max] = FEATURE_RANGES[name]
      expect(max, name).toBeGreaterThan(min)
    }
  })
})
