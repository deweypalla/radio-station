import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import type { AccessToken, Track } from "@spotify/web-api-ts-sdk";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const SPOTIFY_AUTH_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-modify-playback-state",
] as const;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v.trim();
}

export function getSpotifyClientId(): string {
  return requireEnv("SPOTIFY_CLIENT_ID");
}

export function getSpotifyClientSecret(): string {
  return requireEnv("SPOTIFY_CLIENT_SECRET");
}

const CALLBACK_PATH = "/api/auth/callback/spotify";

function stripTrailingSlash(uri: string): string {
  return uri.replace(/\/+$/, "");
}

function originFromForwardedHeaders(request: Request): string | null {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (!forwardedHost?.trim() || !forwardedProto?.trim()) return null;
  const host = forwardedHost.split(",")[0]?.trim();
  const proto = forwardedProto.split(",")[0]?.trim();
  if (!host || !proto) return null;
  return `${proto}://${host}`;
}

function isLoopbackHost(host: string): boolean {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    h === "localhost" ||
    h === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(h)
  );
}

/** Spotify allows one redirect URI per line; align dev with `next dev --hostname 127.0.0.1`. */
function normalizeLoopbackOriginForSpotify(origin: string): string {
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    const isLo = h === "localhost" || h === "127.0.0.1" || h === "::1";
    if (isLo) {
      u.hostname = "127.0.0.1";
      return u.origin;
    }
    return origin;
  } catch {
    return origin;
  }
}

/**
 * Public origin the browser uses (must match a Spotify "Redirect URI" host).
 * Prefer proxy headers so tunnels (ngrok, Cloudflare) match the dashboard.
 */
export function getPublicRequestOrigin(request: Request): string {
  const forwarded = originFromForwardedHeaders(request);
  if (forwarded) return forwarded;

  const nextUrl: URL | undefined =
    "nextUrl" in request ? (request as NextRequest).nextUrl : undefined;
  if (nextUrl?.origin && nextUrl.origin !== "null") return nextUrl.origin;

  try {
    const origin = new URL(request.url).origin;
    if (origin && origin !== "null") return origin;
  } catch {
    /* ignore */
  }

  const host = request.headers.get("host")?.trim();
  if (!host) {
    throw new Error(
      "Cannot determine public URL for Spotify OAuth. Set SPOTIFY_REDIRECT_URI in .env.",
    );
  }
  const protoHeader = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = protoHeader ?? (isLoopbackHost(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * OAuth redirect URI must match the Spotify app settings exactly (character for character).
 * Built from {@link getPublicRequestOrigin} + callback path unless `SPOTIFY_REDIRECT_URI` is set.
 */
export function getSpotifyRedirectUri(request: Request): string {
  const override = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (override) return stripTrailingSlash(override);
  const origin = normalizeLoopbackOriginForSpotify(getPublicRequestOrigin(request));
  return stripTrailingSlash(`${origin}${CALLBACK_PATH}`);
}

/** HttpOnly cookie: exact `redirect_uri` from OAuth start (token exchange must match). */
export const SPOTIFY_OAUTH_REDIRECT_COOKIE = "spotify_oauth_redirect_uri";

export function isSpotifyOAuthRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path === CALLBACK_PATH;
  } catch {
    return false;
  }
}

/** Prefer cookie from `/api/auth/spotify` so token exchange uses the same URI as authorize. */
export function resolveSpotifyRedirectUriForCallback(
  request: Request,
  storedFromCookie: string | undefined,
): string {
  const trimmed = storedFromCookie?.trim();
  if (trimmed && isSpotifyOAuthRedirectUri(trimmed)) return stripTrailingSlash(trimmed);
  return getSpotifyRedirectUri(request);
}

export function buildSpotifyAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getSpotifyClientId(),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: [...SPOTIFY_AUTH_SCOPES].join(" "),
    state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

type TokenEndpointResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

async function postToken(body: URLSearchParams): Promise<TokenEndpointResponse> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${getSpotifyClientId()}:${getSpotifyClientSecret()}`).toString("base64")}`,
    },
    body,
  });
  const json = (await res.json()) as TokenEndpointResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? `Spotify token error (${res.status})`);
  }
  return json;
}

export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<TokenEndpointResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  return postToken(body);
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenEndpointResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return postToken(body);
}

/** HttpOnly cookies for Spotify user OAuth (not stored in radio-config.json). */
const SPOTIFY_COOKIE_RT = "spotify_user_rt";
const SPOTIFY_COOKIE_AT = "spotify_user_at";
const SPOTIFY_COOKIE_EXP = "spotify_user_exp";

function spotifyAuthCookieBase() {
  return {
    httpOnly: true as const,
    path: "/" as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function hasSpotifyUserAuth(): Promise<boolean> {
  const store = await cookies();
  return Boolean(store.get(SPOTIFY_COOKIE_RT)?.value?.trim());
}

export function setSpotifyAuthCookiesOnResponse(
  res: NextResponse,
  tokens: TokenEndpointResponse,
): void {
  const base = spotifyAuthCookieBase();
  const refresh = tokens.refresh_token?.trim();
  if (!refresh) {
    throw new Error("Spotify did not return a refresh token; reconnect from the Mixer.");
  }
  const expMs = Date.now() + tokens.expires_in * 1000;
  res.cookies.set(SPOTIFY_COOKIE_RT, refresh, { ...base, maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set(SPOTIFY_COOKIE_AT, tokens.access_token, { ...base, maxAge: tokens.expires_in });
  res.cookies.set(SPOTIFY_COOKIE_EXP, String(expMs), { ...base, maxAge: tokens.expires_in });
}

async function writeSpotifyAuthCookies(
  tokens: TokenEndpointResponse,
  fallbackRefreshToken: string,
): Promise<void> {
  const store = await cookies();
  const base = spotifyAuthCookieBase();
  const refresh = tokens.refresh_token?.trim() || fallbackRefreshToken;
  const expMs = Date.now() + tokens.expires_in * 1000;
  store.set(SPOTIFY_COOKIE_RT, refresh, { ...base, maxAge: 60 * 60 * 24 * 365 });
  store.set(SPOTIFY_COOKIE_AT, tokens.access_token, { ...base, maxAge: tokens.expires_in });
  store.set(SPOTIFY_COOKIE_EXP, String(expMs), { ...base, maxAge: tokens.expires_in });
}

export async function clearSpotifyAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete({ name: SPOTIFY_COOKIE_RT, path: "/" });
  store.delete({ name: SPOTIFY_COOKIE_AT, path: "/" });
  store.delete({ name: SPOTIFY_COOKIE_EXP, path: "/" });
}

/** Accepts raw ID, Spotify URI, or open.spotify.com playlist URL. */
export function normalizeSpotifyPlaylistId(input: string | null | undefined): string | null {
  if (input == null) return null;
  const t = input.trim();
  if (!t) return null;
  const urlMatch = t.match(/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  const uriMatch = t.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  if (/^[a-zA-Z0-9]+$/.test(t)) return t;
  return t;
}

const ACCESS_REFRESH_BUFFER_MS = 60_000;

export type SpotifyAccessState = {
  accessToken: string;
  expiresAtMs: number;
  refreshToken: string;
};

/**
 * Returns a valid user access token (Web Playback / user Web API), refreshing with
 * `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` when needed. Tokens live in httpOnly cookies only.
 */
export async function getSpotifyAccessState(): Promise<SpotifyAccessState | null> {
  const store = await cookies();
  const refreshToken = store.get(SPOTIFY_COOKIE_RT)?.value?.trim() ?? "";
  if (!refreshToken) return null;

  let accessToken = store.get(SPOTIFY_COOKIE_AT)?.value ?? "";
  let expiresAtMs = Number(store.get(SPOTIFY_COOKIE_EXP)?.value ?? 0);

  if (
    !accessToken ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= Date.now() + ACCESS_REFRESH_BUFFER_MS
  ) {
    const refreshed = await refreshAccessToken(refreshToken);
    await writeSpotifyAuthCookies(refreshed, refreshToken);
    accessToken = refreshed.access_token;
    expiresAtMs = Date.now() + refreshed.expires_in * 1000;
    const newRt = refreshed.refresh_token?.trim() || refreshToken;
    return { accessToken, expiresAtMs, refreshToken: newRt };
  }

  return { accessToken, expiresAtMs, refreshToken };
}

export async function getUserSpotifyApi(): Promise<SpotifyApi | null> {
  const state = await getSpotifyAccessState();
  if (!state) return null;

  const token: AccessToken = {
    access_token: state.accessToken,
    token_type: "Bearer",
    expires_in: Math.max(60, Math.floor((state.expiresAtMs - Date.now()) / 1000)),
    refresh_token: state.refreshToken,
    expires: state.expiresAtMs,
  };

  return SpotifyApi.withAccessToken(getSpotifyClientId(), token);
}

const SPOTIFY_SDK_403_PREFIX =
  "Bad OAuth request (wrong consumer key, bad nonce, expired timestamp...). Unfortunately, re-authenticating the user won't help here. Body: ";

/**
 * The TS SDK maps every HTTP 403 to a generic "Bad OAuth request…" string; the real reason is JSON in the suffix.
 */
export function formatSpotifyClientError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  const m = error.message;
  if (m.startsWith(SPOTIFY_SDK_403_PREFIX)) {
    const raw = m.slice(SPOTIFY_SDK_403_PREFIX.length).trim();
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: string; reason?: string };
      };
      const inner = parsed.error?.message ?? parsed.error?.reason;
      if (inner) return inner;
    } catch {
      /* ignore */
    }
    return raw || m;
  }
  return m;
}

/**
 * After the Web Playback SDK fires "ready", Spotify’s device list can lag briefly; transfer/play may 403 until then.
 */
export async function waitForPlayerDeviceVisible(
  api: SpotifyApi,
  deviceId: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 12_000;
  const intervalMs = options?.intervalMs ?? 350;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { devices } = await api.player.getAvailableDevices();
    if (devices?.some((d) => d.id === deviceId)) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    "Spotify has not registered this browser player yet. Wait a few seconds, toggle the radio power off and on, or use Re-authorize in the Mixer.",
  );
}

export async function collectPlaylistTrackUris(api: SpotifyApi, playlistId: string): Promise<string[]> {
  const uris: string[] = [];
  let offset = 0;
  const limit = 50 as const;
  for (;;) {
    const page = await api.playlists.getPlaylistItems(playlistId, undefined, undefined, limit, offset);
    for (const item of page.items) {
      const tr = item.track;
      if (tr && tr.type === "track" && "uri" in tr && tr.uri?.startsWith("spotify:track:")) {
        const track = tr as Track;
        if (!track.is_local) uris.push(track.uri);
      }
    }
    if (!page.next) break;
    offset += limit;
  }
  return uris;
}

export function pickRandomUri(uris: string[]): string | null {
  if (uris.length === 0) return null;
  const i = Math.floor(Math.random() * uris.length);
  return uris[i] ?? null;
}

export function toPlaylistContextUri(playlistId: string): string {
  return `spotify:playlist:${playlistId}`;
}

/**
 * Start playlist playback at a specific track. Using `context_uri` (not a lone `uris` array)
 * loads the full list in Web Playback so skip/next and resume work ("no list was loaded" otherwise).
 */
export async function playPlaylistFromTrackUri(
  api: SpotifyApi,
  deviceId: string,
  playlistId: string,
  trackUri: string,
): Promise<void> {
  await api.player.startResumePlayback(deviceId, toPlaylistContextUri(playlistId), undefined, {
    uri: trackUri,
  });
}

export async function fetchTrackMeta(api: SpotifyApi, uri: string): Promise<{ name: string; artists: string }> {
  const id = uri.replace("spotify:track:", "");
  const track = await api.tracks.get(id);
  const artists = track.artists.map((a) => a.name).join(", ");
  return { name: track.name, artists };
}
