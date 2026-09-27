/**
 * One face-mesh landmark.
 *
 * Coordinates must be ISOTROPIC: one unit on x means the same physical
 * distance as one unit on y. MediaPipe normalizes x by image width and y by
 * image height, so the landmarks layer must rescale (x·width, y·height,
 * z·width) before handing landmarks to this layer. Units are otherwise
 * arbitrary; every feature is a ratio or an angle.
 *
 * Axes follow MediaPipe image space: x right, y down, z away from the camera.
 */
export interface Landmark {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Number of landmarks MediaPipe Face Landmarker emits (468 mesh + 10 iris). */
export const LANDMARK_COUNT = 478

/**
 * Scale-, translation- and in-plane-rotation-invariant face geometry.
 * All distances are 2D (x, y); z is only used for head pose.
 *
 * Indices refer to the MediaPipe face mesh. "Right"/"left" are the subject's.
 * Shared terms:
 * - W, biocular width: outer eye corners 33 → 263. The scale for most ratios.
 * - Eye line: through the eye centres, mean(33, 133) and mean(362, 263).
 * - "Below" = signed distance perpendicular to the eye line, toward the chin.
 *
 * Identity features avoid the face contour (10, 234, 454, …), whose
 * landmarks are unstable; only the chin and lower jaw line are used.
 */
export interface FaceFeatures {
  /** Chin 152 below the eye line, over W. */
  readonly faceAspect: number
  /** Inner-eye-corner distance 133 → 362, over W. */
  readonly eyeSpacing: number
  /**
   * Mean eye height / eye width.
   * Right eye: 159 (upper lid) → 145 (lower lid) over 33 (outer) → 133 (inner).
   * Left eye: 386 → 374 over 362 (inner) → 263 (outer).
   */
  readonly eyeOpenness: number
  /** Nasion 168 to subnasale 2, measured perpendicular to the eye line, over W. */
  readonly noseLength: number
  /** Alar width 129 → 358, over W. */
  readonly noseWidth: number
  /** Mouth corners 61 → 291, over W. */
  readonly mouthWidth: number
  /**
   * Upper lip (0 outer → 13 inner) plus lower lip (14 inner → 17 outer),
   * over mouth width (61 → 291). Independent of how open the mouth is.
   */
  readonly lipThickness: number
  /**
   * Chin angle in degrees: angle at 152 between the lower jaw line on each
   * side, mean(136, 172) and mean(365, 397). Larger = broader, squarer jaw.
   */
  readonly jawAngle: number
  /** Mean brow-to-upper-lid distance over W. Right: 105 → 159. Left: 334 → 386. */
  readonly browHeight: number
  /**
   * 1 − mean vertical mismatch of mirrored pairs along the facial midline,
   * over W. 1 = perfectly symmetric. Pairs are internal eye/nose points only
   * (no contour, no expressive points): 33/263, 133/362, 243/463, 122/351,
   * 188/412, 129/358, 64/294, 98/327. Only the along-midline component is
   * compared, because horizontal offsets are dominated by residual yaw.
   */
  readonly symmetry: number
}

export type FeatureName = keyof FaceFeatures

/*
 * IDENTITY vs EXPRESSION — a hard rule, enforced by tests/features/identity.test.ts.
 *
 * Only IDENTITY_FEATURES may influence anything that determines the melody
 * or the song's identity (i.e. anything in src/engine/ that produces a
 * SongSpec). The same person must get the same song whether they smile,
 * blink or raise their eyebrows, so EXPRESSION_FEATURES — which move with
 * the face's muscles — are for display and debugging only.
 *
 * Identity itself comes in two kinds, split by how stable MediaPipe makes them
 * (measured on rotated copies of real photos):
 *
 * - DISCRETE_IDENTITY: internal eye/nose geometry, ~2–3% landmark noise.
 *   Quantized to DISCRETE_BINS bins. These are the ONLY inputs the engine may
 *   use for discrete musical choices (seed, key, mode, instrument, chord
 *   progression, melody motif, …).
 * - CONTINUOUS_IDENTITY: chin/jaw-dependent geometry, ~4% noise — too noisy
 *   for bins. Exported as normalized 0–1 values. The engine may only map
 *   them to continuous parameters where a small input change makes a small
 *   musical change (e.g. tempo within a range, swing, brightness). Never
 *   hash, threshold or round them into a discrete choice.
 *
 * Engine code must consume `QuantizedIdentity` (from `quantizeIdentity`),
 * never `FaceFeatures` or the full-feature helpers.
 *
 * Caveat: identity features assume a closed mouth. Opening the jaw moves the
 * chin (152), which shifts faceAspect and jawAngle.
 */

/** Stable identity features, quantized to bins. Canonical order: seed hashing must iterate in this order. */
export const DISCRETE_IDENTITY = ['noseLength', 'noseWidth', 'eyeSpacing'] as const satisfies readonly FeatureName[]

/** Noisier identity features, exported as normalized 0–1 values only. */
export const CONTINUOUS_IDENTITY = ['faceAspect', 'jawAngle', 'symmetry'] as const satisfies readonly FeatureName[]

/** All bone-structure features: discrete then continuous. */
export const IDENTITY_FEATURES = [...DISCRETE_IDENTITY, ...CONTINUOUS_IDENTITY] as const

/** Features that change with facial expression. Never used for song identity. */
export const EXPRESSION_FEATURES = [
  'eyeOpenness',
  'browHeight',
  'mouthWidth',
  'lipThickness',
] as const satisfies readonly FeatureName[]

export type DiscreteIdentityName = (typeof DISCRETE_IDENTITY)[number]
export type ContinuousIdentityName = (typeof CONTINUOUS_IDENTITY)[number]
export type IdentityFeatureName = (typeof IDENTITY_FEATURES)[number]
export type ExpressionFeatureName = (typeof EXPRESSION_FEATURES)[number]

/** Every feature, identity first. For display, debugging and validation. */
export const FEATURE_NAMES: readonly FeatureName[] = [...IDENTITY_FEATURES, ...EXPRESSION_FEATURES]

/**
 * Head orientation in degrees, relative to the MediaPipe canonical face
 * (0, 0, 0 = looking straight at the camera). Decomposition is
 * R = Ry(yaw) · Rx(pitch) · Rz(roll) in image space.
 */
export interface HeadPose {
  /** Rotation about the vertical (y) axis: turning the head side to side. */
  readonly yaw: number
  /** Rotation about the horizontal (x) axis: nodding up/down. */
  readonly pitch: number
  /** Rotation about the viewing (z) axis: in-plane tilt. */
  readonly roll: number
}
