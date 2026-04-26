import { NextResponse } from "next/server";
import { ensureSettingsRow, getPrisma } from "@/lib/db";
import {
  collectPlaylistTrackUris,
  fetchTrackMeta,
  formatSpotifyClientError,
  getUserSpotifyApi,
  normalizeSpotifyPlaylistId,
  pickRandomUri,
  playPlaylistFromTrackUri,
  waitForPlayerDeviceVisible,
} from "@/lib/spotify";

type Body = {
  deviceId?: string;
};

/**
 * Transfers playback to the Web Playback SDK device and starts a random track
 * from the configured playlist (PRD: initialize with random playlist track).
 */
export async function POST(request: Request) {
  try {
    await ensureSettingsRow();
    const body = (await request.json()) as Body;
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const playlistRaw = settings?.spotifyPlaylistId ?? null;
    const playlistId = normalizeSpotifyPlaylistId(playlistRaw);
    if (!playlistId) {
      return NextResponse.json(
        { error: "Set a Spotify playlist ID in settings first" },
        { status: 400 },
      );
    }

    const api = await getUserSpotifyApi();
    if (!api) {
      return NextResponse.json({ error: "Not connected to Spotify" }, { status: 401 });
    }

    await waitForPlayerDeviceVisible(api, deviceId);

    const uris = await collectPlaylistTrackUris(api, playlistId);
    const uri = pickRandomUri(uris);
    if (!uri) {
      return NextResponse.json(
        { error: "No playable tracks found in that playlist" },
        { status: 400 },
      );
    }

    await api.player.transferPlayback([deviceId], false);
    // Brief pause: Spotify often needs a moment after transfer before play accepts the web device.
    await new Promise((r) => setTimeout(r, 450));
    await playPlaylistFromTrackUri(api, deviceId, playlistId, uri);

    const track = await fetchTrackMeta(api, uri);
    return NextResponse.json({
      track: { uri, name: track.name, artists: track.artists },
    });
  } catch (e) {
    const message = formatSpotifyClientError(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
