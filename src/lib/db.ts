import { mkdir, readFile, readdir, rename, writeFile } from "fs/promises";
import { tmpdir } from "node:os";
import path from "path";

/** Persisted settings + station-ID catalog (single JSON file on disk). */
export type SettingsRecord = {
  spotifyPlaylistId: string | null;
  currentSongCount: number;
  stationBreakTarget: number | null;
  lastAuthToken: string | null;
};

export type StationIdRecord = {
  id: number;
  fileName: string;
  filePath: string;
  playCount: number;
};

export type RadioConfigFile = {
  settings: SettingsRecord;
  stationIds: StationIdRecord[];
};

function defaultSettings(): SettingsRecord {
  return {
    spotifyPlaylistId: null,
    currentSongCount: 0,
    stationBreakTarget: null,
    lastAuthToken: null,
  };
}

function defaultConfig(): RadioConfigFile {
  return { settings: defaultSettings(), stationIds: [] };
}

function getConfigPath(): string {
  const override = process.env.RADIO_CONFIG_PATH?.trim();
  if (override) {
    return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  }
  // Vercel (and typical serverless) mounts the bundle read-only under process.cwd(); only /tmp is writable.
  if (process.env.VERCEL) {
    return path.join(tmpdir(), "radio-config.json");
  }
  return path.join(process.cwd(), "data", "radio-config.json");
}

function normalizeConfig(raw: unknown): RadioConfigFile {
  const d = defaultConfig();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;

  const sIn = o.settings && typeof o.settings === "object" ? (o.settings as Record<string, unknown>) : {};
  const settings: SettingsRecord = {
    spotifyPlaylistId:
      typeof sIn.spotifyPlaylistId === "string" || sIn.spotifyPlaylistId === null
        ? (sIn.spotifyPlaylistId as string | null)
        : d.settings.spotifyPlaylistId,
    currentSongCount:
      typeof sIn.currentSongCount === "number" && Number.isInteger(sIn.currentSongCount)
        ? sIn.currentSongCount
        : d.settings.currentSongCount,
    stationBreakTarget:
      sIn.stationBreakTarget === null ||
      (typeof sIn.stationBreakTarget === "number" &&
        (sIn.stationBreakTarget === 5 || sIn.stationBreakTarget === 6))
        ? (sIn.stationBreakTarget as number | null)
        : d.settings.stationBreakTarget,
    lastAuthToken:
      typeof sIn.lastAuthToken === "string" || sIn.lastAuthToken === null
        ? (sIn.lastAuthToken as string | null)
        : d.settings.lastAuthToken,
  };

  let stationIds: StationIdRecord[] = [];
  if (Array.isArray(o.stationIds)) {
    stationIds = o.stationIds
      .map((row): StationIdRecord | null => {
        if (!row || typeof row !== "object") return null;
        const r = row as Record<string, unknown>;
        const id = typeof r.id === "number" && Number.isInteger(r.id) ? r.id : NaN;
        const fileName = typeof r.fileName === "string" ? r.fileName : "";
        const filePath = typeof r.filePath === "string" ? r.filePath : "";
        const playCount =
          typeof r.playCount === "number" && Number.isInteger(r.playCount) && r.playCount >= 0
            ? r.playCount
            : 0;
        if (!Number.isFinite(id) || id < 1 || !filePath) return null;
        return { id, fileName, filePath, playCount };
      })
      .filter((x): x is StationIdRecord => x != null);
  }

  return { settings, stationIds };
}

let queue = Promise.resolve();

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn);
  queue = next.then(
    () => {},
    () => {},
  );
  return next;
}

async function readConfigUnlocked(): Promise<RadioConfigFile> {
  const fp = getConfigPath();
  try {
    const raw = await readFile(fp, "utf8");
    return normalizeConfig(JSON.parse(raw) as unknown);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return defaultConfig();
    throw e;
  }
}

async function writeConfigUnlocked(cfg: RadioConfigFile): Promise<void> {
  const fp = getConfigPath();
  await mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
  await rename(tmp, fp);
}

/** Ensures the config file exists with defaults (no-op if already present). */
export async function ensureSettingsRow(): Promise<void> {
  await runExclusive(async () => {
    const fp = getConfigPath();
    try {
      await readFile(fp, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      await writeConfigUnlocked(defaultConfig());
    }
  });
}

export async function getSettings(): Promise<SettingsRecord> {
  return runExclusive(async () => {
    const cfg = await readConfigUnlocked();
    return { ...cfg.settings };
  });
}

export async function patchSettings(patch: Partial<SettingsRecord>): Promise<SettingsRecord> {
  return runExclusive(async () => {
    const cfg = await readConfigUnlocked();
    cfg.settings = { ...cfg.settings, ...patch };
    await writeConfigUnlocked(cfg);
    return { ...cfg.settings };
  });
}

export async function listStationIdsOrderedByFileName(): Promise<StationIdRecord[]> {
  return runExclusive(async () => {
    const cfg = await readConfigUnlocked();
    return [...cfg.stationIds].sort((a, b) => a.fileName.localeCompare(b.fileName));
  });
}

export async function patchStationIdById(
  id: number,
  patch: { incrementPlayCount?: boolean; playCount?: number },
): Promise<StationIdRecord | null> {
  return runExclusive(async () => {
    const cfg = await readConfigUnlocked();
    const idx = cfg.stationIds.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const row = { ...cfg.stationIds[idx] };
    if (patch.incrementPlayCount === true) row.playCount += 1;
    else if (typeof patch.playCount === "number") row.playCount = patch.playCount;
    cfg.stationIds[idx] = row;
    await writeConfigUnlocked(cfg);
    return row;
  });
}

const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".ogg", ".flac"]);

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

export type SyncStationIdsResult = {
  upserted: number;
  removed: number;
};

/**
 * Syncs catalog entries to files under public/audio; preserves playCount by filePath;
 * assigns stable numeric ids.
 */
export async function syncStationIdsFromPublicAudio(): Promise<SyncStationIdsResult> {
  return runExclusive(async () => {
    const cfg = await readConfigUnlocked();
    const onDisk = await listStationAudioFilesOnDisk();
    const paths = new Set(onDisk.map((f) => f.filePath));

    const removed = cfg.stationIds.filter((s) => !paths.has(s.filePath)).length;
    cfg.stationIds = cfg.stationIds.filter((s) => paths.has(s.filePath));

    let maxId = cfg.stationIds.reduce((m, s) => Math.max(m, s.id), 0);

    for (const file of onDisk) {
      const existing = cfg.stationIds.find((s) => s.filePath === file.filePath);
      if (existing) {
        existing.fileName = file.fileName;
      } else {
        maxId += 1;
        cfg.stationIds.push({
          id: maxId,
          fileName: file.fileName,
          filePath: file.filePath,
          playCount: 0,
        });
      }
    }

    await writeConfigUnlocked(cfg);
    return { upserted: onDisk.length, removed };
  });
}
