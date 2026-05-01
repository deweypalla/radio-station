import { NextResponse } from "next/server";
import { ensureSettingsRow, patchStationIdById } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

type PatchBody = {
  playCount?: number;
  incrementPlayCount?: boolean;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: raw } = await context.params;
    const id = Number.parseInt(raw, 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await request.json()) as PatchBody;

    await ensureSettingsRow();

    if (body.incrementPlayCount === true) {
      const row = await patchStationIdById(id, { incrementPlayCount: true });
      if (!row) {
        return NextResponse.json({ error: "Station ID not found" }, { status: 404 });
      }
      return NextResponse.json({
        id: row.id,
        fileName: row.fileName,
        filePath: row.filePath,
        playCount: row.playCount,
      });
    }

    if ("playCount" in body) {
      if (typeof body.playCount !== "number" || !Number.isInteger(body.playCount)) {
        return NextResponse.json(
          { error: "playCount must be an integer" },
          { status: 400 },
        );
      }
      if (body.playCount < 0) {
        return NextResponse.json({ error: "playCount must be >= 0" }, { status: 400 });
      }
      const row = await patchStationIdById(id, { playCount: body.playCount });
      if (!row) {
        return NextResponse.json({ error: "Station ID not found" }, { status: 404 });
      }
      return NextResponse.json({
        id: row.id,
        fileName: row.fileName,
        filePath: row.filePath,
        playCount: row.playCount,
      });
    }

    return NextResponse.json(
      { error: "Provide playCount or incrementPlayCount: true" },
      { status: 400 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
