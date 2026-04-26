# PRD: Personal Radio Station Simulator

## 1. Problem Statement
The user wants to recreate the specific listening experience and "vibe" of a defunct favorite radio station that modern algorithmic streaming services (like standard Spotify shuffle) cannot replicate.

## 2. Executive Summary
**I am building a radio station simulation that plays random songs from a specific Spotify playlist and, after every five or six songs, injects a random station ID track from a local pool before resuming playback.**

## 3. Target User
* **Primary User:** The creator (personal nostalgia project).
* **Platform:** Web App (Optimized for PWA usage on Android).

## 4. Core Features
* **Spotify Integration:** Authentication and playback control via Spotify Web API.
* **Smart Shuffling Logic:** Track counter that triggers a local "Station ID" interruption every 5–6 songs.
* **Station ID Pool:** Support for 10 local MP3 files to be played randomly between music blocks.
* **Playback Controls:** "On/Off" toggle (to start the simulation), "Now Playing" display, and a "Skip" button.
* **Persistent Settings:** Store the target Playlist ID and Spotify Auth tokens.

## 5. User Flow
1. **Launch:** User opens the Web App.
2. **Initialize:** App authenticates with Spotify; random track from the pre-set playlist is queued.
3. **Power On:** User hits the "On" button.
4. **Broadcast Loop:**
    * Music plays from the Spotify playlist.
    * Internal counter tracks songs played.
    * Upon reaching the limit (5 or 6 songs), the Spotify player pauses/mutes.
    * A random Station ID MP3 plays from the local library.
    * Once the ID ends, Spotify playback resumes with a new random song.
5. **Adjust:** User can click the "Mixer" icon to change the Playlist ID or manage the ID library.

## 6. Screens & UI
### Main Dashboard
* **Aesthetic:** Retro/Old-style radio interface (skeuomorphic dials, analog-style text).
* **Controls:** Large Power toggle, Volume slider, Skip button.
* **Display:** "Now Playing" track title and artist.
* **Navigation:** A "Mixer" icon in the corner to access settings.

### Settings Overlay
* Input field for Spotify Playlist ID.
* Management view for Station ID tracks.
* Spotify Account connection status.

## 7. Data Model (SQLite)
| Table | Fields |
| :--- | :--- |
| **Settings** | `id`, `spotify_playlist_id`, `current_song_count`, `last_auth_token` |
| **StationIDs** | `id`, `file_name`, `file_path`, `play_count` |

## 8. Tech Stack
* **Framework:** Next.js (App Router).
* **Database:** SQLite (via `better-sqlite3` or `libsql`).
* **Deployment:** Vercel.
* **Music Source:** Spotify Web API (SDK for playback).
* **Assets:** Local `/public/audio` folder for static MP3 Station IDs.

## 9. File Structure
```text
/radio-sim
├── /public
│   └── /audio           # 10 Station ID MP3 files
├── /src
│   ├── /app
│   │   ├── layout.tsx
│   │   └── page.tsx      # Main Dashboard
│   ├── /components
│   │   ├── RadioFace.tsx # Retro UI
│   │   ├── Mixer.tsx     # Settings Overlay
│   │   └── Player.tsx    # Logic for Spotify/Local switching
│   ├── /lib
│   │   ├── spotify.ts    # API wrappers
│   │   └── db.ts         # SQLite config
│   └── /hooks
│       └── useRadio.ts   # Custom hook for the 5-song logic
└── prisma/schema.prisma  # Database schema (if using Prisma)