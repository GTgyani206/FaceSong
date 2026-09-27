import { angle2, assertLandmarks, dist2, type Vec2 } from './geometry.ts'
import type { FaceFeatures, Landmark } from './types.ts'

/*
 * Anchors. The face contour (forehead top 10, face edges 234/454, temple and
 * cheek edges) sits on the silhouette, where MediaPipe guesses against hair,
 * ears and background, and it drifts a lot when the photo is rotated. Identity
 * features therefore avoid it, with two exceptions that have no internal
 * substitute: the chin (152) and the lower jaw line (136/172, 365/397).
 *
 * Scale: outer eye-corner width 33 → 263 ("biocular width").
 * Axes: the eye line runs through the two eye centres (mean of each eye's
 * corners); "vertical" distances are measured perpendicular to it, so they
 * are rotation-invariant and unaffected by where along the face a point is.
 */

/** MediaPipe face-mesh indices used below. "R"/"L" are the subject's right/left. */
const LM = {
  chin: 152,
  eyeOuterR: 33,
  eyeInnerR: 133,
  eyeInnerL: 362,
  eyeOuterL: 263,
  eyeUpperLidR: 159,
  eyeLowerLidR: 145,
  eyeUpperLidL: 386,
  eyeLowerLidL: 374,
  browR: 105,
  browL: 334,
  nasion: 168,
  subnasale: 2,
  alaR: 129,
  alaL: 358,
  mouthCornerR: 61,
  mouthCornerL: 291,
  upperLipOuter: 0,
  upperLipInner: 13,
  lowerLipInner: 14,
  lowerLipOuter: 17,
  jawR: [136, 172],
  jawL: [365, 397],
} as const

/**
 * Mirrored [right, left] pairs for the symmetry feature: internal points
 * around the eyes and nose only. No contour (unstable), no eyelids, brows,
 * cheeks or lips (they move with expression).
 */
const SYMMETRY_PAIRS: readonly (readonly [number, number])[] = [
  [33, 263], // eye outer corners
  [133, 362], // eye inner corners
  [243, 463], // inner eye, beside the nose bridge
  [122, 351], // nose bridge sides
  [188, 412], // nose sidewalls
  [129, 358], // alae
  [64, 294], // lower alae
  [98, 327], // nostrils
]

/**
 * Landmarks → FaceFeatures. Pure and deterministic. Does not check head pose;
 * use `analyzeFace` for the pose-gated entry point.
 */
export function extractFeatures(landmarks: readonly Landmark[]): FaceFeatures {
  assertLandmarks(landmarks)
  const p = (i: number): Landmark => landmarks[i]
  const d = (a: number, b: number): number => dist2(p(a), p(b))
  const mid = (ids: readonly number[]): Vec2 => ({
    x: ids.reduce((s, i) => s + landmarks[i].x, 0) / ids.length,
    y: ids.reduce((s, i) => s + landmarks[i].y, 0) / ids.length,
  })

  const biocular = d(LM.eyeOuterR, LM.eyeOuterL)
  const mouthWidth = d(LM.mouthCornerR, LM.mouthCornerL)
  const eyeWidthR = d(LM.eyeOuterR, LM.eyeInnerR)
  const eyeWidthL = d(LM.eyeInnerL, LM.eyeOuterL)

  // Eye-line frame: origin between the eyes, x along the eye line, y ⟂ toward the chin.
  const eyeR = mid([LM.eyeOuterR, LM.eyeInnerR])
  const eyeL = mid([LM.eyeInnerL, LM.eyeOuterL])
  const eyeDist = dist2(eyeR, eyeL)
  if (!(biocular > 0 && eyeDist > 0 && mouthWidth > 0 && eyeWidthR > 0 && eyeWidthL > 0)) {
    throw new RangeError('Degenerate landmarks: zero-length reference distance')
  }
  const origin = { x: (eyeR.x + eyeL.x) / 2, y: (eyeR.y + eyeL.y) / 2 }
  const down = { x: -(eyeL.y - eyeR.y) / eyeDist, y: (eyeL.x - eyeR.x) / eyeDist }
  /** Signed distance below the eye line. */
  const below = (q: Vec2): number => (q.x - origin.x) * down.x + (q.y - origin.y) * down.y

  const eyeToChin = below(p(LM.chin))
  if (!(eyeToChin > 0)) throw new RangeError('Degenerate landmarks: chin is not below the eye line')

  const eyeOpenness =
    (d(LM.eyeUpperLidR, LM.eyeLowerLidR) / eyeWidthR + d(LM.eyeUpperLidL, LM.eyeLowerLidL) / eyeWidthL) / 2

  return {
    faceAspect: eyeToChin / biocular,
    eyeSpacing: d(LM.eyeInnerR, LM.eyeInnerL) / biocular,
    eyeOpenness,
    noseLength: (below(p(LM.subnasale)) - below(p(LM.nasion))) / biocular,
    noseWidth: d(LM.alaR, LM.alaL) / biocular,
    mouthWidth: mouthWidth / biocular,
    lipThickness: (d(LM.upperLipOuter, LM.upperLipInner) + d(LM.lowerLipInner, LM.lowerLipOuter)) / mouthWidth,
    jawAngle: angle2(mid(LM.jawR), p(LM.chin), mid(LM.jawL)),
    browHeight: (d(LM.browR, LM.eyeUpperLidR) + d(LM.browL, LM.eyeUpperLidL)) / 2 / biocular,
    symmetry: symmetry(landmarks, biocular),
  }
}

/**
 * The facial midline's normal is the mean right→left direction of the
 * mirrored pairs; project every pair onto the midline and compare how far
 * apart the two sides sit along it. Rotation-invariant because the axis is
 * derived from the face itself.
 */
function symmetry(landmarks: readonly Landmark[], scale: number): number {
  let nx = 0
  let ny = 0
  for (const [r, l] of SYMMETRY_PAIRS) {
    const dx = landmarks[l].x - landmarks[r].x
    const dy = landmarks[l].y - landmarks[r].y
    const len = Math.hypot(dx, dy)
    nx += dx / len
    ny += dy / len
  }
  const nLen = Math.hypot(nx, ny)
  // Midline direction: perpendicular to the mean pair direction.
  const ax = -ny / nLen
  const ay = nx / nLen

  let mismatch = 0
  for (const [r, l] of SYMMETRY_PAIRS) {
    const along = (landmarks[l].x - landmarks[r].x) * ax + (landmarks[l].y - landmarks[r].y) * ay
    mismatch += Math.abs(along)
  }
  return Math.max(0, 1 - mismatch / SYMMETRY_PAIRS.length / scale)
}
