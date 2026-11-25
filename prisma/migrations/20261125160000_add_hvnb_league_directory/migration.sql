-- AlterEnum
ALTER TYPE "LeagueProviderType" ADD VALUE 'HVNB_NULIGA';

-- AlterTable
ALTER TABLE "team" ADD COLUMN "leagueGroupTeamId" TEXT;

-- AlterTable
ALTER TABLE "league_import_source" ADD COLUMN "leagueGroupTeamId" TEXT;

-- CreateTable
CREATE TABLE "league_group" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "federationCode" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "regionName" TEXT NOT NULL,
    "seasonName" TEXT NOT NULL,
    "leagueId" TEXT,
    "ageGroup" "LeagueAgeGroup" NOT NULL,
    "gender" "TeamGender" NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "externalProvider" "LeagueProviderType" NOT NULL DEFAULT 'HVNB_NULIGA',
    "externalGroupId" TEXT,
    "externalUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_group_team" (
    "id" TEXT NOT NULL,
    "leagueGroupId" TEXT NOT NULL,
    "externalTeamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "shortName" TEXT,
    "icalUrl" TEXT,
    "externalUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_group_team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "league_group_code_key" ON "league_group"("code");

-- CreateIndex
CREATE INDEX "league_group_federationCode_seasonName_ageGroup_gender_idx" ON "league_group"("federationCode", "seasonName", "ageGroup", "gender");

-- CreateIndex
CREATE INDEX "league_group_federationCode_regionCode_idx" ON "league_group"("federationCode", "regionCode");

-- CreateIndex
CREATE INDEX "league_group_leagueId_idx" ON "league_group"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "league_group_team_leagueGroupId_externalTeamId_key" ON "league_group_team"("leagueGroupId", "externalTeamId");

-- CreateIndex
CREATE INDEX "league_group_team_leagueGroupId_idx" ON "league_group_team"("leagueGroupId");

-- CreateIndex
CREATE INDEX "league_group_team_clubName_idx" ON "league_group_team"("clubName");

-- CreateIndex
CREATE INDEX "team_leagueGroupTeamId_idx" ON "team"("leagueGroupTeamId");

-- CreateIndex
CREATE INDEX "league_import_source_leagueGroupTeamId_idx" ON "league_import_source"("leagueGroupTeamId");

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_leagueGroupTeamId_fkey" FOREIGN KEY ("leagueGroupTeamId") REFERENCES "league_group_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_import_source" ADD CONSTRAINT "league_import_source_leagueGroupTeamId_fkey" FOREIGN KEY ("leagueGroupTeamId") REFERENCES "league_group_team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_group" ADD CONSTRAINT "league_group_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_group_team" ADD CONSTRAINT "league_group_team_leagueGroupId_fkey" FOREIGN KEY ("leagueGroupId") REFERENCES "league_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
