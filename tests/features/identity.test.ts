import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  EXPRESSION_FEATURES,
  extractFeatures,
  FEATURE_NAMES,
  IDENTITY_FEATURES,
  quantize,
  quantizeIdentity,
  type IdentityFeatureName,
  type QuantizedIdentity,
} from '../../src/features/index.ts'
import { canonicalFace, nudge } from '../helpers/face.ts'

/*
 * Rule (see src/features/types.ts): only IDENTITY_FEATURES may determine the
 * melody or the song's identity. Expression features move with the face's
 * muscles, so the same person would get a different song for smiling.
 */

describe('feature groups', () => {
  it('splits features into the agreed identity and expression sets', () => {
    expect([...IDENTITY_FEATURES]).toEqual([
      'faceAspect',
      'eyeSpacing',
      'noseLength',
      'noseWidth',
      'jawAngle',
      'lowerFace',
      'symmetry',
    ])
    expect([...EXPRESSION_FEATURES]).toEqual(['eyeOpenness', 'browHeight', 'mouthWidth', 'lipThickness'])
  })

  it('covers every feature exactly once', () => {
    const all = [...IDENTITY_FEATURES, ...EXPRESSION_FEATURES]
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual([...FEATURE_NAMES].sort())
    expect(Object.keys(extractFeatures(canonicalFace)).sort()).toEqual([...all].sort())
  })
})

describe('quantizeIdentity', () => {
  it('returns identity bins only', () => {
    const q = quantizeIdentity(extractFeatures(canonicalFace))
    expect(Object.keys(q)).toEqual([...IDENTITY_FEATURES])
    expectTypeOf<keyof QuantizedIdentity>().toEqualTypeOf<IdentityFeatureName>()
  })

  it('agrees with quantize on the identity subset', () => {
    const f = extractFeatures(canonicalFace)
    const all = quantize(f)
    const identity = quantizeIdentity(f)
    for (const name of IDENTITY_FEATURES) expect(identity[name], name).toBe(all[name])
  })

  it('ignores expression feature values entirely', () => {
    const f = extractFeatures(canonicalFace)
    const wild = { ...f, eyeOpenness: -9, browHeight: 99, mouthWidth: Number.NaN, lipThickness: Infinity }
    expect(quantizeIdentity(wild)).toEqual(quantizeIdentity(f))
  })
})

describe('identity features are expression-invariant', () => {
  // Landmarks that move with expression and that some feature reads:
  // eyelids 159/145/386/374, brows 105/334, lips 0/13/14/17, mouth corners 61/291.
  const EXPRESSIVE_MOVES: readonly [string, readonly (readonly [number, number, number])[]][] = [
    ['wide-open eyes', [[159, 0, -0.01], [386, 0, -0.01], [145, 0, 0.005], [374, 0, 0.005]]],
    ['closed eyes', [[159, 0, 0.006], [386, 0, 0.006]]],
    ['raised brows', [[105, 0, -0.02], [334, 0, -0.02]]],
    ['one raised brow', [[334, 0, -0.025]]],
    ['broad smile', [[61, -0.02, -0.01], [291, 0.02, -0.01]]],
    ['lopsided smile', [[291, 0.02, -0.015]]],
    ['pursed lips', [[61, 0.015, 0], [291, -0.015, 0], [0, 0, -0.005], [17, 0, 0.005]]],
    ['parted lips', [[13, 0, -0.003], [14, 0, 0.01]]],
  ]

  const base = extractFeatures(canonicalFace)

  it.each(EXPRESSIVE_MOVES)('%s: identity unchanged, expression changed', (_, moves) => {
    let face = canonicalFace
    for (const [index, dx, dy] of moves) face = nudge(face, index, dx, dy)
    const moved = extractFeatures(face)

    for (const name of IDENTITY_FEATURES) expect(moved[name], name).toBe(base[name])
    expect(quantizeIdentity(moved)).toEqual(quantizeIdentity(base))
    expect(EXPRESSION_FEATURES.some((name) => moved[name] !== base[name])).toBe(true)
  })
})

describe('src/engine uses identity features only', () => {
  // The engine produces the SongSpec, so it must only see `QuantizedIdentity`.
  const FORBIDDEN = [
    ...EXPRESSION_FEATURES,
    'EXPRESSION_FEATURES',
    'FEATURE_NAMES',
    'FaceFeatures',
    'QuantizedFeatures',
    'extractFeatures',
    'analyzeFace',
    'quantize',
  ]
  const forbidden = new RegExp(`\\b(${FORBIDDEN.join('|')})\\b`, 'g')

  function violations(source: string): string[] {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    return [...code.matchAll(forbidden)].map((m) => m[1])
  }

  it('the scanner catches expression access and allows the identity API', () => {
    expect(violations('const m = f.mouthWidth + q.eyeOpenness')).toEqual(['mouthWidth', 'eyeOpenness'])
    expect(violations('import { quantize, type FaceFeatures } from "../features"')).toEqual([
      'quantize',
      'FaceFeatures',
    ])
    expect(violations('for (const n of FEATURE_NAMES) seed ^= q[n]')).toEqual(['FEATURE_NAMES'])
    expect(
      violations(`
        import { IDENTITY_FEATURES, type QuantizedIdentity } from '../features/index.ts'
        // mouthWidth is deliberately not used here
        export const seedOf = (q: QuantizedIdentity) => IDENTITY_FEATURES.map((n) => q[n]).join()
        const b = quantizeIdentity
      `),
    ).toEqual([])
  })

  const engineFiles = readdirSync('src/engine', { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map((f) => join('src/engine', f))

  it('no engine source references expression features or the unfiltered feature API', () => {
    for (const file of engineFiles) {
      expect(violations(readFileSync(file, 'utf8')), file).toEqual([])
    }
  })
})
