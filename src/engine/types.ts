import type { ModeName, PitchClassName } from './theory.ts'

export const INSTRUMENTS = ['glass-piano', 'marimba', 'pluck', 'soft-pad', 'bell'] as const
export type InstrumentName = (typeof INSTRUMENTS)[number]

/** One melody or bass note. Times are in beats (quarter notes) from the start. */
export interface NoteEvent {
  readonly beat: number
  readonly duration: number
  readonly midi: number
  /** 0–1. */
  readonly velocity: number
}

export interface MelodyNote extends NoteEvent {
  /** Starts on beat 1 or 3 of its bar (and is therefore a chord tone). */
  readonly strong: boolean
  /** Which phrase section it belongs to. */
  readonly section: 'motif' | 'repeat' | 'variation' | 'cadence'
}

export interface ChordEvent {
  readonly bar: number
  /** Scale degree of the root, 0–6. */
  readonly degree: number
  readonly symbol: string
  /** Voiced triad, MIDI notes. */
  readonly midi: readonly number[]
}

/**
 * The complete, renderer-independent description of a song. JSON-safe.
 * Same QuantizedIdentity → identical SongSpec.
 */
export interface SongSpec {
  readonly version: 1
  /** Hash of the DISCRETE_IDENTITY bins; every discrete choice derives from it. */
  readonly seed: number
  readonly title: string
  readonly key: { readonly tonic: PitchClassName; readonly pitchClass: number }
  readonly mode: ModeName
  readonly instrument: InstrumentName
  readonly beatsPerBar: 4
  readonly bars: number
  /** Continuous (from CONTINUOUS_IDENTITY): beats per minute. */
  readonly tempo: number
  /** Continuous: 0 = straight eighths, 1 = full triplet swing. */
  readonly swing: number
  /** Continuous: 0 = dark, 1 = bright timbre. */
  readonly brightness: number
  readonly chords: readonly ChordEvent[]
  readonly melody: readonly MelodyNote[]
  readonly bass: readonly NoteEvent[]
}
