import { NextResponse } from "next/server";
import { ensureSettingsRow } from "@/lib/db";
import { formatSpotifyClientError, getUserSpotifyApi } from "@/lib/spotify";

type Body = { deviceId?: string };

/** Pauses Spotify on the Web Playback device (complements SDK pause during station IDs). */
export async function POST(request: Request) {
  try {
    await ensureSettingsRow();
    const body = (await request.json()) as Body;
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    }

    const api = await getUserSpotifyApi();
    if (!api) {
      return NextResponse.json({ error: "Not connected to Spotify" }, { status: 401 });
    }

    await api.player.pausePlayback(deviceId);
    return NextResponse.json({ ok: true as const });
  } catch (e) {
    const message = formatSpotifyClientError(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
