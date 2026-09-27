import { useEffect, useRef, useState } from 'react'
import { playSong, renderWav, type Playback } from '../audio/index.ts'
import type { SongSpec } from '../engine/index.ts'
import { downloadBlob, fileSafe } from './format.ts'

/** Play/stop, a piano-roll of the melody with a playhead, and WAV download. */
export default function SongPlayer({ spec, compact = false }: { spec: SongSpec; compact?: boolean }) {
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [beat, setBeat] = useState<number | null>(null)
  const [busy, setBusy] = useState<'loading' | 'rendering' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const frame = useRef(0)

  // Stop when unmounted or when the song changes.
  useEffect(() => () => playback?.stop(), [playback])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const play = async () => {
    setError(null)
    setBusy('loading')
    try {
      const p = await playSong(spec)
      setPlayback(p)
      const tick = () => {
        const t = p.position()
        setBeat(t < 0 ? 0 : Math.min(spec.bars * spec.beatsPerBar, (t * spec.tempo) / 60))
        frame.current = requestAnimationFrame(tick)
      }
      tick()
      void p.finished.then(() => {
        cancelAnimationFrame(frame.current)
        setPlayback((cur) => (cur === p ? null : cur))
        setBeat(null)
      })
    } catch (e) {
      setError(`Couldn't play audio: ${String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const download = async () => {
    setError(null)
    setBusy('rendering')
    try {
      downloadBlob(await renderWav(spec), `${fileSafe(spec.title)}.wav`)
    } catch (e) {
      setError(`Couldn't render the song: ${String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={`player${compact ? ' compact' : ''}`}>
      {!compact && <PianoRoll spec={spec} beat={beat} />}
      <div className="row">
        {playback ? (
          <button type="button" className="primary" onClick={() => playback.stop()} data-testid="stop">
            ■ Stop
          </button>
        ) : (
          <button type="button" className="primary" onClick={play} disabled={busy !== null} data-testid="play">
            {busy === 'loading' ? 'Loading…' : '▶ Play'}
          </button>
        )}
        <button type="button" onClick={download} disabled={busy !== null}>
          {busy === 'rendering' ? 'Rendering…' : 'Download WAV'}
        </button>
      </div>
      {error && <p className="notice error">{error}</p>}
    </div>
  )
}

function PianoRoll({ spec, beat }: { spec: SongSpec; beat: number | null }) {
  const total = spec.bars * spec.beatsPerBar
  const pitches = spec.melody.map((n) => n.midi)
  const lo = Math.min(...pitches) - 1
  const hi = Math.max(...pitches) + 1
  const W = total * 10
  const H = (hi - lo) * 6 + 16
  const y = (midi: number) => (hi - midi) * 6
  return (
    <svg className="roll" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Melody of ${spec.title}`} preserveAspectRatio="none">
      {spec.chords.map((c) => (
        <g key={c.bar}>
          <rect x={c.bar * 40} y={0} width={40} height={H - 16} className={c.bar % 2 ? 'bar odd' : 'bar'} />
          <text x={c.bar * 40 + 3} y={H - 4} className="chord">
            {c.symbol}
          </text>
        </g>
      ))}
      {spec.melody.map((n, i) => (
        <rect
          key={i}
          x={n.beat * 10 + 0.5}
          y={y(n.midi) + 0.5}
          width={Math.max(2, n.duration * 10 - 1)}
          height={5}
          rx={1.5}
          className={`note ${n.section}${beat !== null && beat >= n.beat && beat < n.beat + n.duration ? ' on' : ''}`}
        />
      ))}
      {beat !== null && <line x1={beat * 10} x2={beat * 10} y1={0} y2={H - 16} className="playhead" />}
    </svg>
  )
}
