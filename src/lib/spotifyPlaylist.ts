/**
 * Crossover Classics — default Spotify playlist unless the user saves another in Mixer.
 */
export const DEFAULT_CROSSOVER_PLAYLIST_WEB_URL =
  "https://open.spotify.com/playlist/3c6kfSkFGqN1ebBkTw8fxD?si=brjQDNTkTDSp-cDyqjw9IA&pi=X8m2gEMxSW2Kg";

/** Canonical ID derived from {@link DEFAULT_CROSSOVER_PLAYLIST_WEB_URL}. */
export const DEFAULT_SPOTIFY_PLAYLIST_ID = "3c6kfSkFGqN1ebBkTw8fxD";

/** Accepts raw ID, Spotify URI, or open.spotify.com playlist URL. */
export function normalizeSpotifyPlaylistId(input: string | null | undefined): string | null {
  if (input == null) return null;
  const t = input.trim();
  if (!t) return null;
  const urlMatch = t.match(/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1]!;
  const uriMatch = t.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1]!;
  if (/^[a-zA-Z0-9]+$/.test(t)) return t;
  return t;
}

export function resolvedSpotifyPlaylistId(stored: string | null | undefined): string {
  const n = normalizeSpotifyPlaylistId(stored);
  return n ?? DEFAULT_SPOTIFY_PLAYLIST_ID;
}
