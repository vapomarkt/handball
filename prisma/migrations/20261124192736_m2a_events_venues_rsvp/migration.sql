-- CreateEnum
CREATE TYPE "ResinPolicy" AS ENUM ('RESIN_ALLOWED', 'RESIN_FORBIDDEN', 'WATER_SOLUBLE_ONLY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TRAINING', 'MATCH', 'TOURNAMENT', 'CLUB_EVENT');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('ACCEPTED', 'DECLINED', 'MAYBE', 'PENDING');

-- CreateEnum
CREATE TYPE "DeclineReasonCategory" AS ENUM ('WORK', 'INJURY', 'VACATION', 'SCHOOL_UNI', 'OTHER');

-- CreateTable
CREATE TABLE "venue" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "mapsUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "resinPolicy" "ResinPolicy" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_recurrence" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "venueId" TEXT,
    "type" "EventType" NOT NULL DEFAULT 'TRAINING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "excludedDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rsvpDeadlineHours" INTEGER,
    "requireDeclineReason" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_recurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "recurrenceId" TEXT,
    "venueId" TEXT,
    "type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "meetingAt" TIMESTAMP(3),
    "rsvpDeadlineAt" TIMESTAMP(3),
    "requireDeclineReason" BOOLEAN NOT NULL DEFAULT false,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'PENDING',
    "declineReasonCategory" "DeclineReasonCategory",
    "declineReason" TEXT,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_details" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "opponentName" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL DEFAULT true,
    "throwOffAt" TIMESTAMP(3),
    "jerseyColor" TEXT,
    "refereeNote" TEXT,
    "nominatedMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "homeScoreHalf" INTEGER,
    "awayScoreHalf" INTEGER,
    "homeScoreFull" INTEGER,
    "awayScoreFull" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "venue_clubId_idx" ON "venue"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "venue_clubId_name_key" ON "venue"("clubId", "name");

-- CreateIndex
CREATE INDEX "event_recurrence_clubId_idx" ON "event_recurrence"("clubId");

-- CreateIndex
CREATE INDEX "event_recurrence_teamId_idx" ON "event_recurrence"("teamId");

-- CreateIndex
CREATE INDEX "event_clubId_idx" ON "event"("clubId");

-- CreateIndex
CREATE INDEX "event_teamId_startAt_idx" ON "event"("teamId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_teamId_externalId_key" ON "event"("teamId", "externalId");

-- CreateIndex
CREATE INDEX "event_attendance_eventId_idx" ON "event_attendance"("eventId");

-- CreateIndex
CREATE INDEX "event_attendance_memberId_idx" ON "event_attendance"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendance_eventId_memberId_key" ON "event_attendance"("eventId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "match_details_eventId_key" ON "match_details"("eventId");

-- AddForeignKey
ALTER TABLE "venue" ADD CONSTRAINT "venue_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_recurrence" ADD CONSTRAINT "event_recurrence_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_recurrence" ADD CONSTRAINT "event_recurrence_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_recurrence" ADD CONSTRAINT "event_recurrence_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "event_recurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_details" ADD CONSTRAINT "match_details_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
