import { FaceLandmarker, FilesetResolver, type ImageSource } from '@mediapipe/tasks-vision'
import type { Landmark } from '../features/index.ts'
import { toIsotropic, type NormalizedPoint } from './scale.ts'

/** Served from public/mediapipe/ by scripts/fetch-mediapipe-assets.mjs. */
const ASSET_BASE = `${import.meta.env.BASE_URL}mediapipe`

export interface FaceDetection {
  /** Size of the image MediaPipe saw, in pixels. */
  readonly width: number
  readonly height: number
  /** How many faces were found; only the first is returned. */
  readonly faceCount: number
  /** Raw MediaPipe output (x, y normalized to width/height). */
  readonly normalized: readonly NormalizedPoint[]
  /** Isotropic landmarks — what features/ consumes. */
  readonly landmarks: readonly Landmark[]
  /** Blendshape name → score in [0, 1]. */
  readonly blendshapes: Readonly<Record<string, number>>
  /** 4×4 facial transformation matrix (column-major), if MediaPipe produced one. */
  readonly transform: readonly number[] | null
}

export interface FaceDetector {
  /** Returns null when no face is found. */
  detect(image: ImageSource, width: number, height: number): FaceDetection | null
  close(): void
}

/**
 * Face Landmarker in IMAGE mode on the CPU delegate. CPU is chosen over GPU
 * for reproducibility: the same photo should give the same landmarks on every
 * machine.
 */
export async function createFaceDetector(): Promise<FaceDetector> {
  const fileset = await FilesetResolver.forVisionTasks(`${ASSET_BASE}/wasm`)
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${ASSET_BASE}/face_landmarker.task`, delegate: 'CPU' },
    runningMode: 'IMAGE',
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  })

  return {
    detect(image, width, height) {
      const result = landmarker.detect(image)
      const face = result.faceLandmarks[0]
      if (!face) return null
      const normalized = face.map(({ x, y, z }) => ({ x, y, z }))
      const blendshapes: Record<string, number> = {}
      for (const c of result.faceBlendshapes[0]?.categories ?? []) blendshapes[c.categoryName] = c.score
      return {
        width,
        height,
        faceCount: result.faceLandmarks.length,
        normalized,
        landmarks: toIsotropic(normalized, width, height),
        blendshapes,
        transform: result.facialTransformationMatrixes[0]?.data ?? null,
      }
    },
    close: () => landmarker.close(),
  }
}
