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
} from "@/lib/spotify";

type Body = {
  deviceId?: string;
};

/** Starts a random track from the configured playlist on the given device (no transfer). */
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

    const uris = await collectPlaylistTrackUris(api, playlistId);
    const uri = pickRandomUri(uris);
    if (!uri) {
      return NextResponse.json(
        { error: "No playable tracks found in that playlist" },
        { status: 400 },
      );
    }

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
