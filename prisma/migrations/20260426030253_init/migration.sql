-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spotify_playlist_id" TEXT,
    "current_song_count" INTEGER NOT NULL DEFAULT 0,
    "last_auth_token" TEXT
);

-- CreateTable
CREATE TABLE "StationIDs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "play_count" INTEGER NOT NULL DEFAULT 0
);
