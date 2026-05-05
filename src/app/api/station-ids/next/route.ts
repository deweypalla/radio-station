import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ensureSettingsRow,
  listStationIdsOrderedByFileName,
  syncStationIdsFromPublicAudio,
} from "@/lib/db";

export const dynamic = "force-dynamic";

function parseExcludeId(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Returns one station ID file to play, chosen at random (server-side).
 * Optional `?exclude=<id>` avoids immediately repeating the last segment when multiple files exist.
 */
export async function GET(request: Request) {
  try {
    await ensureSettingsRow();
    await syncStationIdsFromPublicAudio();
    const items = await listStationIdsOrderedByFileName();
    if (items.length === 0) {
      return NextResponse.json(
        { item: null },
        {
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const url = new URL(request.url);
    const excludeId = parseExcludeId(url.searchParams.get("exclude"));

    let pool = items;
    if (excludeId != null && items.length > 1) {
      const filtered = items.filter((r) => r.id !== excludeId);
      if (filtered.length > 0) pool = filtered;
    }

    const pick = pool[randomInt(0, pool.length)]!;
    return NextResponse.json(
      {
        item: {
          id: pick.id,
          fileName: pick.fileName,
          filePath: pick.filePath,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
