-- CreateEnum
CREATE TYPE "CourtMode" AS ENUM ('HALF_COURT', 'FULL_COURT');

-- CreateEnum
CREATE TYPE "TacticCategory" AS ENUM ('TRIGGER_PLAY', 'DEFENSE_6_0', 'DEFENSE_5_1', 'DEFENSE_3_2_1', 'DEFENSE_4_2', 'POWERPLAY_7_6', 'SHORTHANDED', 'FREE_THROW', 'FAST_BREAK', 'OTHER');

-- CreateEnum
CREATE TYPE "ThreatLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "tactic_play" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TacticCategory" NOT NULL DEFAULT 'TRIGGER_PLAY',
    "courtMode" "CourtMode" NOT NULL DEFAULT 'HALF_COURT',
    "boardData" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSharedWithTeam" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tactic_play_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opponent" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leagueName" TEXT,
    "defenseSystems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attackSystems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transitionNotes" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "generalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opponent_player" (
    "id" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jerseyNumber" INTEGER,
    "position" "HandballPosition",
    "throwingHand" "ThrowingHand",
    "shotZones" JSONB NOT NULL DEFAULT '{}',
    "feintPreference" TEXT,
    "isSevenMeterShooter" BOOLEAN NOT NULL DEFAULT false,
    "threatLevel" "ThreatLevel" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opponent_player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scouting_note" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "eventId" TEXT,
    "tacticPlayId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "videoUrl" TEXT,
    "isSharedWithTeam" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scouting_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tactic_play_clubId_idx" ON "tactic_play"("clubId");

-- CreateIndex
CREATE INDEX "tactic_play_teamId_idx" ON "tactic_play"("teamId");

-- CreateIndex
CREATE INDEX "opponent_clubId_idx" ON "opponent"("clubId");

-- CreateIndex
CREATE INDEX "opponent_teamId_idx" ON "opponent"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "opponent_teamId_name_key" ON "opponent"("teamId", "name");

-- CreateIndex
CREATE INDEX "opponent_player_opponentId_idx" ON "opponent_player"("opponentId");

-- CreateIndex
CREATE INDEX "scouting_note_teamId_idx" ON "scouting_note"("teamId");

-- CreateIndex
CREATE INDEX "scouting_note_opponentId_idx" ON "scouting_note"("opponentId");

-- CreateIndex
CREATE INDEX "scouting_note_eventId_idx" ON "scouting_note"("eventId");

-- AddForeignKey
ALTER TABLE "tactic_play" ADD CONSTRAINT "tactic_play_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tactic_play" ADD CONSTRAINT "tactic_play_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opponent" ADD CONSTRAINT "opponent_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opponent" ADD CONSTRAINT "opponent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opponent_player" ADD CONSTRAINT "opponent_player_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "opponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_note" ADD CONSTRAINT "scouting_note_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_note" ADD CONSTRAINT "scouting_note_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_note" ADD CONSTRAINT "scouting_note_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "opponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_note" ADD CONSTRAINT "scouting_note_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scouting_note" ADD CONSTRAINT "scouting_note_tacticPlayId_fkey" FOREIGN KEY ("tacticPlayId") REFERENCES "tactic_play"("id") ON DELETE SET NULL ON UPDATE CASCADE;
