"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  DEFAULT_CROSSOVER_PLAYLIST_WEB_URL,
  DEFAULT_SPOTIFY_PLAYLIST_ID,
} from "@/lib/spotifyPlaylist";
import { readResponseJson } from "@/lib/jsonResponse";

function openSpotifyOAuth(e: ReactMouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  window.location.assign("/api/auth/spotify");
}

type SettingsPayload = {
  spotifyPlaylistId: string | null;
  currentSongCount: number;
  stationBreakTarget: number | null;
  hasAuthToken: boolean;
};

type StationRow = {
  id: number;
  fileName: string;
  filePath: string;
  playCount: number;
};

type MixerProps = {
  open: boolean;
  onClose: () => void;
  settings: SettingsPayload | null;
  playlistDraft: string;
  onPlaylistDraftChange: (v: string) => void;
  onSavePlaylist: (e: FormEvent) => void | Promise<void>;
  savingPlaylist: boolean;
  onDisconnect: () => void | Promise<void>;
  onRefreshSettings: () => void;
};

export function Mixer({
  open,
  onClose,
  settings,
  playlistDraft,
  onPlaylistDraftChange,
  onSavePlaylist,
  savingPlaylist,
  onDisconnect,
  onRefreshSettings,
}: MixerProps) {
  const [stationItems, setStationItems] = useState<StationRow[]>([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationError, setStationError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadStations = useCallback(async () => {
    setStationLoading(true);
    setStationError(null);
    try {
      const res = await fetch("/api/station-ids");
      const data = (await readResponseJson(res)) as { items?: StationRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load station IDs");
      setStationItems(data.items ?? []);
    } catch (e) {
      setStationError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setStationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadStations();
  }, [open, loadStations]);

  async function onSync() {
    setSyncing(true);
    setStationError(null);
    try {
      const res = await fetch("/api/station-ids/sync", { method: "POST" });
      const data = (await readResponseJson(res)) as { items?: StationRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setStationItems(data.items ?? []);
    } catch (e) {
      setStationError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mixer-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[min(90vh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-5 py-4 backdrop-blur">
          <h2 id="mixer-title" className="text-lg font-semibold tracking-tight">
            Mixer
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-full px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 p-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Spotify
            </h3>
            {settings?.hasAuthToken ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-emerald-400">Connected</span>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={openSpotifyOAuth}
                  className="text-sm text-amber-400 underline hover:text-amber-300"
                >
                  Re-authorize
                </button>
                <button
                  type="button"
                  onClick={() => void onDisconnect()}
                  className="min-h-11 rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={openSpotifyOAuth}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1DB954] px-5 py-2 text-sm font-medium text-black hover:opacity-90"
              >
                Connect with Spotify
              </button>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Playlist
            </h3>
            <form onSubmit={(e) => void onSavePlaylist(e)} className="flex flex-col gap-2">
              <input
                value={playlistDraft}
                onChange={(e) => onPlaylistDraftChange(e.target.value)}
                placeholder="Playlist ID or URL"
                disabled={!settings?.hasAuthToken}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={!settings?.hasAuthToken || savingPlaylist}
                  className="min-h-11 rounded-full bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
                >
                  {savingPlaylist ? "Saving…" : "Save playlist"}
                </button>
                {settings?.spotifyPlaylistId ? (
                  <span className="self-center text-xs text-zinc-500">
                    Saved: {settings.spotifyPlaylistId}
                  </span>
                ) : settings?.hasAuthToken ? (
                  <span className="self-center text-xs text-zinc-500">
                    Default: Crossover Classics (
                    <a
                      href={DEFAULT_CROSSOVER_PLAYLIST_WEB_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-zinc-300"
                    >
                      {DEFAULT_SPOTIFY_PLAYLIST_ID}
                    </a>
                    )
                  </span>
                ) : null}
              </div>
            </form>
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Station IDs
              </h3>
              <button
                type="button"
                onClick={() => void onSync()}
                disabled={syncing}
                className="min-h-11 rounded-lg border border-zinc-600 px-4 py-2 text-xs hover:bg-zinc-800 disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync from disk"}
              </button>
            </div>
            {stationError ? (
              <p className="text-sm text-red-400">{stationError}</p>
            ) : stationLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : stationItems.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No audio files in <code className="text-zinc-400">public/audio</code>. Add MP3
                (etc.) and tap Sync.
              </p>
            ) : (
              <ul className="max-h-48 overflow-y-auto rounded-lg border border-zinc-800 text-sm">
                {stationItems.map((row) => (
                  <li
                    key={row.id}
                    className="flex justify-between gap-2 border-b border-zinc-800/80 px-3 py-2 last:border-0"
                  >
                    <span className="truncate text-zinc-200">{row.fileName}</span>
                    <span className="shrink-0 text-zinc-500">plays {row.playCount}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button
            type="button"
            onClick={() => {
              onRefreshSettings();
              void loadStations();
            }}
            className="min-h-12 w-full rounded-lg border border-zinc-700 py-3 text-sm text-zinc-400 hover:bg-zinc-800"
          >
            Refresh data
          </button>
        </div>
      </div>
    </div>
  );
}
