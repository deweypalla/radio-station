import { NextResponse } from "next/server";
import { ensureSettingsRow } from "@/lib/db";
import { clearSpotifyTokens } from "@/lib/spotify";

export async function POST() {
  try {
    await ensureSettingsRow();
    await clearSpotifyTokens();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
