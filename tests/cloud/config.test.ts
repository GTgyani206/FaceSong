import { describe, expect, it } from 'vitest'
import { photoPath, readCloudConfig } from '../../src/cloud/config.ts'

describe('readCloudConfig', () => {
  it('is null unless both URL and anon key are set', () => {
    expect(readCloudConfig({})).toBeNull()
    expect(readCloudConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(readCloudConfig({ VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
    expect(readCloudConfig({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
  })

  it('accepts https (and localhost for a local Supabase), trimming a trailing slash', () => {
    expect(readCloudConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: ' k ' })).toEqual({
      url: 'https://x.supabase.co',
      anonKey: 'k',
    })
    expect(readCloudConfig({ VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'k' })?.url).toBe(
      'http://localhost:54321',
    )
  })

  it('rejects plain http and malformed URLs', () => {
    expect(readCloudConfig({ VITE_SUPABASE_URL: 'http://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
    expect(readCloudConfig({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
  })
})

describe('photoPath', () => {
  const user = '11111111-2222-4333-8444-555555555555'
  const song = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

  it("puts the photo in the owner's folder (what the storage policies require)", () => {
    expect(photoPath(user, song)).toBe(`${user}/${song}.jpg`)
  })

  it('refuses anything but UUIDs, so no path tricks reach storage', () => {
    expect(() => photoPath('../other-user', song)).toThrow(RangeError)
    expect(() => photoPath(user, 'x/../../y')).toThrow(RangeError)
  })
})
