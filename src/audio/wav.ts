/** 16-bit PCM WAV encoder. Pure. */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  if (channels.length === 0) throw new RangeError('No audio channels')
  const frames = channels[0].length
  if (channels.some((c) => c.length !== frames)) throw new RangeError('Channels differ in length')
  const blockAlign = channels.length * 2
  const dataBytes = frames * blockAlign
  const buf = new ArrayBuffer(44 + dataBytes)
  const v = new DataView(buf)
  const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)))

  text(0, 'RIFF')
  v.setUint32(4, 36 + dataBytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true) // PCM chunk size
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, channels.length, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * blockAlign, true)
  v.setUint16(32, blockAlign, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, dataBytes, true)

  let at = 44
  for (let i = 0; i < frames; i++) {
    for (const ch of channels) {
      const s = Math.max(-1, Math.min(1, ch[i]))
      v.setInt16(at, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      at += 2
    }
  }
  return buf
}
