import { midiToName, type InstrumentName, type SongSpec } from '../engine/index.ts'

/*
 * SongSpec → a flat, time-ordered list of notes in seconds. Pure: no Tone.js,
 * so the timing (including swing) is unit-tested in Node.
 */

export type Part = 'melody' | 'chords' | 'bass'

export interface PlannedNote {
  readonly part: Part
  /** Seconds from the start. */
  readonly time: number
  readonly duration: number
  /** Scientific pitch names, e.g. ["C4", "E4", "G4"]. */
  readonly notes: readonly string[]
  readonly velocity: number
}

export interface SongPlan {
  readonly instrument: InstrumentName
  readonly brightness: number
  /** Seconds until the last note ends (without reverb tail). */
  readonly length: number
  readonly notes: readonly PlannedNote[]
}

/** Extra seconds to let the final notes and reverb ring out. */
export const TAIL_SECONDS = 2.5

/**
 * Swing: off-beat eighths (x.5) are delayed by swing/6 of a beat; at
 * swing = 1 they land on the last triplet (x.667). Piecewise-linear and
 * monotonic, so whole beats never move and notes never overlap.
 */
export function swingBeat(beat: number, swing: number): number {
  const whole = Math.floor(beat)
  const frac = beat - whole
  const mid = 0.5 + swing / 6
  return whole + (frac <= 0.5 ? (frac / 0.5) * mid : mid + ((frac - 0.5) / 0.5) * (1 - mid))
}

export function planSong(spec: SongSpec): SongPlan {
  const secondsPerBeat = 60 / spec.tempo
  const at = (beat: number) => swingBeat(beat, spec.swing) * secondsPerBeat
  const note = (part: Part, beat: number, duration: number, midi: readonly number[], velocity: number): PlannedNote => ({
    part,
    time: at(beat),
    duration: at(beat + duration) - at(beat),
    notes: midi.map(midiToName),
    velocity,
  })

  const notes = [
    ...spec.chords.map((c) => note('chords', c.bar * spec.beatsPerBar, spec.beatsPerBar, c.midi, 0.5)),
    ...spec.bass.map((n) => note('bass', n.beat, n.duration, [n.midi], n.velocity)),
    ...spec.melody.map((n) => note('melody', n.beat, n.duration, [n.midi], n.velocity)),
  ].sort((a, b) => a.time - b.time || a.part.localeCompare(b.part))

  return {
    instrument: spec.instrument,
    brightness: spec.brightness,
    length: at(spec.bars * spec.beatsPerBar),
    notes,
  }
}
