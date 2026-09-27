import { useState } from 'react'
import { cloudConfig, preparePhoto, saveSong } from '../cloud/index.ts'
import type { SongSpec } from '../engine/index.ts'
import type { QuantizedIdentity } from '../features/index.ts'

/**
 * Save to "My songs". The photo is uploaded ONLY if the consent box is ticked
 * for this save; it is unticked every time.
 */
export default function SavePanel({
  spec,
  identity,
  photo,
  onSaved,
}: {
  spec: SongSpec
  identity: QuantizedIdentity
  photo: ImageBitmap
  onSaved: () => void
}) {
  const [withPhoto, setWithPhoto] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | { error: string }>('idle')

  if (!cloudConfig) {
    return (
      <div className="save">
        <p className="hint">Saving songs needs a Supabase project. Add its keys to <code>.env.local</code> (see README).</p>
      </div>
    )
  }
  const config = cloudConfig

  const save = async () => {
    setState('saving')
    try {
      await saveSong(config, { spec, identity, photo: withPhoto ? await preparePhoto(photo) : undefined })
      setState('saved')
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) })
    }
  }

  if (state === 'saved') {
    return (
      <div className="save">
        <p className="notice ok">
          Saved{withPhoto ? ' with your photo' : ''}.{' '}
          <button type="button" className="link" onClick={onSaved}>
            Open My songs
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="save">
      <label className="consent">
        <input
          type="checkbox"
          checked={withPhoto}
          onChange={(e) => setWithPhoto(e.target.checked)}
          disabled={state === 'saving'}
          data-testid="photo-consent"
        />
        <span>
          <strong>Also save my photo</strong> (optional)
          <small>
            Your photo is uploaded to FaceSong's private cloud storage, visible only to you in this browser. Location and
            other metadata are removed first. You can delete it any time in My songs. Without this, only the song is saved.
          </small>
        </span>
      </label>
      <button type="button" className="primary" onClick={save} disabled={state === 'saving'} data-testid="save">
        {state === 'saving' ? 'Saving…' : withPhoto ? 'Save song and photo' : 'Save song'}
      </button>
      {typeof state === 'object' && <p className="notice error">{state.error}</p>}
    </div>
  )
}
