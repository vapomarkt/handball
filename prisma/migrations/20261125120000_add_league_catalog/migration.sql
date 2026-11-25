-- CreateEnum
CREATE TYPE "LeagueAgeGroup" AS ENUM ('ADULT', 'YOUTH_A', 'YOUTH_B', 'YOUTH_C', 'YOUTH_D', 'YOUTH_E', 'YOUTH_F_MINI', 'SENIOR');

-- AlterTable
ALTER TABLE "team" ADD COLUMN "leagueId" TEXT;

-- CreateTable
CREATE TABLE "league" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'DE',
    "federationCode" TEXT NOT NULL,
    "federationName" TEXT NOT NULL,
    "ageGroup" "LeagueAgeGroup" NOT NULL,
    "gender" "TeamGender" NOT NULL,
    "tier" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "league_code_key" ON "league"("code");

-- CreateIndex
CREATE INDEX "league_countryCode_ageGroup_gender_federationCode_idx" ON "league"("countryCode", "ageGroup", "gender", "federationCode");

-- CreateIndex
CREATE INDEX "league_countryCode_federationCode_idx" ON "league"("countryCode", "federationCode");

-- CreateIndex
CREATE INDEX "team_leagueId_idx" ON "team"("leagueId");

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "league"("id") ON DELETE SET NULL ON UPDATE CASCADE;
