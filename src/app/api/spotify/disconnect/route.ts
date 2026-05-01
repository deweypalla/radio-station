import { NextResponse } from "next/server";
import { ensureSettingsRow } from "@/lib/db";
import { clearSpotifyAuthCookies } from "@/lib/spotify";

export async function POST() {
  try {
    await ensureSettingsRow();
    await clearSpotifyAuthCookies();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
