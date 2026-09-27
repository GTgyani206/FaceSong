/**
 * engine/ — PURE: QuantizedIdentity → SongSpec. Seeded PRNG, no Math.random.
 * Consumes nothing from features/ except QuantizedIdentity (see CLAUDE.md).
 */
export { composeSong } from './compose.ts'
export { fnv1a, Rng } from './prng.ts'
export { chordSymbol, degreeToMidi, midiToName, MODES, PITCH_CLASS_NAMES, scalePitchClasses, triadQuality } from './theory.ts'
export type { ModeName, PitchClassName } from './theory.ts'
export { INSTRUMENTS } from './types.ts'
export type { ChordEvent, InstrumentName, MelodyNote, NoteEvent, SongSpec } from './types.ts'
