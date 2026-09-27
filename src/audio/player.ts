import * as Tone from 'tone'
import type { InstrumentName, SongSpec } from '../engine/index.ts'
import { planSong, TAIL_SECONDS, type Part, type SongPlan } from './plan.ts'
import { encodeWav } from './wav.ts'

/*
 * Tone.js renderer: SongSpec → sound. Loaded lazily via audio/index.ts so
 * Tone.js stays out of the main bundle. Synthesized voices only (no sample
 * downloads), so playback is identical offline and online.
 */

type Voice = { triggerAttackRelease(notes: string[], duration: number, time: number, velocity: number): unknown; dispose(): unknown }

function melodyVoice(instrument: InstrumentName): Tone.PolySynth {
  switch (instrument) {
    case 'glass-piano':
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 2.5,
        envelope: { attack: 0.004, decay: 0.9, sustain: 0.12, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0.1, release: 0.8 },
      })
    case 'marimba':
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 4,
        modulationIndex: 1.8,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.55, sustain: 0, release: 0.45 },
        modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
      })
    case 'pluck':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.002, decay: 0.28, sustain: 0.06, release: 0.45 },
      })
    case 'soft-pad':
      return new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        envelope: { attack: 0.08, decay: 0.4, sustain: 0.6, release: 1.4 },
      })
    case 'bell':
      return new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 5.07,
        modulationIndex: 6,
        envelope: { attack: 0.001, decay: 1.6, sustain: 0, release: 1.8 },
        modulationEnvelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 1 },
      })
  }
}

interface Graph {
  voices: Record<Part, Voice>
  dispose(): void
}

/** Builds voices → brightness filter → reverb → limiter → destination in the current Tone context. */
function buildGraph(plan: SongPlan): Graph {
  const limiter = new Tone.Limiter(-1).toDestination()
  const reverb = new Tone.Freeverb({ roomSize: 0.72, dampening: 2800, wet: 0.22 }).connect(limiter)
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 900 + plan.brightness * 7000, Q: 0.4 }).connect(reverb)

  const melody = melodyVoice(plan.instrument).connect(filter)
  melody.volume.value = -8
  const chords = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.35, decay: 0.5, sustain: 0.7, release: 1.6 },
  }).connect(filter)
  chords.volume.value = -20
  const bass = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.6 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.5, baseFrequency: 180, octaves: 2.2 },
  }).connect(filter)
  bass.volume.value = -14

  const nodes = [melody, chords, bass, filter, reverb, limiter]
  return { voices: { melody, chords, bass }, dispose: () => nodes.forEach((n) => n.dispose()) }
}

function schedule(graph: Graph, plan: SongPlan, start: number): void {
  for (const n of plan.notes) graph.voices[n.part].triggerAttackRelease([...n.notes], n.duration, start + n.time, n.velocity)
}

export interface Playback {
  /** Song length in seconds (without reverb tail). */
  readonly length: number
  /** Seconds since the first note (negative before it starts). */
  position(): number
  /** Resolves when playback finishes or is stopped. */
  readonly finished: Promise<void>
  stop(): void
}

let current: Playback | null = null

/** Plays a song through the speakers. Must be called from a user gesture the first time. */
export async function playSong(spec: SongSpec): Promise<Playback> {
  current?.stop()
  await Tone.start()
  const plan = planSong(spec)
  const graph = buildGraph(plan)
  const start = Tone.now() + 0.15
  schedule(graph, plan, start)

  let done: () => void = () => {}
  const finished = new Promise<void>((resolve) => (done = resolve))
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
    for (const v of Object.values(graph.voices)) (v as Tone.PolySynth).releaseAll?.()
    // Let the release ring briefly, then free the nodes.
    setTimeout(() => graph.dispose(), 400)
    if (current === playback) current = null
    done()
  }
  const timer = setTimeout(stop, (plan.length + TAIL_SECONDS + 0.2) * 1000)
  const playback: Playback = { length: plan.length, position: () => Tone.now() - start, finished, stop }
  current = playback
  return playback
}

/** Renders the song offline (faster than real time) and returns a WAV file. */
export async function renderWav(spec: SongSpec, sampleRate = 44100): Promise<Blob> {
  const plan = planSong(spec)
  const buffer = await Tone.Offline(
    () => {
      schedule(buildGraph(plan), plan, 0.05)
    },
    plan.length + TAIL_SECONDS,
    2,
    sampleRate,
  )
  const channels = buffer.toArray()
  const data = encodeWav(Array.isArray(channels) ? channels : [channels], sampleRate)
  return new Blob([data], { type: 'audio/wav' })
}
