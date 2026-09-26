import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DebugPage from './DebugPage.tsx'
import './debug.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DebugPage />
  </StrictMode>,
)
