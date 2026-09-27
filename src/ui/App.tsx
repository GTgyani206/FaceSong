import { useEffect, useState } from 'react'
import CreateSong from './CreateSong.tsx'
import Library from './Library.tsx'
import './app.css'

type View = 'create' | 'library'
const viewFromHash = (): View => (location.hash === '#library' ? 'library' : 'create')

export default function App() {
  const [view, setView] = useState<View>(viewFromHash)

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const go = (v: View) => {
    location.hash = v === 'library' ? '#library' : ''
    setView(v)
  }

  return (
    <div className="app">
      <header className="top">
        <button type="button" className="brand" onClick={() => go('create')}>
          <span className="logo" aria-hidden="true">
            ◐♪
          </span>
          FaceSong
        </button>
        <nav>
          <button type="button" className={view === 'create' ? 'active' : ''} onClick={() => go('create')}>
            Make a song
          </button>
          <button type="button" className={view === 'library' ? 'active' : ''} onClick={() => go('library')}>
            My songs
          </button>
        </nav>
      </header>
      <main>{view === 'create' ? <CreateSong onOpenLibrary={() => go('library')} /> : <Library onCreate={() => go('create')} />}</main>
      <footer>
        Faces are analysed in your browser. Photos are stored only when you tick “Also save my photo”, and you can delete them
        at any time.
      </footer>
    </div>
  )
}
