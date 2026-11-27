-- AlterTable
ALTER TABLE "match_details" ADD COLUMN IF NOT EXISTS "scoreManuallyEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "match_details" ADD COLUMN IF NOT EXISTS "officialHomeScoreHalf" INTEGER;
ALTER TABLE "match_details" ADD COLUMN IF NOT EXISTS "officialAwayScoreHalf" INTEGER;
ALTER TABLE "match_details" ADD COLUMN IF NOT EXISTS "officialHomeScoreFull" INTEGER;
ALTER TABLE "match_details" ADD COLUMN IF NOT EXISTS "officialAwayScoreFull" INTEGER;
