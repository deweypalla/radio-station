import { NextResponse } from "next/server";
import {
  ensureSettingsRow,
  listStationIdsOrderedByFileName,
  syncStationIdsFromPublicAudio,
} from "@/lib/db";

export async function GET() {
  try {
    await ensureSettingsRow();
    await syncStationIdsFromPublicAudio();
    const items = await listStationIdsOrderedByFileName();
    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        filePath: r.filePath,
        playCount: r.playCount,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
