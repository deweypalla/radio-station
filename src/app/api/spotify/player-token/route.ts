import { NextResponse } from "next/server";
import { getSpotifyAccessState } from "@/lib/spotify";

/** Returns a short-lived access token for the Web Playback SDK (browser). */
export async function GET() {
  try {
    const state = await getSpotifyAccessState();
    if (!state) {
      return NextResponse.json({ error: "Not connected to Spotify" }, { status: 401 });
    }
    return NextResponse.json({
      accessToken: state.accessToken,
      expiresAtMs: state.expiresAtMs,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
