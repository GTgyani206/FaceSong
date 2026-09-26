# FaceSong
Face photo → deterministic song. Fully client-side; photos never leave the device.

## Architecture (keep these layers separate)
- src/landmarks/  — MediaPipe wrapper only (browser). Outputs 478 landmarks in isotropic units (x·width, y·height, z·width) — features/ assumes 1 unit on x = 1 unit on y.
- src/features/   — PURE: landmarks → normalized feature vector (scale/rotation invariant ratios). No DOM.
- src/engine/     — PURE: features → SongSpec JSON (tempo, key, mode, instrument, chords, melody). Seeded PRNG, no Math.random.
- src/audio/      — Tone.js renderer: SongSpec → sound.
- src/ui/         — React.

## Rules
- features/ and engine/ must run in Node and be fully unit-tested.
- Same input → identical SongSpec, always.
- Quantize features into bins before hashing to a seed.
- Geometry only; never use skin tone or color.
- Melody: scale-locked, chord tones on strong beats, prefer stepwise motion, motif → repeat → variation.
- Test landmarks using JSON fixtures in tests/fixtures/, not live MediaPipe.

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — typecheck (`tsc -b`) + production build. `tsconfig.pure.json` checks features/ and engine/ with no DOM or Node types.
- `npm test` — Vitest (Node environment), single run; `npm run test:watch` for watch mode
- `npm run lint` — oxlint
