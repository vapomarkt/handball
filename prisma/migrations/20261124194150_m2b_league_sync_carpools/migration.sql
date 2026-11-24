-- CreateEnum
CREATE TYPE "LeagueProviderType" AS ENUM ('ICAL_URL', 'CSV_MANUAL');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('NEVER', 'SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncChangeType" AS ENUM ('CREATED', 'RESCHEDULED', 'VENUE_CHANGED', 'CANCELLED', 'UPDATED');

-- CreateTable
CREATE TABLE "league_import_source" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "provider" "LeagueProviderType" NOT NULL DEFAULT 'ICAL_URL',
    "name" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "teamNameMatch" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" "SyncStatus" NOT NULL DEFAULT 'NEVER',
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_import_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_sync_change_log" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT,
    "externalId" TEXT NOT NULL,
    "changeType" "SyncChangeType" NOT NULL,
    "summary" TEXT NOT NULL,
    "oldStartAt" TIMESTAMP(3),
    "newStartAt" TIMESTAMP(3),
    "oldVenueName" TEXT,
    "newVenueName" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_sync_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "driverMemberId" TEXT NOT NULL,
    "departureLocation" TEXT NOT NULL,
    "departureTime" TEXT,
    "totalSeats" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carpool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_booking" (
    "id" TEXT NOT NULL,
    "carpoolId" TEXT NOT NULL,
    "passengerMemberId" TEXT NOT NULL,
    "bookedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "league_import_source_clubId_idx" ON "league_import_source"("clubId");

-- CreateIndex
CREATE INDEX "league_import_source_teamId_idx" ON "league_import_source"("teamId");

-- CreateIndex
CREATE INDEX "league_sync_change_log_teamId_detectedAt_idx" ON "league_sync_change_log"("teamId", "detectedAt");

-- CreateIndex
CREATE INDEX "league_sync_change_log_sourceId_idx" ON "league_sync_change_log"("sourceId");

-- CreateIndex
CREATE INDEX "carpool_eventId_idx" ON "carpool"("eventId");

-- CreateIndex
CREATE INDEX "carpool_driverMemberId_idx" ON "carpool"("driverMemberId");

-- CreateIndex
CREATE INDEX "carpool_booking_carpoolId_idx" ON "carpool_booking"("carpoolId");

-- CreateIndex
CREATE INDEX "carpool_booking_passengerMemberId_idx" ON "carpool_booking"("passengerMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "carpool_booking_carpoolId_passengerMemberId_key" ON "carpool_booking"("carpoolId", "passengerMemberId");

-- AddForeignKey
ALTER TABLE "league_import_source" ADD CONSTRAINT "league_import_source_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_import_source" ADD CONSTRAINT "league_import_source_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_sync_change_log" ADD CONSTRAINT "league_sync_change_log_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "league_import_source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_sync_change_log" ADD CONSTRAINT "league_sync_change_log_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_sync_change_log" ADD CONSTRAINT "league_sync_change_log_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool" ADD CONSTRAINT "carpool_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool" ADD CONSTRAINT "carpool_driverMemberId_fkey" FOREIGN KEY ("driverMemberId") REFERENCES "team_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_booking" ADD CONSTRAINT "carpool_booking_carpoolId_fkey" FOREIGN KEY ("carpoolId") REFERENCES "carpool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_booking" ADD CONSTRAINT "carpool_booking_passengerMemberId_fkey" FOREIGN KEY ("passengerMemberId") REFERENCES "team_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
