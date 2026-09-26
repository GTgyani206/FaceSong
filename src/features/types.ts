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
 */
export interface FaceFeatures {
  /** Face height / face width. Height 10 (forehead top) → 152 (chin); width 234 → 454 (face edges). */
  readonly faceAspect: number
  /** Inner-eye-corner distance 133 → 362, over face width (234 → 454). */
  readonly eyeSpacing: number
  /**
   * Mean eye height / eye width.
   * Right eye: 159 (upper lid) → 145 (lower lid) over 33 (outer) → 133 (inner).
   * Left eye: 386 → 374 over 362 (inner) → 263 (outer).
   */
  readonly eyeOpenness: number
  /** Nasion 168 → subnasale 2, over face height (10 → 152). */
  readonly noseLength: number
  /** Alar width 129 → 358, over face width (234 → 454). */
  readonly noseWidth: number
  /** Mouth corners 61 → 291, over face width (234 → 454). */
  readonly mouthWidth: number
  /**
   * Upper lip (0 outer → 13 inner) plus lower lip (14 inner → 17 outer),
   * over mouth width (61 → 291). Independent of how open the mouth is.
   */
  readonly lipThickness: number
  /**
   * Mean gonial angle in degrees: angle at 172 between 234 and 152 (right),
   * angle at 397 between 454 and 152 (left). Smaller = squarer jaw.
   */
  readonly jawAngle: number
  /**
   * Mean brow-to-upper-lid distance over face height (10 → 152).
   * Right: 105 → 159. Left: 334 → 386.
   */
  readonly browHeight: number
  /** Subnasale 2 → chin 152, over face height (10 → 152). */
  readonly lowerFace: number
  /**
   * 1 − mean vertical mismatch of mirrored pairs along the facial midline,
   * over face height. 1 = perfectly symmetric. Pairs (rigid points only, so
   * a raised brow or lopsided smile does not count): 33/263 eye outer,
   * 133/362 eye inner, 127/356 upper face edge, 234/454 face edge,
   * 93/323 lower face edge, 129/358 ala, 98/327 nostril, 172/397 jaw.
   * Only the along-midline component is compared, because horizontal
   * offsets are dominated by residual yaw rather than face shape.
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
 * Engine code must consume `QuantizedIdentity` (from `quantizeIdentity`),
 * never `FaceFeatures`, `QuantizedFeatures` or `FEATURE_NAMES`.
 *
 * Caveat: identity features assume a closed mouth. Opening the jaw moves the
 * chin (152), which shifts faceAspect, jawAngle and lowerFace.
 */

/** Bone-structure features. Canonical order: seed hashing must iterate in this order. */
export const IDENTITY_FEATURES = [
  'faceAspect',
  'eyeSpacing',
  'noseLength',
  'noseWidth',
  'jawAngle',
  'lowerFace',
  'symmetry',
] as const satisfies readonly FeatureName[]

/** Features that change with facial expression. Never used for song identity. */
export const EXPRESSION_FEATURES = [
  'eyeOpenness',
  'browHeight',
  'mouthWidth',
  'lipThickness',
] as const satisfies readonly FeatureName[]

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
