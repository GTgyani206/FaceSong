import { DISCRETE_BINS, DISCRETE_IDENTITY, type QuantizedIdentity } from '../features/index.ts'
import { fnv1a, Rng } from './prng.ts'
import {
  chordSymbol,
  degreeClass,
  degreeToMidi,
  PITCH_CLASS_NAMES,
  triadClasses,
  type ModeName,
} from './theory.ts'
import type { ChordEvent, InstrumentName, MelodyNote, NoteEvent, SongSpec } from './types.ts'

/*
 * QuantizedIdentity → SongSpec.
 *
 * Every DISCRETE choice (title, key, mode, instrument, rhythm, chords,
 * melody) comes from the DISCRETE_IDENTITY bins: directly (bin → pool) or via
 * a PRNG seeded only by those bins. CONTINUOUS_IDENTITY values only scale
 * tempo, swing and brightness. See CLAUDE.md.
 */

const BARS = 8
const BEATS_PER_BAR = 4

/** noseWidth bin → mode pool (darker → brighter). */
const MODE_POOLS: readonly (readonly ModeName[])[] = [
  ['aeolian', 'dorian'],
  ['dorian', 'mixolydian'],
  ['ionian', 'lydian'],
]

/** eyeSpacing bin → instrument pool. */
const INSTRUMENT_POOLS: readonly (readonly InstrumentName[])[] = [
  ['soft-pad', 'bell'],
  ['glass-piano', 'marimba'],
  ['pluck', 'marimba'],
]

type Rhythm = readonly (readonly [start: number, duration: number])[]

/**
 * noseLength bin → pool of 2-bar motif rhythms (calm → busy). Every rhythm
 * has a note on each strong beat (0, 2, 4, 6).
 */
const RHYTHM_POOLS: readonly (readonly Rhythm[])[] = [
  [
    [[0, 1.5], [1.5, 0.5], [2, 1], [3, 0.5], [3.5, 0.5], [4, 2], [6, 1], [7, 1]],
    [[0, 2], [2, 0.5], [2.5, 0.5], [3, 1], [4, 1], [5, 0.5], [5.5, 0.5], [6, 2]],
  ],
  [
    [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1], [4, 1.5], [5.5, 0.5], [6, 2]],
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 0.5], [4.5, 0.5], [5, 1], [6, 2]],
  ],
  [
    [[0, 0.5], [0.5, 0.5], [1, 1], [2, 1.5], [3.5, 0.5], [4, 1], [5, 1], [6, 2]],
    [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 2], [4, 0.5], [4.5, 0.5], [5, 1], [6, 2]],
  ],
]

/** 4-bar progressions (root scale degrees) per mode. No diminished chords. */
const PROGRESSIONS: Readonly<Record<ModeName, readonly (readonly number[])[]>> = {
  ionian: [[0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 5, 3], [0, 3, 5, 4], [0, 2, 3, 4], [0, 5, 1, 4]],
  lydian: [[0, 1, 0, 4], [0, 1, 5, 4], [0, 4, 1, 0], [0, 5, 1, 4]],
  mixolydian: [[0, 6, 3, 0], [0, 3, 6, 3], [0, 6, 4, 3], [0, 5, 6, 0]],
  dorian: [[0, 3, 0, 3], [0, 6, 3, 0], [0, 2, 3, 6], [0, 3, 6, 4]],
  aeolian: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 6], [0, 2, 6, 3]],
}

/** Penultimate-bar chord before the final tonic, per mode. */
const CADENCE_CHORDS: Readonly<Record<ModeName, readonly number[]>> = {
  ionian: [4, 3],
  lydian: [4, 1],
  mixolydian: [6, 3],
  dorian: [3, 6],
  aeolian: [4, 6],
}

const ADJECTIVES = ['Quiet', 'Golden', 'Paper', 'Velvet', 'Silver', 'Hidden', 'Early', 'Northern', 'Gentle', 'Lucid', 'Amber', 'Distant', 'Bright', 'Hollow', 'Wandering', 'Tender']
const NOUNS = ['Harbor', 'Lantern', 'Orchard', 'Meridian', 'Tide', 'Window', 'Comet', 'Garden', 'Signal', 'River', 'Echo', 'Atlas', 'Morning', 'Ember', 'Canopy', 'Compass']

/** Melody range, in scale degrees relative to the tonic. */
const LO = 0
const HI = 11

export function composeSong(identity: QuantizedIdentity): SongSpec {
  const bins = validate(identity)
  const seed = fnv1a(`facesong/v1:${DISCRETE_IDENTITY.map((n) => `${n}=${bins[n]}`).join('|')}`)
  const rng = new Rng(seed)

  const title = `${rng.pick(ADJECTIVES)} ${rng.pick(NOUNS)}`
  const tonicPc = rng.int(12)
  const mode = rng.pick(MODE_POOLS[bins.noseWidth])
  const instrument = rng.pick(INSTRUMENT_POOLS[bins.eyeSpacing])
  const rhythm = rng.pick(RHYTHM_POOLS[bins.noseLength])

  // Tonic between F#3 and F4 keeps the melody (up to degree 11) below ~C6.
  const tonicMidi = tonicPc <= 5 ? 60 + tonicPc : 48 + tonicPc

  const progression = rng.pick(PROGRESSIONS[mode])
  const roots = [...progression, progression[0], progression[1], rng.pick(CADENCE_CHORDS[mode]), 0]
  const chords: ChordEvent[] = roots.map((degree, bar) => ({
    bar,
    degree,
    symbol: chordSymbol(degree, tonicPc, mode),
    midi: [0, 2, 4].map((k) => degreeToMidi(degree + k, tonicMidi - 12, mode)),
  }))

  const melodyDegrees = composeMelody(rng, rhythm, roots)
  const melody: MelodyNote[] = melodyDegrees.map((n) => ({
    beat: n.beat,
    duration: n.duration,
    midi: degreeToMidi(n.degree, tonicMidi, mode),
    velocity: round3((n.strong ? 0.82 : 0.64) + (rng.next() - 0.5) * 0.08),
    strong: n.strong,
    section: n.section,
  }))

  const bass: NoteEvent[] = roots.flatMap((degree, bar) => {
    const at = bar * BEATS_PER_BAR
    const root = degreeToMidi(degree, tonicMidi - 24, mode)
    if (bar === BARS - 1) return [{ beat: at, duration: 4, midi: root, velocity: 0.7 }]
    const second = rng.next() < 0.5 ? root : degreeToMidi(degree + 4, tonicMidi - 24, mode)
    return [
      { beat: at, duration: 2, midi: root, velocity: 0.72 },
      { beat: at + 2, duration: 2, midi: second, velocity: 0.62 },
    ]
  })

  const c = identity.continuous
  return {
    version: 1,
    seed,
    title,
    key: { tonic: PITCH_CLASS_NAMES[tonicPc], pitchClass: tonicPc },
    mode,
    instrument,
    beatsPerBar: BEATS_PER_BAR,
    bars: BARS,
    tempo: 72 + 48 * c.faceAspect,
    swing: 0.35 * c.jawAngle,
    brightness: c.symmetry,
    chords,
    melody,
    bass,
  }
}

interface DegreeNote {
  beat: number
  duration: number
  degree: number
  strong: boolean
  section: MelodyNote['section']
}

const isStrong = (beat: number) => beat % 2 === 0 // beats 1 and 3 of each 4/4 bar

/**
 * Motif (bars 1–2) → repeat (3–4) → variation (5–6) → cadence (7–8).
 * Strong beats are always chord tones; weak beats move by step (mostly ±1).
 */
function composeMelody(rng: Rng, rhythm: Rhythm, roots: readonly number[]): DegreeNote[] {
  const rootAt = (beat: number) => roots[Math.floor(beat / BEATS_PER_BAR)]
  const notes: DegreeNote[] = []

  // Motif: a stepwise walk with chord tones on strong beats.
  const motif: number[] = []
  let prev = rng.pick(chordTonesIn(roots[0], 2, 7))
  for (const [i, [start, duration]] of rhythm.entries()) {
    const degree =
      i === 0 ? prev : isStrong(start) ? nearestChordTone(prev, rootAt(start), rng) : step(prev, rng)
    motif.push(degree)
    notes.push({ beat: start, duration, degree, strong: isStrong(start), section: 'motif' })
    prev = degree
  }
  const intervals = motif.slice(1).map((d, i) => d - motif[i])

  // Repeat the motif's rhythm and contour over the next two bars' chords.
  prev = realize(notes, rhythm, 8, intervals, motif[0], roots, rng, 'repeat')

  // Variation: invert the contour of the second bar, then nudge one weak note.
  const half = rhythm.findIndex(([start]) => start >= 4)
  const varied = intervals.map((iv, i) => (i + 1 >= half ? -iv : iv))
  const weak = varied.flatMap((_, i) => (isStrong(rhythm[i + 1][0]) ? [] : [i]))
  if (weak.length > 0) {
    const j = rng.pick(weak)
    varied[j] += varied[j] > 0 ? -1 : 1
  }
  prev = realize(notes, rhythm, 16, varied, prev, roots, rng, 'variation')

  // Cadence: the motif's first-bar rhythm stepping toward the tonic, then the tonic.
  const tonicTarget = Math.abs(prev - 7) < Math.abs(prev - 0) ? 7 : 0
  for (const [start, duration] of rhythm.filter(([s]) => s < 4)) {
    const beat = 24 + start
    let degree: number
    if (isStrong(beat)) degree = nearestChordTone(prev, rootAt(beat), rng, tonicTarget)
    else degree = clamp(prev + Math.sign(tonicTarget - prev || (rng.next() < 0.5 ? 1 : -1)))
    notes.push({ beat, duration, degree, strong: isStrong(beat), section: 'cadence' })
    prev = degree
  }
  const final = Math.abs(prev - 7) <= Math.abs(prev - 0) ? 7 : 0
  notes.push({ beat: 28, duration: 4, degree: final, strong: true, section: 'cadence' })
  return notes
}

/**
 * Lay the motif rhythm starting at `offset` beats, following `intervals`,
 * snapping strong beats to the nearest chord tone. Returns the last degree.
 */
function realize(
  out: DegreeNote[],
  rhythm: Rhythm,
  offset: number,
  intervals: readonly number[],
  from: number,
  roots: readonly number[],
  rng: Rng,
  section: DegreeNote['section'],
): number {
  const rootAt = (beat: number) => roots[Math.floor(beat / BEATS_PER_BAR)]
  let prev = from
  for (const [i, [start, duration]] of rhythm.entries()) {
    const beat = offset + start
    const target = i === 0 ? from : prev + intervals[i - 1]
    const degree = isStrong(beat) ? nearestChordTone(clampOctave(target), rootAt(beat), rng) : clampOctave(target)
    out.push({ beat, duration, degree, strong: isStrong(beat), section })
    prev = degree
  }
  return prev
}

function chordTonesIn(root: number, lo: number, hi: number): number[] {
  const classes = triadClasses(root)
  const out: number[] = []
  for (let d = lo; d <= hi; d++) if (classes.includes(degreeClass(d))) out.push(d)
  return out
}

/** Chord tone of `root` closest to `near` (ties: toward `prefer` if given, else random). */
function nearestChordTone(near: number, root: number, rng: Rng, prefer?: number): number {
  const tones = chordTonesIn(root, LO, HI)
  const best = Math.min(...tones.map((t) => Math.abs(t - near)))
  const ties = tones.filter((t) => Math.abs(t - near) === best)
  if (ties.length === 1) return ties[0]
  if (prefer !== undefined) return ties.reduce((a, b) => (Math.abs(b - prefer) < Math.abs(a - prefer) ? b : a))
  return rng.pick(ties)
}

/** Mostly steps of one scale degree, sometimes a third, rarely a repeat. */
function step(prev: number, rng: Rng): number {
  const size = rng.weighted([
    [1, 0.75],
    [2, 0.18],
    [0, 0.07],
  ] as const)
  const dir = rng.next() < 0.5 ? -1 : 1
  const next = prev + dir * size
  return next < LO || next > HI ? prev - dir * size : next
}

const clamp = (d: number) => Math.min(HI, Math.max(LO, d))
/** Keep a contour-following degree in range by shifting it an octave. */
const clampOctave = (d: number) => (d > HI ? d - 7 : d < LO ? d + 7 : d)
const round3 = (v: number) => Math.round(v * 1000) / 1000

function validate(identity: QuantizedIdentity): Readonly<Record<(typeof DISCRETE_IDENTITY)[number], number>> {
  for (const name of DISCRETE_IDENTITY) {
    const bin = identity.discrete[name]
    if (!Number.isInteger(bin) || bin < 0 || bin >= DISCRETE_BINS) throw new RangeError(`Invalid ${name} bin: ${bin}`)
  }
  for (const [name, value] of Object.entries(identity.continuous)) {
    if (!(value >= 0 && value <= 1)) throw new RangeError(`Invalid ${name}: ${value}`)
  }
  return identity.discrete
}
