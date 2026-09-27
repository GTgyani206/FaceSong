import { describe, expect, it } from 'vitest'
import {
  CONTINUOUS_IDENTITY,
  DISCRETE_BINS,
  DISCRETE_IDENTITY,
  extractFeatures,
  FEATURE_NAMES,
  FEATURE_RANGES,
  normalizeFeature,
  normalizeFeatures,
  quantizeIdentity,
  type FaceFeatures,
} from '../../src/features/index.ts'
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

describe('normalizeFeature', () => {
  it('maps the range onto [0, 1] and clamps outside it', () => {
    const [min, max] = FEATURE_RANGES.jawAngle
    expect(normalizeFeature('jawAngle', min)).toBe(0)
    expect(normalizeFeature('jawAngle', max)).toBe(1)
    expect(normalizeFeature('jawAngle', (min + max) / 2)).toBeCloseTo(0.5, 12)
    expect(normalizeFeature('jawAngle', min - 100)).toBe(0)
    expect(normalizeFeature('jawAngle', max + 100)).toBe(1)
  })

  it('rejects non-finite values', () => {
    expect(() => normalizeFeature('faceAspect', Number.NaN)).toThrow(/faceAspect/)
  })

  it('normalizeFeatures covers every feature', () => {
    const n = normalizeFeatures(base)
    expect(Object.keys(n).sort()).toEqual([...FEATURE_NAMES].sort())
    for (const name of FEATURE_NAMES) {
      expect(n[name]).toBeGreaterThanOrEqual(0)
      expect(n[name]).toBeLessThanOrEqual(1)
    }
  })
})

describe('quantizeIdentity', () => {
  it('bins discrete identity features into DISCRETE_BINS = 3 bins', () => {
    expect(DISCRETE_BINS).toBe(3)
    const q = quantizeIdentity(base)
    expect(Object.keys(q.discrete)).toEqual([...DISCRETE_IDENTITY])
    for (const name of DISCRETE_IDENTITY) {
      expect(Number.isInteger(q.discrete[name]), name).toBe(true)
      expect(q.discrete[name]).toBeGreaterThanOrEqual(0)
      expect(q.discrete[name]).toBeLessThan(DISCRETE_BINS)
    }
  })

  it('exports continuous identity features as unbinned 0–1 values', () => {
    const q = quantizeIdentity(base)
    expect(Object.keys(q.continuous)).toEqual([...CONTINUOUS_IDENTITY])
    for (const name of CONTINUOUS_IDENTITY) expect(q.continuous[name]).toBe(normalizeFeature(name, base[name]))
    // Unbinned: a small change in the feature gives a small change in the value.
    const nudged = quantizeIdentity({ ...base, faceAspect: base.faceAspect + 0.001 })
    expect(nudged.continuous.faceAspect).toBeGreaterThan(q.continuous.faceAspect)
    expect(nudged.continuous.faceAspect - q.continuous.faceAspect).toBeLessThan(0.01)
  })

  it('splits each range into three equal bins', () => {
    const bins = (t: number) => Object.values(quantizeIdentity(atFraction(t)).discrete)
    expect(bins(0)).toEqual([0, 0, 0])
    expect(bins(0.32)).toEqual([0, 0, 0])
    expect(bins(0.34)).toEqual([1, 1, 1])
    expect(bins(0.65)).toEqual([1, 1, 1])
    expect(bins(0.68)).toEqual([2, 2, 2])
    expect(bins(1)).toEqual([2, 2, 2])
    expect(bins(-3)).toEqual([0, 0, 0])
    expect(bins(7)).toEqual([2, 2, 2])
  })

  it('keeps the canonical face well inside a discrete bin', () => {
    // Invariance tests compare bins, so a canonical value near an edge would make them flaky.
    for (const name of DISCRETE_IDENTITY) {
      const t = normalizeFeature(name, base[name]) * DISCRETE_BINS
      const frac = t - Math.floor(t)
      expect(frac, name).toBeGreaterThan(0.15)
      expect(frac, name).toBeLessThan(0.85)
    }
  })

  it('has a valid range for every feature', () => {
    for (const name of FEATURE_NAMES) {
      const [min, max] = FEATURE_RANGES[name]
      expect(max, name).toBeGreaterThan(min)
    }
  })
})
