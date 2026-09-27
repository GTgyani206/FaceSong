import { useEffect, useState } from 'react'
import { cloudConfig, type CloudConfig, deleteAllMyData, deleteSong, listSongs, photoUrls, type SongRow } from '../cloud/index.ts'
import { instrumentLabel, keyLabel, tempoLabel } from './format.ts'
import SongPlayer from './SongPlayer.tsx'

async function fetchLibrary(config: CloudConfig) {
  const rows = await listSongs(config)
  const urls = await photoUrls(config, rows.flatMap((r) => (r.photo_path ? [r.photo_path] : [])))
  return { rows, urls }
}

/** "My songs": this browser's saved songs and (opt-in) photos. */
export default function Library({ onCreate }: { onCreate: () => void }) {
  const [rows, setRows] = useState<SongRow[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)

  useEffect(() => {
    if (!cloudConfig) return
    let cancelled = false
    fetchLibrary(cloudConfig).then(
      ({ rows, urls }) => {
        if (cancelled) return
        setError(null)
        setRows(rows)
        setUrls(urls)
      },
      (e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setRows([])
      },
    )
    return () => {
      cancelled = true
    }
  }, [version])

  if (!cloudConfig) {
    return (
      <section className="library">
        <h1>My songs</h1>
        <p className="hint">Saving songs isn't set up. Add Supabase keys to <code>.env.local</code> (see README).</p>
      </section>
    )
  }
  const config = cloudConfig

  const remove = async (row: SongRow) => {
    if (!confirm(`Delete “${row.title}”${row.photo_path ? ' and its photo' : ''}? This can't be undone.`)) return
    setBusy(true)
    try {
      await deleteSong(config, row)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const removeAll = async () => {
    if (!confirm('Delete all your songs and photos from FaceSong? This can’t be undone.')) return
    setBusy(true)
    try {
      await deleteAllMyData(config)
      setRows([])
      setUrls({})
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="library">
      <h1>My songs</h1>
      {error && <p className="notice error">{error}</p>}
      {rows === null && <p className="pulse">Loading…</p>}
      {rows?.length === 0 && (
        <div className="empty">
          <p>No saved songs yet.</p>
          <button type="button" className="primary" onClick={onCreate}>
            Make a song
          </button>
        </div>
      )}
      <ul className="songs">
        {rows?.map((row) => (
          <li key={row.id} className="song-card" data-testid="song-card">
            {row.photo_path && urls[row.photo_path] ? (
              <img src={urls[row.photo_path]} alt="" className="thumb" />
            ) : (
              <div className="thumb placeholder" aria-hidden="true">
                ♪
              </div>
            )}
            <div className="song-info">
              <h3>{row.title}</h3>
              <p className="hint">
                {new Date(row.created_at).toLocaleDateString()} · {keyLabel(row.spec)} · {tempoLabel(row.spec)} ·{' '}
                {instrumentLabel(row.spec)}
                {row.photo_path && ' · photo saved'}
              </p>
              <SongPlayer spec={row.spec} compact />
            </div>
            <button type="button" className="danger" onClick={() => remove(row)} disabled={busy} aria-label={`Delete ${row.title}`}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      {rows && rows.length > 0 && (
        <div className="danger-zone">
          <button type="button" className="danger" onClick={removeAll} disabled={busy}>
            Delete all my songs and photos
          </button>
        </div>
      )}
    </section>
  )
}
