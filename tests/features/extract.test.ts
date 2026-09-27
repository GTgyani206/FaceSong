import { describe, expect, it } from 'vitest'
import { extractFeatures, FEATURE_NAMES, quantizeIdentity, type FaceFeatures } from '../../src/features/index.ts'
import { canonicalFace, nudge, rotateInPlane, scale, translate } from '../helpers/face.ts'

const base = extractFeatures(canonicalFace)

function expectSameFeatures(actual: FaceFeatures, expected: FaceFeatures) {
  for (const name of FEATURE_NAMES) {
    expect(actual[name], name).toBeCloseTo(expected[name], 9)
  }
  // Discrete bins — what the engine hashes — must be exactly identical.
  expect(quantizeIdentity(actual).discrete).toEqual(quantizeIdentity(expected).discrete)
}

describe('extractFeatures', () => {
  it('returns every named feature as a finite number', () => {
    expect(Object.keys(base).sort()).toEqual([...FEATURE_NAMES].sort())
    for (const name of FEATURE_NAMES) expect(Number.isFinite(base[name]), name).toBe(true)
  })

  it('scores the canonical face as perfectly symmetric', () => {
    expect(base.symmetry).toBeCloseTo(1, 6)
  })

  it('is deterministic', () => {
    expect(extractFeatures(canonicalFace)).toEqual(base)
  })

  describe('invariance', () => {
    it.each([0.01, 0.5, 3.7, 1920])('under uniform scale ×%s', (k) => {
      expectSameFeatures(extractFeatures(scale(canonicalFace, k)), base)
    })

    it.each([
      [0.3, -0.2],
      [-500, 1200],
      [1e4, 1e4],
    ])('under translation by (%s, %s)', (dx, dy) => {
      expectSameFeatures(extractFeatures(translate(canonicalFace, dx, dy, 0.1)), base)
    })

    it.each([1, 12, 45, 90, 180, -30, 271])('under in-plane rotation by %s°', (deg) => {
      expectSameFeatures(extractFeatures(rotateInPlane(canonicalFace, deg)), base)
    })

    it('under scale + translation + rotation combined', () => {
      const moved = translate(rotateInPlane(scale(canonicalFace, 640), -23), 311, -97)
      expectSameFeatures(extractFeatures(moved), base)
    })
  })

  describe('sensitivity', () => {
    it('mouthWidth grows when a mouth corner moves outward', () => {
      // 291 = subject's left mouth corner (image +x side).
      const wider = extractFeatures(nudge(canonicalFace, 291, 0.02, 0))
      expect(wider.mouthWidth).toBeGreaterThan(base.mouthWidth)
      expect(wider.faceAspect).toBe(base.faceAspect)
    })

    it('symmetry drops when one eye sits higher than the other', () => {
      let face = canonicalFace
      for (const i of [33, 133, 159, 145]) face = nudge(face, i, 0, -0.04)
      expect(extractFeatures(face).symmetry).toBeLessThan(base.symmetry - 0.01)
    })

    it('ignores unstable face-contour landmarks (forehead top, face and temple edges)', () => {
      let face = canonicalFace
      for (const i of [10, 234, 454, 127, 356, 93, 323, 162, 389]) face = nudge(face, i, 0.03, -0.03)
      expect(extractFeatures(face)).toEqual(base)
    })

    it('ignores the iris landmarks (468–477)', () => {
      expect(extractFeatures(nudge(canonicalFace, 470, 0.05, 0.05))).toEqual(base)
    })
  })

  describe('validation', () => {
    it('rejects the wrong landmark count', () => {
      expect(() => extractFeatures(canonicalFace.slice(0, 468))).toThrow(/478/)
    })

    it('rejects non-finite coordinates', () => {
      const bad = canonicalFace.map((p, i) => (i === 7 ? { ...p, y: Number.NaN } : p))
      expect(() => extractFeatures(bad)).toThrow(/Landmark 7/)
    })

    it('rejects a collapsed face', () => {
      const flat = canonicalFace.map(() => ({ x: 0.5, y: 0.5, z: 0 }))
      expect(() => extractFeatures(flat)).toThrow(/Degenerate/)
    })
  })
})
