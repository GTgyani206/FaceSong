import { useEffect, useRef, useState } from 'react'

/** Live selfie camera. Frames stay in the browser; `onCapture` gets the still. */
export default function CameraCapture({ onCapture, onCancel }: { onCapture: (image: ImageBitmap) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(() =>
    navigator.mediaDevices ? null : 'This browser has no camera access. Upload a photo instead.',
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!navigator.mediaDevices) return
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) video.current.srcObject = s
      })
      .catch((e: unknown) =>
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it in your browser, or upload a photo instead.'
            : 'No camera available. Upload a photo instead.',
        ),
      )
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capture = async () => {
    const v = video.current
    if (!v || v.videoWidth === 0) return
    onCapture(await createImageBitmap(v))
  }

  return (
    <div className="camera">
      {error ? (
        <p className="notice error">{error}</p>
      ) : (
        <div className="camera-frame">
          {/* Mirrored like a mirror; the captured photo is not mirrored. */}
          <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} />
          <div className="face-guide" aria-hidden="true" />
        </div>
      )}
      <p className="hint">Face the camera straight on, mouth closed, in even light.</p>
      <div className="row">
        {!error && (
          <button type="button" className="primary" disabled={!ready} onClick={capture}>
            Take photo
          </button>
        )}
        <button type="button" onClick={onCancel}>
          Back
        </button>
      </div>
    </div>
  )
}
