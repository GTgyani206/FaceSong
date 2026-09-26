import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  DEFAULT_BINS,
  DEFAULT_POSE_LIMITS,
  EXPRESSION_FEATURES,
  IDENTITY_FEATURES,
  type FeatureName,
  type HeadPose,
} from '../../features/index.ts'
import { createFaceDetector, type FaceDetector } from '../../landmarks/index.ts'
import { analyzePhoto, download, exportFileName, exportJson, type PhotoResult } from './analyze.ts'

// Shared across StrictMode's double-mounted effects.
let detectorPromise: Promise<FaceDetector> | null = null
const getDetector = () => (detectorPromise ??= createFaceDetector())

type Status = { kind: 'loading' } | { kind: 'ready' } | { kind: 'busy'; done: number; total: number } | { kind: 'error'; message: string }

export default function DebugPage() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [results, setResults] = useState<PhotoResult[]>([])
  const [dragging, setDragging] = useState(false)
  const nextId = useRef(0)

  useEffect(() => {
    getDetector().then(
      () => setStatus({ kind: 'ready' }),
      (e) => setStatus({ kind: 'error', message: `Could not load Face Landmarker: ${e}` }),
    )
  }, [])

  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return
    const detector = await getDetector()
    for (let i = 0; i < images.length; i++) {
      setStatus({ kind: 'busy', done: i, total: images.length })
      const result = await analyzePhoto(detector, images[i], `photo-${nextId.current++}`)
      setResults((prev) => [...prev, result])
    }
    setStatus({ kind: 'ready' })
  }, [])

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void addFiles([...e.dataTransfer.files])
  }

  const exportable = results.filter((r) => r.detection)

  return (
    <main
      className={`debug${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header>
        <h1>FaceSong debug</h1>
        <p className="muted">
          Dev only. Photos are processed in this tab and never uploaded. Pose limit ±{DEFAULT_POSE_LIMITS.maxYaw}° yaw,
          ±{DEFAULT_POSE_LIMITS.maxPitch}° pitch. {DEFAULT_BINS} bins per feature.
        </p>
        <div className="toolbar">
          <label className={`button${status.kind === 'ready' ? '' : ' disabled'}`}>
            Add photos…
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={status.kind !== 'ready'}
              onChange={(e) => {
                void addFiles([...(e.target.files ?? [])])
                e.target.value = ''
              }}
            />
          </label>
          <button
            type="button"
            disabled={exportable.length === 0}
            onClick={() => exportable.forEach((r) => download(exportFileName(r.fileName), exportJson(r)))}
          >
            Download all JSON ({exportable.length})
          </button>
          <button type="button" disabled={results.length === 0} onClick={() => setResults([])}>
            Clear
          </button>
          <StatusText status={status} />
        </div>
      </header>

      {results.length === 0 && <p className="empty">Drop face photos anywhere on this page, or use “Add photos…”.</p>}

      <section className="cards">
        {results.map((r) => (
          <PhotoCard key={r.id} result={r} />
        ))}
      </section>
    </main>
  )
}

function StatusText({ status }: { status: Status }) {
  switch (status.kind) {
    case 'loading':
      return <span className="muted">Loading Face Landmarker…</span>
    case 'ready':
      return <span className="muted">Ready</span>
    case 'busy':
      return (
        <span className="muted">
          Processing {status.done + 1} / {status.total}…
        </span>
      )
    case 'error':
      return <span className="bad">{status.message}</span>
  }
}

function PhotoCard({ result: r }: { result: PhotoResult }) {
  return (
    <article className="card" data-testid="photo-card">
      <Preview result={r} />
      <div className="details">
        <h2 title={r.fileName}>{r.fileName}</h2>
        <p className="muted">
          {r.bitmap.width}×{r.bitmap.height}
          {r.detection && r.detection.faceCount > 1 && <span className="warn"> · {r.detection.faceCount} faces, using the first</span>}
        </p>
        {r.error && <p className="bad">{r.error}</p>}
        {r.pose && <PoseView pose={r.pose} mediapipe={r.mediapipePose} rejected={r.rejected} />}
        {r.features && r.bins && <FeatureTable features={r.features} bins={r.bins} />}
        {r.detection && <Blendshapes scores={r.detection.blendshapes} />}
        {r.detection && (
          <button type="button" onClick={() => download(exportFileName(r.fileName), exportJson(r))}>
            Download {exportFileName(r.fileName)}
          </button>
        )}
      </div>
    </article>
  )
}

const PREVIEW_MAX = 320

function Preview({ result: r }: { result: PhotoResult }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const k = Math.min(1, PREVIEW_MAX / Math.max(r.bitmap.width, r.bitmap.height))
    el.width = Math.round(r.bitmap.width * k)
    el.height = Math.round(r.bitmap.height * k)
    ctx.drawImage(r.bitmap, 0, 0, el.width, el.height)
    ctx.fillStyle = 'rgba(0, 255, 170, 0.85)'
    for (const p of r.detection?.normalized ?? []) ctx.fillRect(p.x * el.width - 0.75, p.y * el.height - 0.75, 1.5, 1.5)
  }, [r])
  return <canvas ref={canvas} className="preview" />
}

const fmtAngle = (a: number) => `${a >= 0 ? '+' : ''}${a.toFixed(1)}°`

function PoseView({ pose, mediapipe, rejected }: { pose: HeadPose; mediapipe: HeadPose | null; rejected: string | null }) {
  const row = (label: string, p: HeadPose) => (
    <tr>
      <th scope="row">{label}</th>
      <td>{fmtAngle(p.yaw)}</td>
      <td>{fmtAngle(p.pitch)}</td>
      <td>{fmtAngle(p.roll)}</td>
    </tr>
  )
  return (
    <>
      <p className={rejected ? 'bad' : 'good'} data-testid="pose-status">
        {rejected ? `Rejected: ${rejected} beyond ±15°` : 'Pose OK'}
      </p>
      <table className="pose">
        <thead>
          <tr>
            <th />
            <th>yaw</th>
            <th>pitch</th>
            <th>roll</th>
          </tr>
        </thead>
        <tbody>
          {row('ours', pose)}
          {mediapipe && row('MediaPipe', mediapipe)}
        </tbody>
      </table>
    </>
  )
}

function FeatureTable({ features, bins }: { features: Record<FeatureName, number>; bins: Record<FeatureName, number> }) {
  const rows = (names: readonly FeatureName[], group: string) =>
    names.map((name, i) => (
      <tr key={name} className={group}>
        {i === 0 && (
          <th scope="rowgroup" rowSpan={names.length} className="group">
            {group}
          </th>
        )}
        <td>{name}</td>
        <td className="num">{features[name].toFixed(name === 'jawAngle' ? 2 : 4)}</td>
        <td>
          <BinBar bin={bins[name]} />
        </td>
      </tr>
    ))
  return (
    <table className="features" data-testid="features">
      <thead>
        <tr>
          <th />
          <th>feature</th>
          <th className="num">value</th>
          <th>bin</th>
        </tr>
      </thead>
      <tbody>
        {rows(IDENTITY_FEATURES, 'identity')}
        {rows(EXPRESSION_FEATURES, 'expression')}
      </tbody>
    </table>
  )
}

function BinBar({ bin }: { bin: number }) {
  return (
    <span className="bins" title={`bin ${bin} of 0–${DEFAULT_BINS - 1}`}>
      {Array.from({ length: DEFAULT_BINS }, (_, i) => (
        <span key={i} className={i === bin ? 'on' : ''} />
      ))}
      <span className="bin-label">{bin}</span>
    </span>
  )
}

/** Identity features assume a closed mouth; jawOpen flags photos that break that. */
const JAW_OPEN_WARNING = 0.15

function Blendshapes({ scores }: { scores: Readonly<Record<string, number>> }) {
  const top = Object.entries(scores)
    .filter(([name]) => name !== '_neutral')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const jawOpen = scores.jawOpen ?? 0
  return (
    <div className="blendshapes">
      <p className={jawOpen > JAW_OPEN_WARNING ? 'warn' : 'muted'}>
        jawOpen {jawOpen.toFixed(2)}
        {jawOpen > JAW_OPEN_WARNING && ' — mouth open: faceAspect, jawAngle and lowerFace are unreliable'}
      </p>
      <p className="muted">Top blendshapes: {top.map(([n, s]) => `${n} ${s.toFixed(2)}`).join(', ')}</p>
    </div>
  )
}
