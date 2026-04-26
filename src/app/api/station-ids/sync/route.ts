import { NextResponse } from "next/server";
import { ensureSettingsRow, getPrisma, syncStationIdsFromPublicAudio } from "@/lib/db";

export async function POST() {
  try {
    await ensureSettingsRow();
    const result = await syncStationIdsFromPublicAudio();
    const prisma = getPrisma();
    const items = await prisma.stationID.findMany({
      orderBy: { fileName: "asc" },
    });
    return NextResponse.json({
      ...result,
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
