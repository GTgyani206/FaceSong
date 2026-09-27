import type { InstrumentName, ModeName, SongSpec } from '../engine/index.ts'

const MODE_LABELS: Record<ModeName, string> = {
  ionian: 'major',
  aeolian: 'minor',
  dorian: 'dorian',
  mixolydian: 'mixolydian',
  lydian: 'lydian',
}

const INSTRUMENT_LABELS: Record<InstrumentName, string> = {
  'glass-piano': 'Glass piano',
  marimba: 'Marimba',
  pluck: 'Pluck',
  'soft-pad': 'Soft pad',
  bell: 'Bell',
}

export const keyLabel = (s: SongSpec) => `${s.key.tonic} ${MODE_LABELS[s.mode]}`
export const instrumentLabel = (s: SongSpec) => INSTRUMENT_LABELS[s.instrument]
/** Display only: the spec keeps the exact continuous tempo. */
export const tempoLabel = (s: SongSpec) => `${Math.round(s.tempo)} BPM`

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const fileSafe = (title: string) => title.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'facesong'
