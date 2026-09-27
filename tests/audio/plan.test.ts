import { describe, expect, it } from 'vitest'
import { encodeWav, planSong, swingBeat } from '../../src/audio/index.ts'
import { composeSong } from '../../src/engine/index.ts'

const song = (swing: number) =>
  composeSong({ discrete: { noseLength: 1, noseWidth: 2, eyeSpacing: 0 }, continuous: { faceAspect: 0.5, jawAngle: swing / 0.35, symmetry: 0.8 } })

describe('swingBeat', () => {
  it('leaves straight time alone at swing 0', () => {
    for (const b of [0, 0.25, 0.5, 1, 3.5, 7.75]) expect(swingBeat(b, 0)).toBeCloseTo(b, 12)
  })

  it('never moves whole beats and delays off-beat eighths', () => {
    for (const s of [0.2, 0.5, 1]) {
      expect(swingBeat(3, s)).toBe(3)
      expect(swingBeat(3.5, s)).toBeCloseTo(3.5 + s / 6, 12)
    }
    expect(swingBeat(0.5, 1)).toBeCloseTo(2 / 3, 12) // full triplet swing
  })

  it('is monotonic', () => {
    const xs = Array.from({ length: 400 }, (_, i) => i / 50)
    const ys = xs.map((x) => swingBeat(x, 0.8))
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1])
  })
})

describe('planSong', () => {
  it('converts beats to seconds at the song tempo', () => {
    const s = song(0)
    const plan = planSong(s)
    expect(plan.length).toBeCloseTo((s.bars * s.beatsPerBar * 60) / s.tempo, 9)
    const first = plan.notes.find((n) => n.part === 'melody')!
    expect(first.time).toBe(0)
    expect(first.duration).toBeCloseTo((s.melody[0].duration * 60) / s.tempo, 9)
  })

  it('includes every melody, bass and chord event, in time order', () => {
    const s = song(0.2)
    const plan = planSong(s)
    const count = (p: string) => plan.notes.filter((n) => n.part === p).length
    expect([count('melody'), count('bass'), count('chords')]).toEqual([s.melody.length, s.bass.length, s.chords.length])
    for (let i = 1; i < plan.notes.length; i++) expect(plan.notes[i].time).toBeGreaterThanOrEqual(plan.notes[i - 1].time)
    expect(plan.notes.find((n) => n.part === 'chords')!.notes).toHaveLength(3)
  })

  it('keeps the melody monophonic under swing', () => {
    const plan = planSong(song(0.35))
    const melody = plan.notes.filter((n) => n.part === 'melody')
    for (let i = 1; i < melody.length; i++) {
      expect(melody[i].time).toBeGreaterThanOrEqual(melody[i - 1].time + melody[i - 1].duration - 1e-9)
    }
  })

  it('uses note names Tone.js understands', () => {
    for (const n of planSong(song(0)).notes) for (const name of n.notes) expect(name).toMatch(/^[A-G]#?-?\d$/)
  })
})

describe('encodeWav', () => {
  it('writes a valid 16-bit PCM header and clipped samples', () => {
    const left = new Float32Array([0, 0.5, -1, 2])
    const right = new Float32Array([0, -0.5, 1, -2])
    const buf = encodeWav([left, right], 22050)
    const v = new DataView(buf)
    const text = (at: number, n: number) => String.fromCharCode(...new Uint8Array(buf, at, n))
    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 4)).toBe('WAVE')
    expect(v.getUint16(22, true)).toBe(2)
    expect(v.getUint32(24, true)).toBe(22050)
    expect(v.getUint32(40, true)).toBe(4 * 2 * 2)
    expect(buf.byteLength).toBe(44 + 16)
    expect(v.getInt16(44 + 4, true)).toBe(Math.trunc(0.5 * 0x7fff)) // 0.5, truncated like DataView does
    expect(v.getInt16(44 + 8, true)).toBe(-0x8000) // -1
    expect(v.getInt16(44 + 12, true)).toBe(0x7fff) // clipped 2
  })

  it('rejects mismatched channels', () => {
    expect(() => encodeWav([new Float32Array(2), new Float32Array(3)], 8000)).toThrow(RangeError)
    expect(() => encodeWav([], 8000)).toThrow(RangeError)
  })
})
