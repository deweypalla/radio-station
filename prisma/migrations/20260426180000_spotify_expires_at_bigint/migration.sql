-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spotify_playlist_id" TEXT,
    "current_song_count" INTEGER NOT NULL DEFAULT 0,
    "station_break_target" INTEGER,
    "last_auth_token" TEXT,
    "spotify_access_token" TEXT,
    "spotify_refresh_token" TEXT,
    "spotify_access_expires_at" BIGINT
);
INSERT INTO "new_Settings" ("current_song_count", "id", "last_auth_token", "spotify_access_expires_at", "spotify_access_token", "spotify_playlist_id", "spotify_refresh_token", "station_break_target") SELECT "current_song_count", "id", "last_auth_token", "spotify_access_expires_at", "spotify_access_token", "spotify_playlist_id", "spotify_refresh_token", "station_break_target" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
