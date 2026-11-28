-- AlterTable
ALTER TABLE "league_import_source"
  ADD COLUMN "providerConfig" JSONB,
  ADD COLUMN "consecutiveErrors" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "league_group"
  ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'DE',
  ADD COLUMN "providerMeta" JSONB,
  ALTER COLUMN "externalProvider" SET DEFAULT 'NULIGA';

-- AlterTable
ALTER TABLE "league_group_team"
  ADD COLUMN "externalClubId" TEXT,
  ADD COLUMN "providerMeta" JSONB;

-- CreateTable
CREATE TABLE "directory_sync_run" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'DE',
    "federationCode" TEXT NOT NULL,
    "provider" "LeagueProviderType" NOT NULL,
    "seasonName" TEXT NOT NULL,
    "status" "DirectorySyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "groupsSynced" INTEGER NOT NULL DEFAULT 0,
    "teamsSynced" INTEGER NOT NULL DEFAULT 0,
    "deactivatedGroups" INTEGER NOT NULL DEFAULT 0,
    "deactivatedTeams" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorSample" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "directory_sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "league_group_countryCode_federationCode_seasonName_ageGroup_gender_idx"
  ON "league_group"("countryCode", "federationCode", "seasonName", "ageGroup", "gender");

-- CreateIndex
CREATE INDEX "league_group_team_externalClubId_idx"
  ON "league_group_team"("externalClubId");

-- CreateIndex
CREATE INDEX "directory_sync_run_countryCode_federationCode_startedAt_idx"
  ON "directory_sync_run"("countryCode", "federationCode", "startedAt");

-- CreateIndex
CREATE INDEX "directory_sync_run_provider_startedAt_idx"
  ON "directory_sync_run"("provider", "startedAt");
