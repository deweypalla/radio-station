-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "spotify_access_token" TEXT;
ALTER TABLE "Settings" ADD COLUMN "spotify_refresh_token" TEXT;
ALTER TABLE "Settings" ADD COLUMN "spotify_access_expires_at" INTEGER;
