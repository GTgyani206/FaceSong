import { angle2, assertLandmarks, dist2 } from './geometry.ts'
import type { FaceFeatures, Landmark } from './types.ts'

/** MediaPipe face-mesh indices used below. "R"/"L" are the subject's right/left. */
const LM = {
  foreheadTop: 10,
  chin: 152,
  faceEdgeR: 234,
  faceEdgeL: 454,
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
  gonionR: 172,
  gonionL: 397,
  faceEdgeUpperR: 127,
  faceEdgeUpperL: 356,
  faceEdgeLowerR: 93,
  faceEdgeLowerL: 323,
  nostrilR: 98,
  nostrilL: 327,
} as const

/**
 * Mirrored [right, left] pairs used for the symmetry feature. Symmetry is an
 * identity feature, so only points that barely move with expression are used
 * (no eyelids, brows or lips).
 */
const SYMMETRY_PAIRS: readonly (readonly [number, number])[] = [
  [LM.eyeOuterR, LM.eyeOuterL],
  [LM.eyeInnerR, LM.eyeInnerL],
  [LM.faceEdgeUpperR, LM.faceEdgeUpperL],
  [LM.faceEdgeR, LM.faceEdgeL],
  [LM.faceEdgeLowerR, LM.faceEdgeLowerL],
  [LM.alaR, LM.alaL],
  [LM.nostrilR, LM.nostrilL],
  [LM.gonionR, LM.gonionL],
]

/**
 * Landmarks → FaceFeatures. Pure and deterministic. Does not check head pose;
 * use `analyzeFace` for the pose-gated entry point.
 */
export function extractFeatures(landmarks: readonly Landmark[]): FaceFeatures {
  assertLandmarks(landmarks)
  const p = (i: number): Landmark => landmarks[i]
  const d = (a: number, b: number): number => dist2(p(a), p(b))

  const faceWidth = d(LM.faceEdgeR, LM.faceEdgeL)
  const faceHeight = d(LM.foreheadTop, LM.chin)
  const mouthWidth = d(LM.mouthCornerR, LM.mouthCornerL)
  const eyeWidthR = d(LM.eyeOuterR, LM.eyeInnerR)
  const eyeWidthL = d(LM.eyeInnerL, LM.eyeOuterL)
  if (!(faceWidth > 0 && faceHeight > 0 && mouthWidth > 0 && eyeWidthR > 0 && eyeWidthL > 0)) {
    throw new RangeError('Degenerate landmarks: zero-length reference distance')
  }

  const eyeOpenness =
    (d(LM.eyeUpperLidR, LM.eyeLowerLidR) / eyeWidthR + d(LM.eyeUpperLidL, LM.eyeLowerLidL) / eyeWidthL) / 2

  const jawAngle =
    (angle2(p(LM.faceEdgeR), p(LM.gonionR), p(LM.chin)) + angle2(p(LM.faceEdgeL), p(LM.gonionL), p(LM.chin))) / 2

  const browHeight = (d(LM.browR, LM.eyeUpperLidR) + d(LM.browL, LM.eyeUpperLidL)) / 2 / faceHeight

  return {
    faceAspect: faceHeight / faceWidth,
    eyeSpacing: d(LM.eyeInnerR, LM.eyeInnerL) / faceWidth,
    eyeOpenness,
    noseLength: d(LM.nasion, LM.subnasale) / faceHeight,
    noseWidth: d(LM.alaR, LM.alaL) / faceWidth,
    mouthWidth: mouthWidth / faceWidth,
    lipThickness: (d(LM.upperLipOuter, LM.upperLipInner) + d(LM.lowerLipInner, LM.lowerLipOuter)) / mouthWidth,
    jawAngle,
    browHeight,
    lowerFace: d(LM.subnasale, LM.chin) / faceHeight,
    symmetry: symmetry(landmarks, faceHeight),
  }
}

/**
 * The facial midline's normal is the mean right→left direction of the
 * mirrored pairs; project every pair onto the midline and compare how far
 * apart the two sides sit along it. Rotation-invariant because the axis is
 * derived from the face itself.
 */
function symmetry(landmarks: readonly Landmark[], faceHeight: number): number {
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
  return Math.max(0, 1 - mismatch / SYMMETRY_PAIRS.length / faceHeight)
}
