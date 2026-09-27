# FaceSong
Face photo → deterministic song. All face analysis and composition run in the browser. A photo leaves the device only when the user ticks "Also save my photo" for that save (opt-in, off by default), and then only to their own private Supabase folder.

## Architecture (keep these layers separate)
- src/landmarks/  — MediaPipe wrapper only (browser). Outputs 478 landmarks in isotropic units (x·width, y·height, z·width) — features/ assumes 1 unit on x = 1 unit on y. Decode uploads with `decodeImage` (applies EXIF orientation). Every photo is re-detected on an upright copy (rotated by its eye roll), whatever the roll. Load MediaPipe only via `loadFaceDetector()` (dynamic import keeps it out of the main bundle); `preloadFaceDetector()` in src/main.tsx prefetches it at app start.
- src/features/   — PURE: landmarks → normalized feature vector (scale/rotation invariant ratios). No DOM.
- src/engine/     — PURE: features → SongSpec JSON (tempo, key, mode, instrument, chords, melody). Seeded PRNG, no Math.random.
- src/audio/      — Tone.js renderer: SongSpec → sound.
- src/cloud/      — Supabase (optional; off without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY): anonymous auth, `songs` table, private `face-photos` bucket. Lazy-loaded; never contacted until the user saves or opens My songs. Schema + RLS in supabase/migrations/.
- src/ui/         — React: create (camera/upload → song → play/WAV → save) and My songs. `pipeline.ts` wires landmarks → features → engine.

## Rules
- features/ and engine/ must run in Node and be fully unit-tested.
- Same input → identical SongSpec, always.
- Only DISCRETE_IDENTITY bins may be hashed into a seed.
- Geometry only; never use skin tone or color.
- Photos: upload ONLY with the per-save consent checkbox ticked (unticked by default, every time). Upload the re-encoded JPEG from `preparePhoto` (metadata/GPS stripped, ≤1024px), never the original file. Path `<user id>/<song id>.jpg`; bucket stays private; every user-data table/bucket needs owner-only RLS. Deleting a song deletes its photo; keep "Delete all my songs and photos" working. Enforced by tests/e2e/app.spec.ts.
- Identity features must not use face-contour landmarks (10, 234, 454, temple/cheek edges): they are MediaPipe's least stable points. Only the chin (152) and lower jaw line are allowed. Scale by outer eye-corner width (33 → 263).
- Only IDENTITY_FEATURES may determine melody or song identity: engine/ consumes `QuantizedIdentity` (from `quantizeIdentity`) and nothing else from features/. EXPRESSION_FEATURES are for display/debug only. Enforced by tests/features/identity.test.ts.
- The engine may only make discrete musical choices (seed hashing, key, mode, instrument, chord progression, motif, …) from DISCRETE_IDENTITY (`QuantizedIdentity.discrete`: noseLength, noseWidth, eyeSpacing, 3 bins each). CONTINUOUS_IDENTITY (`QuantizedIdentity.continuous`: faceAspect, jawAngle, symmetry, 0–1) is too noisy for bins: map it only to continuous parameters where a small change sounds like a small change (tempo within a range, swing, brightness, …), and never hash, threshold or round it into a choice.
- Melody: scale-locked, chord tones on strong beats, prefer stepwise motion, motif → repeat → variation.
- Test landmarks using JSON fixtures in tests/fixtures/, not live MediaPipe.

## Commands
- `npm run dev` / `npm run build` — first run scripts/fetch-mediapipe-assets.mjs, which downloads the SHA-256-pinned model to .cache/mediapipe/ (gitignored). The wasm (SIMD variant only) and model are `?url` imports in src/landmarks/detector.ts.
- `/debug` (dev only, debug/index.html) — run Face Landmarker on photos, inspect pose/features/bins, download landmark JSON (same shape as tests/fixtures/).
- `npm run build` — typecheck (`tsc -b`) + production build. `tsconfig.pure.json` checks features/ and engine/ with no DOM or Node types.
- `npm test` — Vitest (Node environment), single run; `npm run test:watch` for watch mode
- `npm run lint` — oxlint
- `npm run test:e2e` — Playwright with live MediaPipe and a network-level fake of Supabase (tests/e2e/helpers.ts; the e2e dev server always uses fake keys, never .env.local). Covers the app flow, what is/isn't uploaded, camera, rotation/EXIF stability (identity spread < 5%, discrete bins unchanged) and prefetch. Needs Chromium (`npx playwright install chromium`).
- Supabase setup: see README (run supabase/migrations/*.sql, enable anonymous sign-ins, put keys in .env.local).
