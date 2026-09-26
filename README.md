# FaceSong

Face photo → deterministic song. Fully client-side; photos never leave the device.

Built with Vite + React + TypeScript, [MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) for face landmarks, and [Tone.js](https://tonejs.github.io/) for audio.

```sh
npm install
npm run dev     # dev server
npm test        # unit tests (Vitest)
npm run build   # typecheck + build
```

See [CLAUDE.md](./CLAUDE.md) for architecture and rules.
