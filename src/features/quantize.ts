import { FEATURE_NAMES, IDENTITY_FEATURES, type FaceFeatures, type FeatureName, type IdentityFeatureName } from './types.ts'

/**
 * Expected [min, max] per feature. Values outside are clamped into the edge
 * bins. Provisional: centred on the MediaPipe canonical face with a plausible
 * human spread, except noseWidth, whose canonical value is far narrower than
 * real faces. Recalibrate from real-face exports (see /debug).
 */
export const FEATURE_RANGES: Readonly<Record<FeatureName, readonly [number, number]>> = {
  // identity
  faceAspect: [1.05, 1.65], // canonical 1.353
  eyeSpacing: [0.32, 0.5], // canonical 0.418
  noseLength: [0.45, 0.75], // canonical 0.603
  noseWidth: [0.3, 0.7], // canonical 0.402; one real face 0.578
  jawAngle: [95, 145], // degrees; canonical 127.8
  lowerFace: [0.5, 0.72], // canonical 0.608
  symmetry: [0.96, 1], // canonical 1
  // expression
  eyeOpenness: [0.15, 0.4], // canonical 0.259
  browHeight: [0.14, 0.38], // canonical 0.258
  mouthWidth: [0.35, 0.75], // canonical 0.552
  lipThickness: [0.12, 0.45], // canonical 0.287
}

/**
 * Coarse bins absorb landmark jitter between photos of the same face.
 * More bins = more distinct songs but less stability.
 */
export const DEFAULT_BINS = 5

/** Each feature as an integer bin in [0, bins − 1]. For display and debugging. */
export type QuantizedFeatures = Readonly<Record<FeatureName, number>>

/**
 * Identity feature bins only — the ONLY feature input the engine may use to
 * determine melody or song identity. See the IDENTITY vs EXPRESSION note in
 * types.ts.
 */
export type QuantizedIdentity = Readonly<Record<IdentityFeatureName, number>>

/** All features → bins. Not for the engine: use `quantizeIdentity`. */
export function quantize(features: FaceFeatures, bins: number = DEFAULT_BINS): QuantizedFeatures {
  return quantizeNames(features, FEATURE_NAMES, bins)
}

/** Identity features → bins. Expression features are never read. */
export function quantizeIdentity(features: FaceFeatures, bins: number = DEFAULT_BINS): QuantizedIdentity {
  return quantizeNames(features, IDENTITY_FEATURES, bins)
}

function quantizeNames<N extends FeatureName>(
  features: FaceFeatures,
  names: readonly N[],
  bins: number,
): Readonly<Record<N, number>> {
  if (!Number.isInteger(bins) || bins < 1) throw new RangeError(`bins must be a positive integer, got ${bins}`)
  const out = {} as Record<N, number>
  for (const name of names) {
    const value = features[name]
    if (!Number.isFinite(value)) throw new RangeError(`Feature ${name} is not finite`)
    const [min, max] = FEATURE_RANGES[name]
    const t = Math.min(1, Math.max(0, (value - min) / (max - min)))
    out[name] = Math.min(bins - 1, Math.floor(t * bins))
  }
  return out
}
