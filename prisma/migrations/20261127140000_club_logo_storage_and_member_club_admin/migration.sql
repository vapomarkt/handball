-- AlterTable
ALTER TABLE "club" ADD COLUMN "logoData" BYTEA;
ALTER TABLE "club" ADD COLUMN "logoMimeType" TEXT;

-- AlterTable
ALTER TABLE "team_member" ADD COLUMN "isClubAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing CLUB_ADMIN memberships so isClubAdmin is always consistent
UPDATE "team_member" SET "isClubAdmin" = true WHERE "role" = 'CLUB_ADMIN';
