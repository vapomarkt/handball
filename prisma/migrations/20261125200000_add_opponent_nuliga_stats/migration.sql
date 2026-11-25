-- AlterTable
ALTER TABLE "opponent" ADD COLUMN "externalUrl" TEXT;

-- AlterTable
ALTER TABLE "opponent_player" ADD COLUMN "externalPlayerId" TEXT,
ADD COLUMN "goalsTotal" INTEGER,
ADD COLUMN "gamesPlayed" INTEGER,
ADD COLUMN "sevenMeterGoals" INTEGER,
ADD COLUMN "sevenMeterAttempts" INTEGER,
ADD COLUMN "statsUpdatedAt" TIMESTAMP(3);
