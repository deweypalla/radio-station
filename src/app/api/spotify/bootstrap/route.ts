import { NextResponse } from "next/server";
import { ensureSettingsRow, getSettings } from "@/lib/db";
import {
  collectPlaylistTrackUris,
  fetchTrackMeta,
  formatSpotifyClientError,
  getUserSpotifyApi,
  pickRandomUri,
  playPlaylistFromTrackUri,
  resolvedSpotifyPlaylistId,
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

    const settings = await getSettings();
    const playlistId = resolvedSpotifyPlaylistId(settings.spotifyPlaylistId);

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
