# FaceSong

**Your face, as a song.** FaceSong reads the geometry of a face — nose, eye spacing, jaw line — and composes a short,
deterministic piece of music from it. The same face always gets the same song.

Face analysis ([MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)) and
composition happen entirely in the browser. Saving is optional and uses [Supabase](https://supabase.com): the song is
stored, and the **photo only if the user ticks "Also save my photo"** for that save.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173 — downloads the pinned face model on first run
```

Without Supabase keys everything works except saving and "My songs".

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run [`supabase/migrations/20260927000000_facesong.sql`](supabase/migrations/20260927000000_facesong.sql).
   It creates the `songs` table and the private `face-photos` bucket, with row-level security so each user can only
   see and delete their own songs and photos.
3. **Authentication → Sign In / Providers** → enable **Allow anonymous sign-ins**. Users get a private, per-browser
   account the first time they save; no sign-up form.
4. Copy `.env.example` to `.env.local` and fill in **Project Settings → API**: the project URL and the `anon` public key.
   (The anon key is meant to be public; RLS is what protects the data. Never put the `service_role` key in the app.)
5. Restart `npm run dev`.

### What gets stored

| When | Stored |
|---|---|
| Making a song | Nothing. No request is made to Supabase. |
| **Save song** | The song (title, key, notes, …) and the identity values it came from. |
| **Save song and photo** (box ticked) | The above, plus the photo: re-encoded JPEG ≤ 1024 px with all metadata (incl. GPS) removed, in `face-photos/<user id>/`. |
| **Delete** / **Delete all my songs and photos** | Removes the photos from storage and the rows from the table. |

Face photos are biometric data in many jurisdictions (e.g. GDPR, Illinois BIPA). Before a public launch, add a privacy
policy and a retention period, and consider a scheduled job that removes data of anonymous users who never return.

## How a face becomes a song

`src/landmarks` (MediaPipe, upright normalization) → `src/features` (scale/rotation-invariant geometry, split into
identity and expression) → `src/engine` (seeded composition) → `src/audio` (Tone.js). See [CLAUDE.md](CLAUDE.md) for the
rules each layer follows.

- **Discrete choices** (key, mode, instrument, rhythm, chords, melody) come only from three stable features —
  nose length, nose width, eye spacing — each in 3 bins.
- **Continuous values** (face aspect, jaw angle, symmetry) set tempo, swing and brightness smoothly.
- Melody: scale-locked, chord tones on strong beats, mostly stepwise, motif → repeat → variation → cadence.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server. `/debug` is a developer page for inspecting landmarks and features. |
| `npm run build` | Typecheck and production build. |
| `npm test` | Unit tests (Vitest, Node). |
| `npm run test:e2e` | Browser tests (Playwright, live MediaPipe, fake Supabase). Needs `npx playwright install chromium`. |
| `npm run lint` | oxlint. |
