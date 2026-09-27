/**
 * cloud/ — optional Supabase storage for songs and (opt-in) photos.
 * Configured by VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY; disabled without them.
 */
import { readCloudConfig } from './config.ts'

export const cloudConfig = readCloudConfig(import.meta.env)

export { photoPath, PHOTO_BUCKET, readCloudConfig } from './config.ts'
export type { CloudConfig } from './config.ts'
export { MAX_PHOTO_SIDE, preparePhoto } from './photo.ts'
export { currentUserId, deleteAllMyData, deleteSong, listSongs, photoUrls, saveSong } from './songs.ts'
export type { SaveInput, SongRow } from './songs.ts'
