import type { SupabaseClient } from '@supabase/supabase-js'
import type { SongSpec } from '../engine/index.ts'
import type { QuantizedIdentity } from '../features/index.ts'
import { photoPath, PHOTO_BUCKET, type CloudConfig } from './config.ts'

/*
 * Supabase access. Loaded lazily (supabase-js stays out of the main bundle)
 * and only when the user saves or opens "My songs" — merely visiting the app
 * never creates an account.
 *
 * Photos: uploaded ONLY when `photo` is passed, which the UI does only after
 * the user ticks the consent box for that save. Private bucket, one folder
 * per (anonymous) user, enforced by RLS policies.
 */

export interface SongRow {
  readonly id: string
  readonly user_id: string
  readonly created_at: string
  readonly title: string
  readonly spec: SongSpec
  readonly identity: QuantizedIdentity
  readonly photo_path: string | null
  readonly photo_consent_at: string | null
}

let client: Promise<SupabaseClient> | null = null

function getClient(config: CloudConfig): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true } }),
  )
  return client
}

/** Current user id, or null if this browser has never saved anything. No network if signed out. */
export async function currentUserId(config: CloudConfig): Promise<string | null> {
  const { data } = await (await getClient(config)).auth.getSession()
  return data.session?.user.id ?? null
}

/** Signs in anonymously if needed. Requires "Anonymous sign-ins" enabled in Supabase Auth. */
async function ensureUser(config: CloudConfig): Promise<{ sb: SupabaseClient; userId: string }> {
  const sb = await getClient(config)
  const existing = (await sb.auth.getSession()).data.session
  if (existing) return { sb, userId: existing.user.id }
  const { data, error } = await sb.auth.signInAnonymously()
  if (error || !data.user) throw new Error(`Could not start an anonymous session: ${error?.message ?? 'no user'}`)
  return { sb, userId: data.user.id }
}

export interface SaveInput {
  readonly spec: SongSpec
  readonly identity: QuantizedIdentity
  /** JPEG to store. Pass ONLY with the user's explicit consent for this save. */
  readonly photo?: Blob
}

export async function saveSong(config: CloudConfig, input: SaveInput): Promise<SongRow> {
  const { sb, userId } = await ensureUser(config)
  const id = crypto.randomUUID()
  let path: string | null = null

  if (input.photo) {
    path = photoPath(userId, id)
    const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, input.photo, { contentType: 'image/jpeg', upsert: false })
    if (error) throw new Error(`Photo upload failed: ${error.message}`)
  }

  const { data, error } = await sb
    .from('songs')
    .insert({
      id,
      user_id: userId,
      title: input.spec.title,
      spec: input.spec,
      identity: input.identity,
      photo_path: path,
      photo_consent_at: path ? new Date().toISOString() : null,
    })
    .select()
    .single()
  if (error || !data) {
    // Don't leave an orphaned photo behind.
    if (path) await sb.storage.from(PHOTO_BUCKET).remove([path])
    throw new Error(`Saving the song failed: ${error?.message ?? 'no row returned'}`)
  }
  return data as SongRow
}

export async function listSongs(config: CloudConfig): Promise<SongRow[]> {
  const sb = await getClient(config)
  if (!(await sb.auth.getSession()).data.session) return []
  const { data, error } = await sb.from('songs').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(`Loading songs failed: ${error.message}`)
  return (data ?? []) as SongRow[]
}

/** Short-lived signed URLs for private photos, keyed by storage path. */
export async function photoUrls(config: CloudConfig, paths: readonly string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const sb = await getClient(config)
  const { data, error } = await sb.storage.from(PHOTO_BUCKET).createSignedUrls([...paths], 60 * 60)
  if (error) throw new Error(`Loading photos failed: ${error.message}`)
  const out: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  return out
}

/** Deletes a song and its photo (photo first, so a failure never orphans it). */
export async function deleteSong(config: CloudConfig, row: SongRow): Promise<void> {
  const sb = await getClient(config)
  if (row.photo_path) {
    const { error } = await sb.storage.from(PHOTO_BUCKET).remove([row.photo_path])
    if (error) throw new Error(`Deleting the photo failed: ${error.message}`)
  }
  const { error } = await sb.from('songs').delete().eq('id', row.id)
  if (error) throw new Error(`Deleting the song failed: ${error.message}`)
}

/** Deletes every photo and song of this browser's user, then signs out. */
export async function deleteAllMyData(config: CloudConfig): Promise<void> {
  const sb = await getClient(config)
  const session = (await sb.auth.getSession()).data.session
  if (!session) return
  const userId = session.user.id

  const { data: files, error: listError } = await sb.storage.from(PHOTO_BUCKET).list(userId, { limit: 1000 })
  if (listError) throw new Error(`Listing photos failed: ${listError.message}`)
  if (files && files.length > 0) {
    const { error } = await sb.storage.from(PHOTO_BUCKET).remove(files.map((f) => `${userId}/${f.name}`))
    if (error) throw new Error(`Deleting photos failed: ${error.message}`)
  }
  const { error } = await sb.from('songs').delete().eq('user_id', userId)
  if (error) throw new Error(`Deleting songs failed: ${error.message}`)
  await sb.auth.signOut()
}
