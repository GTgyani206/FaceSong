import { useEffect, useRef, useState } from 'react'
import { decodeImage, type FaceDetection } from '../landmarks/index.ts'
import CameraCapture from './CameraCapture.tsx'
import { instrumentLabel, keyLabel, tempoLabel } from './format.ts'
import { songFromPhoto, type SongResult } from './pipeline.ts'
import SavePanel from './SavePanel.tsx'
import SongPlayer from './SongPlayer.tsx'

type Step =
  | { kind: 'choose' }
  | { kind: 'camera' }
  | { kind: 'working'; photo: ImageBitmap }
  | { kind: 'done'; photo: ImageBitmap; result: SongResult }
  | { kind: 'error'; message: string }

export default function CreateSong({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'choose' })
  const upload = useRef<HTMLInputElement>(null)

  const run = async (photo: ImageBitmap) => {
    setStep({ kind: 'working', photo })
    try {
      setStep({ kind: 'done', photo, result: await songFromPhoto(photo) })
    } catch (e) {
      setStep({ kind: 'error', message: `Something went wrong: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      await run(await decodeImage(file))
    } catch {
      setStep({ kind: 'error', message: "That file couldn't be opened as an image." })
    }
  }

  const reset = () => setStep({ kind: 'choose' })
  const input = (
    <input
      ref={upload}
      type="file"
      accept="image/*"
      hidden
      data-testid="upload"
      onChange={(e) => {
        void onFile(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  switch (step.kind) {
    case 'choose':
      return (
        <section className="hero">
          <h1>Your face, as a song.</h1>
          <p className="lede">
            FaceSong reads the geometry of your face — the shape of your nose, the spacing of your eyes, the line of your jaw —
            and composes a short piece of music that is yours alone. The same face always gets the same song.
          </p>
          <div className="row big">
            <button type="button" className="primary" onClick={() => setStep({ kind: 'camera' })}>
              Use camera
            </button>
            <button type="button" onClick={() => upload.current?.click()}>
              Upload a photo
            </button>
            {input}
          </div>
          <p className="hint">Your photo is analysed on this device. It is only uploaded if you choose to save it.</p>
        </section>
      )
    case 'camera':
      return <CameraCapture onCapture={run} onCancel={reset} />
    case 'working':
      return (
        <section className="working">
          <Photo photo={step.photo} />
          <p className="pulse">Listening to your face…</p>
        </section>
      )
    case 'error':
      return (
        <section className="working">
          <p className="notice error">{step.message}</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </section>
      )
    case 'done': {
      const r = step.result
      if (!r.ok) {
        return (
          <section className="working">
            <Photo photo={step.photo} />
            <p className="notice error" data-testid="rejection">
              {r.message}
            </p>
            <button type="button" onClick={reset}>
              Try another photo
            </button>
          </section>
        )
      }
      return (
        <section className="result" data-testid="result" data-seed={r.spec.seed}>
          <div className="result-photo">
            <Photo photo={step.photo} detection={r.detection} />
            <button type="button" onClick={reset}>
              New photo
            </button>
          </div>
          <div className="result-song">
            <p className="eyebrow">Your song</p>
            <h2 data-testid="song-title">{r.spec.title}</h2>
            <ul className="chips">
              <li>{keyLabel(r.spec)}</li>
              <li>{tempoLabel(r.spec)}</li>
              <li>{instrumentLabel(r.spec)}</li>
            </ul>
            {r.warnings.map((w) => (
              <p key={w} className="notice warn">
                {w}
              </p>
            ))}
            <SongPlayer spec={r.spec} />
            <SavePanel spec={r.spec} identity={r.identity} photo={step.photo} onSaved={onOpenLibrary} />
          </div>
        </section>
      )
    }
  }
}

/** The photo, with the face mesh traced faintly over it when available. */
function Photo({ photo, detection }: { photo: ImageBitmap; detection?: FaceDetection }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const k = Math.min(1, 720 / Math.max(photo.width, photo.height))
    el.width = Math.round(photo.width * k)
    el.height = Math.round(photo.height * k)
    ctx.drawImage(photo, 0, 0, el.width, el.height)
    if (!detection) return
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    for (const p of detection.normalized) ctx.fillRect(p.x * el.width - 0.8, p.y * el.height - 0.8, 1.6, 1.6)
  }, [photo, detection])
  return <canvas ref={canvas} className="photo" aria-label="Your photo" />
}
