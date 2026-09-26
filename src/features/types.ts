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
   * over face height. 1 = perfectly symmetric. Pairs: 33/263, 133/362,
   * 159/386, 145/374, 105/334, 129/358, 61/291, 234/454, 172/397.
   * Only the along-midline component is compared, because horizontal
   * offsets are dominated by residual yaw rather than face shape.
   */
  readonly symmetry: number
}

export type FeatureName = keyof FaceFeatures

/** Canonical feature order. Downstream hashing must iterate in this order. */
export const FEATURE_NAMES = [
  'faceAspect',
  'eyeSpacing',
  'eyeOpenness',
  'noseLength',
  'noseWidth',
  'mouthWidth',
  'lipThickness',
  'jawAngle',
  'browHeight',
  'lowerFace',
  'symmetry',
] as const satisfies readonly FeatureName[]

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
