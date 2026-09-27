import { FaceLandmarker } from '@mediapipe/tasks-vision'
// Only the SIMD build of the wasm runtime is shipped (every current browser
// has wasm SIMD). `?url` makes Vite emit these as hashed assets, and only
// because this module is reached via the dynamic import in index.ts do they
// stay out of the main bundle. Relative paths on purpose: the package's
// `exports` map hides wasm/, and a bare-looking alias would be pre-bundled by
// Vite's dependency optimizer instead of served as a URL.
import wasmLoaderPath from '../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url'
import wasmBinaryPath from '../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url'
// Downloaded and SHA-256-checked by scripts/fetch-mediapipe-assets.mjs.
import modelAssetPath from '../../.cache/mediapipe/face_landmarker.task?url'
import type { Landmark } from '../features/index.ts'
import { toIsotropic, type NormalizedPoint } from './scale.ts'
import { addInPlaneRoll } from './transform.ts'
import { eyeRoll, fromUpright, planUpright } from './upright.ts'

export interface FaceDetection {
  /** Size of the input image, in pixels. All coordinates are in this frame. */
  readonly width: number
  readonly height: number
  /** How many faces were found; only the first is returned. */
  readonly faceCount: number
  /** Eye-line roll of the face in the input image, in degrees. */
  readonly roll: number
  /**
   * Degrees the image was rotated for the final detection (always −roll, or
   * 0 if the upright pass found no face). Landmarks are in the input frame.
   */
  readonly straightenedBy: number
  /** x, y normalized to width/height, z to width — MediaPipe's convention. */
  readonly normalized: readonly NormalizedPoint[]
  /** Isotropic pixel landmarks — what features/ consumes. */
  readonly landmarks: readonly Landmark[]
  /** Blendshape name → score in [0, 1]. */
  readonly blendshapes: Readonly<Record<string, number>>
  /** 4×4 facial transformation matrix (column-major), in the input frame. */
  readonly transform: readonly number[] | null
}

export interface FaceDetector {
  /** Returns null when no face is found. */
  detect(image: ImageBitmap): FaceDetection | null
  close(): void
}

type RawFace = Omit<FaceDetection, 'roll' | 'straightenedBy'>

/**
 * Face Landmarker in IMAGE mode on the CPU delegate. CPU is chosen over GPU
 * for reproducibility: the same photo should give the same landmarks on every
 * machine.
 */
export async function createFaceDetector(): Promise<FaceDetector> {
  const landmarker = await FaceLandmarker.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    },
  )

  function run(image: ImageBitmap | OffscreenCanvas, width: number, height: number): RawFace | null {
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
  }

  return {
    detect(image) {
      const { width, height } = image
      const first = run(image, width, height)
      if (!first) return null
      const roll = eyeRoll(first.landmarks)

      // Always detect again on an upright copy, even for small rolls, so every
      // photo goes through the same resampling and MediaPipe always sees a level face.
      const plan = planUpright(width, height, roll)
      const canvas = new OffscreenCanvas(plan.width, plan.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2D canvas unavailable')
      ctx.fillStyle = '#808080' // neutral fill for the exposed corners
      ctx.fillRect(0, 0, plan.width, plan.height)
      ctx.imageSmoothingQuality = 'high'
      ctx.translate(plan.width / 2, plan.height / 2)
      ctx.rotate((-roll * Math.PI) / 180)
      ctx.drawImage(image, -width / 2, -height / 2)

      const upright = run(canvas, plan.width, plan.height)
      if (!upright) return { ...first, roll, straightenedBy: 0 }
      const landmarks = upright.landmarks.map((p) => fromUpright(plan, p))
      return {
        ...upright,
        width,
        height,
        roll,
        straightenedBy: -roll,
        landmarks,
        normalized: landmarks.map((p) => ({ x: p.x / width, y: p.y / height, z: p.z / width })),
        transform: upright.transform ? addInPlaneRoll(upright.transform, roll) : null,
      }
    },
    close: () => landmarker.close(),
  }
}
