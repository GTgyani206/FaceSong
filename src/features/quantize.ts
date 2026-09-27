import {
  CONTINUOUS_IDENTITY,
  DISCRETE_IDENTITY,
  FEATURE_NAMES,
  type ContinuousIdentityName,
  type DiscreteIdentityName,
  type FaceFeatures,
  type FeatureName,
} from './types.ts'

/**
 * Expected [min, max] per feature. Values outside are clamped into the edge
 * bins. Provisional: centred on the MediaPipe canonical face with a plausible
 * human spread, except noseWidth, whose canonical value is far narrower than
 * real faces. Recalibrate from real-face exports (see /debug).
 */
export const FEATURE_RANGES: Readonly<Record<FeatureName, readonly [number, number]>> = {
  // discrete identity
  noseLength: [0.45, 0.75], // canonical 0.603
  noseWidth: [0.3, 0.7], // canonical 0.402; one real face 0.578
  eyeSpacing: [0.32, 0.5], // canonical 0.418
  // continuous identity
  faceAspect: [1.05, 1.65], // canonical 1.353
  jawAngle: [95, 145], // degrees; canonical 127.8
  symmetry: [0.96, 1], // canonical 1
  // expression
  eyeOpenness: [0.15, 0.4], // canonical 0.259
  browHeight: [0.14, 0.38], // canonical 0.258
  mouthWidth: [0.35, 0.75], // canonical 0.552
  lipThickness: [0.12, 0.45], // canonical 0.287
}

/**
 * Bins per DISCRETE_IDENTITY feature. Coarse on purpose: a bin must be much
 * wider than the landmark noise so the same face lands in the same bin.
 */
export const DISCRETE_BINS = 3

/**
 * Feature value → position in its expected range, clamped to [0, 1].
 * Throws on a non-finite value.
 */
export function normalizeFeature(name: FeatureName, value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`Feature ${name} is not finite`)
  const [min, max] = FEATURE_RANGES[name]
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

/** Every feature normalized to [0, 1]. For display and debugging — not for the engine. */
export function normalizeFeatures(features: FaceFeatures): Readonly<Record<FeatureName, number>> {
  const out = {} as Record<FeatureName, number>
  for (const name of FEATURE_NAMES) out[name] = normalizeFeature(name, features[name])
  return out
}

/**
 * The ONLY feature input the engine may use. See the IDENTITY note in types.ts.
 * - discrete: DISCRETE_IDENTITY bins in [0, DISCRETE_BINS − 1] — the only
 *   source for discrete musical choices and seed hashing.
 * - continuous: CONTINUOUS_IDENTITY normalized to [0, 1] — continuous
 *   parameters only; never hashed, thresholded or rounded into choices.
 */
export interface QuantizedIdentity {
  readonly discrete: Readonly<Record<DiscreteIdentityName, number>>
  readonly continuous: Readonly<Record<ContinuousIdentityName, number>>
}

/** Identity features → engine input. Expression features are never read. */
export function quantizeIdentity(features: FaceFeatures): QuantizedIdentity {
  const discrete = {} as Record<DiscreteIdentityName, number>
  for (const name of DISCRETE_IDENTITY) {
    const t = normalizeFeature(name, features[name])
    discrete[name] = Math.min(DISCRETE_BINS - 1, Math.floor(t * DISCRETE_BINS))
  }
  const continuous = {} as Record<ContinuousIdentityName, number>
  for (const name of CONTINUOUS_IDENTITY) continuous[name] = normalizeFeature(name, features[name])
  return { discrete, continuous }
}
