import { NextResponse } from "next/server";
import { ensureSettingsRow, getSettings, patchSettings } from "@/lib/db";
import {
  DEFAULT_SPOTIFY_PLAYLIST_ID,
  normalizeSpotifyPlaylistId,
} from "@/lib/spotifyPlaylist";
import { hasSpotifyUserAuth } from "@/lib/spotify";

export async function GET() {
  try {
    await ensureSettingsRow();
    const row = await getSettings();
    const hasAuthToken = await hasSpotifyUserAuth();
    return NextResponse.json({
      spotifyPlaylistId: row.spotifyPlaylistId,
      currentSongCount: row.currentSongCount,
      stationBreakTarget: row.stationBreakTarget,
      hasAuthToken,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  spotifyPlaylistId?: string | null;
  currentSongCount?: number;
  stationBreakTarget?: number | null;
  lastAuthToken?: string | null;
};

export async function PATCH(request: Request) {
  try {
    await ensureSettingsRow();
    const body = (await request.json()) as PatchBody;
    const data: {
      spotifyPlaylistId?: string | null;
      currentSongCount?: number;
      stationBreakTarget?: number | null;
      lastAuthToken?: string | null;
    } = {};

    if ("spotifyPlaylistId" in body) {
      if (body.spotifyPlaylistId !== null && typeof body.spotifyPlaylistId !== "string") {
        return NextResponse.json(
          { error: "spotifyPlaylistId must be a string or null" },
          { status: 400 },
        );
      }
      if (body.spotifyPlaylistId === null) {
        data.spotifyPlaylistId = null;
      } else {
        const raw = body.spotifyPlaylistId.trim();
        if (raw === "") {
          data.spotifyPlaylistId = null;
        } else {
          const normalized = normalizeSpotifyPlaylistId(raw);
          data.spotifyPlaylistId =
            normalized == null
              ? null
              : normalized === DEFAULT_SPOTIFY_PLAYLIST_ID
                ? null
                : normalized;
        }
      }
    }

    if ("currentSongCount" in body) {
      if (typeof body.currentSongCount !== "number" || !Number.isInteger(body.currentSongCount)) {
        return NextResponse.json(
          { error: "currentSongCount must be an integer" },
          { status: 400 },
        );
      }
      if (body.currentSongCount < 0) {
        return NextResponse.json(
          { error: "currentSongCount must be >= 0" },
          { status: 400 },
        );
      }
      data.currentSongCount = body.currentSongCount;
    }

    if ("stationBreakTarget" in body) {
      if (body.stationBreakTarget !== null && body.stationBreakTarget !== undefined) {
        if (
          typeof body.stationBreakTarget !== "number" ||
          !Number.isInteger(body.stationBreakTarget) ||
          (body.stationBreakTarget !== 5 && body.stationBreakTarget !== 6)
        ) {
          return NextResponse.json(
            { error: "stationBreakTarget must be 5, 6, or null" },
            { status: 400 },
          );
        }
        data.stationBreakTarget = body.stationBreakTarget;
      } else {
        data.stationBreakTarget = null;
      }
    }

    if ("lastAuthToken" in body) {
      if (body.lastAuthToken !== null && typeof body.lastAuthToken !== "string") {
        return NextResponse.json(
          { error: "lastAuthToken must be a string or null" },
          { status: 400 },
        );
      }
      data.lastAuthToken = body.lastAuthToken ?? null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const row = await patchSettings(data);
    const hasAuthToken = await hasSpotifyUserAuth();

    return NextResponse.json({
      spotifyPlaylistId: row.spotifyPlaylistId,
      currentSongCount: row.currentSongCount,
      stationBreakTarget: row.stationBreakTarget,
      hasAuthToken,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
