// Self-hosts MediaPipe so no request (and no photo) leaves for a CDN at runtime.
//
// Copies the tasks-vision wasm fileset out of node_modules and downloads the
// Face Landmarker model into public/mediapipe/ (gitignored). The model is
// pinned by URL version and SHA-256: a different model means different
// landmarks, which would break "same input → same song".
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const MODEL_SHA256 = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}public/mediapipe`
const modelPath = `${outDir}/face_landmarker.task`
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

mkdirSync(outDir, { recursive: true })
cpSync(`${root}node_modules/@mediapipe/tasks-vision/wasm`, `${outDir}/wasm`, { recursive: true })

if (!existsSync(modelPath) || sha256(readFileSync(modelPath)) !== MODEL_SHA256) {
  console.log(`Downloading ${MODEL_URL}`)
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`Model download failed: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const got = sha256(buf)
  if (got !== MODEL_SHA256) throw new Error(`Model SHA-256 mismatch: expected ${MODEL_SHA256}, got ${got}`)
  writeFileSync(modelPath, buf)
}
console.log('MediaPipe assets ready in public/mediapipe/')
