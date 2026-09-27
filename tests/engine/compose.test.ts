import { describe, expect, it } from 'vitest'
import { composeSong, fnv1a, MODES, Rng, scalePitchClasses, triadQuality, type SongSpec } from '../../src/engine/index.ts'
import { quantizeIdentity, extractFeatures, type QuantizedIdentity } from '../../src/features/index.ts'
import { canonicalFace } from '../helpers/face.ts'

const mid = { faceAspect: 0.5, jawAngle: 0.5, symmetry: 0.5 }
const identity = (noseLength: number, noseWidth: number, eyeSpacing: number, continuous = mid): QuantizedIdentity => ({
  discrete: { noseLength, noseWidth, eyeSpacing },
  continuous,
})

/** All 27 discrete combinations. */
const ALL: QuantizedIdentity[] = [0, 1, 2].flatMap((a) => [0, 1, 2].flatMap((b) => [0, 1, 2].map((c) => identity(a, b, c))))
const SONGS = ALL.map(composeSong)

const pc = (midi: number) => ((midi % 12) + 12) % 12
const chordAt = (s: SongSpec, beat: number) => s.chords[Math.floor(beat / s.beatsPerBar)]
const rhythmOf = (s: SongSpec, section: string) => {
  const notes = s.melody.filter((n) => n.section === section)
  return notes.map((n) => [n.beat - notes[0].beat, n.duration])
}

describe('composeSong: determinism', () => {
  it('same identity → identical SongSpec, including its JSON', () => {
    for (const q of ALL) {
      const a = composeSong(q)
      const b = composeSong(structuredClone(q))
      expect(b).toEqual(a)
      expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    }
  })

  it('composes from a real feature pipeline', () => {
    const song = composeSong(quantizeIdentity(extractFeatures(canonicalFace)))
    expect(song.melody.length).toBeGreaterThan(20)
  })

  it('every discrete combination gets its own seed, and nearly all get their own melody', () => {
    expect(new Set(SONGS.map((s) => s.seed)).size).toBe(27)
    const melodies = new Set(SONGS.map((s) => JSON.stringify([s.key, s.mode, s.melody.map((n) => [n.beat, n.midi])])))
    expect(melodies.size).toBe(27)
  })

  it('continuous identity changes only tempo, swing and brightness (never a discrete choice)', () => {
    const extremes = [
      { faceAspect: 0, jawAngle: 0, symmetry: 0 },
      { faceAspect: 1, jawAngle: 1, symmetry: 1 },
      { faceAspect: 0.37, jawAngle: 0.91, symmetry: 0.02 },
    ]
    for (const q of ALL) {
      const base = composeSong(q)
      for (const c of extremes) {
        const { tempo, swing, brightness, ...rest } = composeSong({ ...q, continuous: c })
        const { tempo: t0, swing: s0, brightness: b0, ...baseRest } = base
        expect(rest).toEqual(baseRest)
        expect([tempo, swing, brightness]).not.toEqual([t0, s0, b0])
      }
    }
  })

  it('maps continuous values smoothly: tempo 72–120 BPM, swing 0–0.35, brightness 0–1', () => {
    const at = (v: number) => composeSong(identity(1, 1, 1, { faceAspect: v, jawAngle: v, symmetry: v }))
    expect(at(0)).toMatchObject({ tempo: 72, swing: 0, brightness: 0 })
    expect(at(1)).toMatchObject({ tempo: 120, swing: 0.35, brightness: 1 })
    expect(at(0.501).tempo - at(0.5).tempo).toBeCloseTo(0.048, 6)
  })
})

describe('composeSong: music rules', () => {
  it('is scale-locked: every melody, chord and bass note is in the key', () => {
    for (const s of SONGS) {
      const scale = scalePitchClasses(s.key.pitchClass, s.mode)
      const all = [...s.melody.map((n) => n.midi), ...s.bass.map((n) => n.midi), ...s.chords.flatMap((c) => c.midi)]
      for (const m of all) expect(scale.has(pc(m)), `${s.title}: ${m}`).toBe(true)
    }
  })

  it('puts chord tones on strong beats (beats 1 and 3)', () => {
    for (const s of SONGS) {
      for (const n of s.melody) {
        const onStrongBeat = (n.beat % s.beatsPerBar) % 2 === 0
        expect(n.strong, `${s.title} beat ${n.beat}`).toBe(onStrongBeat)
        if (n.strong) {
          const tones = new Set(chordAt(s, n.beat).midi.map(pc))
          expect(tones.has(pc(n.midi)), `${s.title} beat ${n.beat}`).toBe(true)
        }
      }
    }
  })

  it('prefers stepwise motion', () => {
    let steps = 0
    let total = 0
    for (const s of SONGS) {
      const iv = s.melody.slice(1).map((n, i) => Math.abs(n.midi - s.melody[i].midi))
      const songSteps = iv.filter((d) => d <= 2).length
      expect(songSteps / iv.length, s.title).toBeGreaterThan(0.45)
      expect(Math.max(...iv), `${s.title} leap`).toBeLessThanOrEqual(12)
      steps += songSteps
      total += iv.length
    }
    expect(steps / total).toBeGreaterThan(0.6)
  })

  it('follows motif → repeat → variation → cadence, reusing the motif rhythm', () => {
    for (const s of SONGS) {
      expect([...new Set(s.melody.map((n) => n.section))]).toEqual(['motif', 'repeat', 'variation', 'cadence'])
      const motif = rhythmOf(s, 'motif')
      expect(rhythmOf(s, 'repeat')).toEqual(motif)
      expect(rhythmOf(s, 'variation')).toEqual(motif)
      const sectionStart = (name: string) => s.melody.find((n) => n.section === name)!.beat
      expect([sectionStart('motif'), sectionStart('repeat'), sectionStart('variation'), sectionStart('cadence')]).toEqual([0, 8, 16, 24])
    }
  })

  it('ends on the tonic over a tonic chord', () => {
    for (const s of SONGS) {
      const last = s.melody.at(-1)!
      expect(pc(last.midi)).toBe(s.key.pitchClass)
      expect(last.beat + last.duration).toBe(s.bars * s.beatsPerBar)
      expect(s.chords.at(-1)!.degree).toBe(0)
    }
  })

  it('uses no diminished or augmented chords', () => {
    for (const s of SONGS) for (const c of s.chords) expect(['maj', 'min']).toContain(triadQuality(c.degree, s.mode))
  })

  it('keeps the melody monophonic, in time and in range', () => {
    for (const s of SONGS) {
      for (const [i, n] of s.melody.entries()) {
        if (i > 0) expect(n.beat).toBeGreaterThanOrEqual(s.melody[i - 1].beat + s.melody[i - 1].duration)
        expect(n.beat + n.duration).toBeLessThanOrEqual(s.bars * s.beatsPerBar)
        expect(n.midi).toBeGreaterThanOrEqual(54)
        expect(n.midi).toBeLessThanOrEqual(84)
        expect(n.velocity).toBeGreaterThan(0)
        expect(n.velocity).toBeLessThanOrEqual(1)
      }
    }
  })

  it('uses only known modes', () => {
    for (const s of SONGS) expect(Object.keys(MODES)).toContain(s.mode)
  })
})

describe('composeSong: validation', () => {
  it('rejects out-of-range bins and continuous values', () => {
    expect(() => composeSong(identity(3, 0, 0))).toThrow(/noseLength/)
    expect(() => composeSong(identity(0, 1.5, 0))).toThrow(/noseWidth/)
    expect(() => composeSong(identity(0, 0, 0, { ...mid, symmetry: 1.2 }))).toThrow(/symmetry/)
    expect(() => composeSong(identity(0, 0, 0, { ...mid, faceAspect: Number.NaN }))).toThrow(/faceAspect/)
  })
})

describe('PRNG', () => {
  it('is deterministic and roughly uniform', () => {
    const a = new Rng(fnv1a('x'))
    const b = new Rng(fnv1a('x'))
    const xs = Array.from({ length: 5000 }, () => a.next())
    expect(Array.from({ length: 5000 }, () => b.next())).toEqual(xs)
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length
    expect(mean).toBeGreaterThan(0.47)
    expect(mean).toBeLessThan(0.53)
    expect(xs.every((v) => v >= 0 && v < 1)).toBe(true)
  })

  it('fnv1a matches the reference value', () => {
    expect(fnv1a('')).toBe(0x811c9dc5)
    expect(fnv1a('a')).toBe(0xe40c292c)
  })
})
