/** Scales, chords and note names. Pure. */

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
} as const

export type ModeName = keyof typeof MODES

export const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export type PitchClassName = (typeof PITCH_CLASS_NAMES)[number]

/**
 * Scale degree (0 = tonic, 7 = tonic an octave up, −1 = leading tone below)
 * → MIDI note, given the tonic's MIDI note.
 */
export function degreeToMidi(degree: number, tonicMidi: number, mode: ModeName): number {
  const octave = Math.floor(degree / 7)
  const step = ((degree % 7) + 7) % 7
  return tonicMidi + 12 * octave + MODES[mode][step]
}

/** Scale-degree class (0–6) of any degree. */
export const degreeClass = (degree: number): number => ((degree % 7) + 7) % 7

/** The three degree classes of the diatonic triad on `root` (0–6). */
export const triadClasses = (root: number): readonly number[] => [root, (root + 2) % 7, (root + 4) % 7]

export type ChordQuality = 'maj' | 'min' | 'dim' | 'aug'

export function triadQuality(root: number, mode: ModeName): ChordQuality {
  const semis = (d: number) => degreeToMidi(d, 0, mode)
  const third = semis(root + 2) - semis(root)
  const fifth = semis(root + 4) - semis(root)
  if (third === 4) return fifth === 8 ? 'aug' : 'maj'
  return fifth === 6 ? 'dim' : 'min'
}

/** e.g. "Am", "F#", "Bdim". */
export function chordSymbol(root: number, tonicPc: number, mode: ModeName): string {
  const pc = degreeToMidi(root, tonicPc, mode) % 12
  const suffix = { maj: '', min: 'm', dim: 'dim', aug: 'aug' }[triadQuality(root, mode)]
  return `${PITCH_CLASS_NAMES[pc]}${suffix}`
}

/** MIDI → scientific pitch name, e.g. 60 → "C4". */
export function midiToName(midi: number): string {
  return `${PITCH_CLASS_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

/** Pitch classes of a mode on a tonic. */
export function scalePitchClasses(tonicPc: number, mode: ModeName): Set<number> {
  return new Set(MODES[mode].map((s) => (tonicPc + s) % 12))
}
