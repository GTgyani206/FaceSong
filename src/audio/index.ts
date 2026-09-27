/**
 * audio/ — Tone.js renderer: SongSpec → sound. Tone.js (~hundreds of KB) is
 * only loaded when something is first played or rendered.
 */
import type { SongSpec } from '../engine/index.ts'
import type { Playback } from './player.ts'

export type { Playback } from './player.ts'
export { planSong, swingBeat, TAIL_SECONDS } from './plan.ts'
export type { Part, PlannedNote, SongPlan } from './plan.ts'
export { encodeWav } from './wav.ts'

const load = () => import('./player.ts')

export async function playSong(spec: SongSpec): Promise<Playback> {
  return (await load()).playSong(spec)
}

export async function renderWav(spec: SongSpec): Promise<Blob> {
  return (await load()).renderWav(spec)
}
