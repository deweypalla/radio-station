import { PrismaClient } from "@prisma/client";
import { readdir } from "fs/promises";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".wav",
  ".ogg",
  ".flac",
]);

export type StationAudioFile = {
  fileName: string;
  filePath: string;
};

export async function listStationAudioFilesOnDisk(): Promise<StationAudioFile[]> {
  const dir = path.join(process.cwd(), "public", "audio");
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const files: StationAudioFile[] = [];
  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;
    files.push({
      fileName: name,
      filePath: `/audio/${name}`,
    });
  }
  files.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return files;
}

export async function ensureSettingsRow(): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing) return;
  await prisma.settings.create({
    data: {
      id: 1,
      spotifyPlaylistId: null,
      currentSongCount: 0,
      stationBreakTarget: null,
      lastAuthToken: null,
      spotifyAccessToken: null,
      spotifyRefreshToken: null,
      spotifyAccessExpiresAt: null,
    },
  });
}

export type SyncStationIdsResult = {
  upserted: number;
  removed: number;
};

/**
 * Upserts rows for each audio file under public/audio and removes DB rows
 * whose file_path no longer exists on disk.
 */
export async function syncStationIdsFromPublicAudio(): Promise<SyncStationIdsResult> {
  const prisma = getPrisma();
  const onDisk = await listStationAudioFilesOnDisk();
  const paths = onDisk.map((f) => f.filePath);

  return prisma.$transaction(async (tx) => {
    let removed = 0;
    if (paths.length === 0) {
      const result = await tx.stationID.deleteMany();
      removed = result.count;
      return { upserted: 0, removed };
    }

    const deleteResult = await tx.stationID.deleteMany({
      where: { filePath: { notIn: paths } },
    });
    removed = deleteResult.count;

    for (const file of onDisk) {
      await tx.stationID.upsert({
        where: { filePath: file.filePath },
        create: {
          fileName: file.fileName,
          filePath: file.filePath,
          playCount: 0,
        },
        update: { fileName: file.fileName },
      });
    }

    return { upserted: onDisk.length, removed };
  });
}
