# Tasks: Personal Radio Station Simulator

Derived from [PRD.md](./PRD.md). Use checkboxes to track progress.

---

## Phase 0 — Project foundation

- [x] Scaffold Next.js (App Router) project in repo root (align folder names with PRD or document mapping, e.g. `src/app`).
- [x] Add dependencies: Spotify Web API client usage, playback SDK as needed, SQLite (`better-sqlite3` or `libsql`), optional Prisma if using `prisma/schema.prisma`.
- [x] Configure environment variables for Spotify (client ID, redirect URI, etc.) and document required values (without committing secrets).
- [x] Add `public/audio/` and placeholder or README for Station ID MP3 assets (target ~10 files per PRD).
- [x] Prepare Vercel project settings (build, env vars, SQLite persistence constraints — e.g. serverless vs persistent DB if applicable).

---

## Phase 1 — Database & persistence

- [x] Implement SQLite layer (`src/lib/db.ts` or Prisma): **Settings** table — `id`, `spotify_playlist_id`, `current_song_count`, `last_auth_token` (store tokens securely; consider encryption or httpOnly patterns per your threat model).
- [x] Implement **StationIDs** table — `id`, `file_name`, `file_path`, `play_count`.
- [x] Migration / bootstrap: create tables on first run; seed or sync Station ID rows from files in `public/audio` (or configured path).
- [x] API routes or server actions to read/update playlist ID, song count, and station ID metadata.

---

## Phase 2 — Spotify integration

- [x] Implement `src/lib/spotify.ts`: OAuth flow, token refresh, wrappers for playlist fetch, queue/play, and device selection as needed.
- [x] Persist auth tokens in **Settings** (or session) per PRD; handle expiry and re-auth in UI (Settings: connection status).
- [x] On initialize: after auth, queue a **random** track from the configured playlist.
- [x] Wire Web Playback SDK (or equivalent) for controllable playback in the browser/PWA context.

---

## Phase 3 — Radio engine (5–6 song loop + Station IDs)

- [x] Implement `src/hooks/useRadio.ts` (or equivalent): internal counter for Spotify tracks completed in the current “block.”
- [x] Randomize block length each cycle: **5 or 6** songs before a Station ID (per PRD).
- [x] On threshold: pause/mute Spotify; play a **random** Station ID from local pool (`/public/audio`); on `ended`, resume Spotify with a **new random** playlist track.
- [x] Integrate logic in `src/components/Player.tsx`: orchestrate Spotify vs local HTML5 audio (or chosen approach); avoid overlapping audio.
- [x] Update `current_song_count` (and optionally `play_count` on StationIDs) in the database for continuity across reloads if required by product decisions.

---

## Phase 4 — Main dashboard UI

- [x] Build `src/components/RadioFace.tsx`: retro / skeuomorphic radio aesthetic (dials, analog-style typography).
- [x] **Power** toggle: off = idle/stop simulation; on = start/resume broadcast loop per user flow.
- [x] **Volume** slider: map to Spotify volume and/or local ID playback volume consistently.
- [x] **Skip** button: advance current source (Spotify skip or skip ID) without breaking counter rules — define behavior and implement.
- [x] **Now Playing**: show current track title and artist (Spotify); sensible state during Station ID playback.
- [x] **Mixer** icon: opens settings overlay.

---

## Phase 5 — Settings (Mixer) overlay

- [x] Build `src/components/Mixer.tsx`: overlay with playlist ID field; save to **Settings**.
- [x] Station ID **management** view: list files, paths, optional play counts; align with **StationIDs** table and `public/audio`.
- [x] Display Spotify **account connection** status; link or button to connect/disconnect or re-authenticate.

---

## Phase 6 — PWA & Android

- [x] Add PWA manifest, icons, and service worker (Next.js PWA plugin or manual) per “optimized for PWA on Android.”
- [x] Test installability, background behavior limits, and autoplay/user-gesture constraints on mobile browsers.
- [x] Verify touch targets and layout on small screens for dashboard and Mixer.

---

## Phase 7 — Ship

- [ ] End-to-end test: launch → auth → power on → full cycle through at least one Station ID injection → skip → mixer edits → reload persistence.
- [ ] Deploy to Vercel; confirm env vars and any SQLite hosting limitations are resolved.
- [ ] Document operator setup: Spotify app settings, redirect URIs, and where to drop Station ID MP3s.

---

## Reference: PRD file layout

The PRD suggests these artifacts — ensure they exist and match implementation:

| Path | Purpose |
| :--- | :--- |
| `src/app/layout.tsx`, `src/app/page.tsx` | Shell and main dashboard route |
| `src/components/RadioFace.tsx` | Retro UI |
| `src/components/Mixer.tsx` | Settings overlay |
| `src/components/Player.tsx` | Spotify / local switching |
| `src/lib/spotify.ts` | API wrappers |
| `src/lib/db.ts` | SQLite |
| `src/hooks/useRadio.ts` | 5–6 song logic |
| `public/audio/` | Station ID MP3s |
| `prisma/schema.prisma` | Optional ORM schema |
