import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { preloadFaceDetector } from './landmarks/index.ts'
import App from './ui/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fetch MediaPipe's model and wasm now, not when the user captures a photo.
preloadFaceDetector()
