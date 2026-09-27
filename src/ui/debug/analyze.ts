import {
  checkPose,
  estimateHeadPose,
  eulerFromRotation,
  extractFeatures,
  quantize,
  quantizeIdentity,
  type FaceFeatures,
  type HeadPose,
  type PoseRejection,
  type QuantizedFeatures,
  type QuantizedIdentity,
} from '../../features/index.ts'
import { decodeImage, rotationFromTransform, type FaceDetection, type FaceDetector } from '../../landmarks/index.ts'

export interface PhotoResult {
  readonly id: string
  readonly fileName: string
  /** Decoded (EXIF-rotated) image, drawn to a canvas for the preview. */
  readonly bitmap: ImageBitmap
  readonly detection: FaceDetection | null
  readonly pose: HeadPose | null
  /** Pose decoded from MediaPipe's own transformation matrix, for comparison. */
  readonly mediapipePose: HeadPose | null
  readonly rejected: PoseRejection | null
  readonly features: FaceFeatures | null
  readonly bins: QuantizedFeatures | null
  /** What the engine would see. */
  readonly identityBins: QuantizedIdentity | null
  readonly error: string | null
}

export async function analyzePhoto(detector: FaceDetector, file: File, id: string): Promise<PhotoResult> {
  const bitmap = await decodeImage(file)
  const base = { id, fileName: file.name, bitmap }
  const empty = { pose: null, mediapipePose: null, rejected: null, features: null, bins: null, identityBins: null }
  try {
    const detection = detector.detect(bitmap)
    if (!detection) {
      return { ...base, ...empty, detection, error: 'No face found' }
    }
    const pose = estimateHeadPose(detection.landmarks)
    const features = extractFeatures(detection.landmarks)
    return {
      ...base,
      detection,
      pose,
      mediapipePose: detection.transform ? eulerFromRotation(rotationFromTransform(detection.transform)) : null,
      rejected: checkPose(pose),
      features,
      bins: quantize(features),
      identityBins: quantizeIdentity(features),
      error: null,
    }
  } catch (e) {
    return { ...base, ...empty, detection: null, error: String(e) }
  }
}

/** One JSON per photo. `landmarks` matches the tests/fixtures/ format. */
export function exportJson(r: PhotoResult): string {
  const d = r.detection
  if (!d) throw new Error('Nothing to export')
  return JSON.stringify(
    {
      description: `FaceSong debug export of ${r.fileName}. landmarks are isotropic (x·width, y·height, z·width).`,
      source: r.fileName,
      imageWidth: d.width,
      imageHeight: d.height,
      faceCount: d.faceCount,
      roll: d.roll,
      straightenedBy: d.straightenedBy,
      landmarks: d.landmarks,
      normalizedLandmarks: d.normalized,
      blendshapes: d.blendshapes,
      facialTransformationMatrix: d.transform,
    },
    null,
    2,
  )
}

export function exportFileName(fileName: string): string {
  return `${fileName.replace(/\.[^.]+$/, '')}.landmarks.json`
}

export function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
