-- CreateEnum
CREATE TYPE "JerseyCondition" AS ENUM ('NEW', 'GOOD', 'WORN', 'NEEDS_REPAIR', 'INCOMPLETE', 'RETIRED');

-- CreateTable
CREATE TABLE "jersey_set" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "colors" TEXT NOT NULL,
    "sizes" TEXT,
    "jerseyCount" INTEGER,
    "condition" "JerseyCondition" NOT NULL DEFAULT 'GOOD',
    "conditionNote" TEXT,
    "careInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jersey_set_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "match_details" ADD COLUMN "jerseySetId" TEXT;

-- AlterTable
ALTER TABLE "work_duty" ADD COLUMN "jerseySetId" TEXT;

-- CreateIndex
CREATE INDEX "jersey_set_clubId_idx" ON "jersey_set"("clubId");

-- CreateIndex
CREATE INDEX "jersey_set_teamId_idx" ON "jersey_set"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "jersey_set_clubId_name_key" ON "jersey_set"("clubId", "name");

-- CreateIndex
CREATE INDEX "match_details_jerseySetId_idx" ON "match_details"("jerseySetId");

-- CreateIndex
CREATE INDEX "work_duty_jerseySetId_idx" ON "work_duty"("jerseySetId");

-- AddForeignKey
ALTER TABLE "jersey_set" ADD CONSTRAINT "jersey_set_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jersey_set" ADD CONSTRAINT "jersey_set_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_details" ADD CONSTRAINT "match_details_jerseySetId_fkey" FOREIGN KEY ("jerseySetId") REFERENCES "jersey_set"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_duty" ADD CONSTRAINT "work_duty_jerseySetId_fkey" FOREIGN KEY ("jerseySetId") REFERENCES "jersey_set"("id") ON DELETE SET NULL ON UPDATE CASCADE;
