/** Supabase settings from Vite env. null = cloud features disabled. */
export interface CloudConfig {
  readonly url: string
  readonly anonKey: string
}

export const PHOTO_BUCKET = 'face-photos'

export function readCloudConfig(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }): CloudConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  try {
    if (new URL(url).protocol !== 'https:' && !url.startsWith('http://localhost')) return null
  } catch {
    return null
  }
  return { url: url.replace(/\/+$/, ''), anonKey }
}

/**
 * Storage path for a song's photo: the first folder must be the owner's user
 * id — the storage policies in supabase/migrations only allow that.
 */
export function photoPath(userId: string, songId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(songId)) throw new RangeError('Expected UUIDs')
  return `${userId}/${songId}.jpg`
}
