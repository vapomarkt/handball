-- CreateEnum
CREATE TYPE "DutyScope" AS ENUM ('CLUB_MATCHDAY', 'TEAM');

-- CreateEnum
CREATE TYPE "DutyCategory" AS ENUM ('TIMEKEEPER', 'SECRETARY', 'HALL_SETUP', 'KIOSK', 'TICKETING', 'REFEREE_CARE', 'ANNOUNCER', 'JERSEY_LAUNDRY', 'EQUIPMENT_BAG', 'DRINKS', 'OTHER');

-- CreateEnum
CREATE TYPE "DutyAssignmentStatus" AS ENUM ('OPEN', 'ASSIGNED', 'SWAP_REQUESTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TrainingPhaseType" AS ENUM ('WARMUP', 'TECHNIQUE', 'TACTICS', 'GAME_FORM', 'COOLDOWN');

-- CreateTable
CREATE TABLE "matchday" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "seasonId" TEXT,
    "venueId" TEXT,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matchday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_duty" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT,
    "matchdayId" TEXT,
    "eventId" TEXT,
    "scope" "DutyScope" NOT NULL DEFAULT 'CLUB_MATCHDAY',
    "category" "DutyCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "hoursCredit" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "requiresLicense" BOOLEAN NOT NULL DEFAULT false,
    "slotsNeeded" INTEGER NOT NULL DEFAULT 1,
    "assignedTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_duty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_duty_assignment" (
    "id" TEXT NOT NULL,
    "dutyId" TEXT NOT NULL,
    "assignedMemberId" TEXT,
    "status" "DutyAssignmentStatus" NOT NULL DEFAULT 'OPEN',
    "swapNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_duty_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drill" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "phase" "TrainingPhaseType" NOT NULL DEFAULT 'TECHNIQUE',
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipment" TEXT,
    "tacticPlayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "focus" TEXT,
    "targetDurationMinutes" INTEGER NOT NULL DEFAULT 90,
    "phases" JSONB NOT NULL DEFAULT '[]',
    "isSharedWithTeam" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matchday_clubId_date_idx" ON "matchday"("clubId", "date");

-- CreateIndex
CREATE INDEX "work_duty_clubId_idx" ON "work_duty"("clubId");

-- CreateIndex
CREATE INDEX "work_duty_teamId_idx" ON "work_duty"("teamId");

-- CreateIndex
CREATE INDEX "work_duty_matchdayId_idx" ON "work_duty"("matchdayId");

-- CreateIndex
CREATE INDEX "work_duty_assignedTeamId_idx" ON "work_duty"("assignedTeamId");

-- CreateIndex
CREATE INDEX "work_duty_assignment_dutyId_idx" ON "work_duty_assignment"("dutyId");

-- CreateIndex
CREATE INDEX "work_duty_assignment_assignedMemberId_idx" ON "work_duty_assignment"("assignedMemberId");

-- CreateIndex
CREATE INDEX "drill_clubId_idx" ON "drill"("clubId");

-- CreateIndex
CREATE INDEX "drill_teamId_idx" ON "drill"("teamId");

-- CreateIndex
CREATE INDEX "training_plan_clubId_idx" ON "training_plan"("clubId");

-- CreateIndex
CREATE INDEX "training_plan_teamId_idx" ON "training_plan"("teamId");

-- AddForeignKey
ALTER TABLE "matchday" ADD CONSTRAINT "matchday_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchday" ADD CONSTRAINT "matchday_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchday" ADD CONSTRAINT "matchday_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_duty" ADD CONSTRAINT "work_duty_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_duty" ADD CONSTRAINT "work_duty_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_duty" ADD CONSTRAINT "work_duty_matchdayId_fkey" FOREIGN KEY ("matchdayId") REFERENCES "matchday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_duty" ADD CONSTRAINT "work_duty_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_duty" ADD CONSTRAINT "work_duty_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_duty_assignment" ADD CONSTRAINT "work_duty_assignment_dutyId_fkey" FOREIGN KEY ("dutyId") REFERENCES "work_duty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_duty_assignment" ADD CONSTRAINT "work_duty_assignment_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "team_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drill" ADD CONSTRAINT "drill_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drill" ADD CONSTRAINT "drill_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan" ADD CONSTRAINT "training_plan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
