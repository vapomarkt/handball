-- AlterTable
ALTER TABLE "team" ADD COLUMN "ageGroup" "LeagueAgeGroup",
ADD COLUMN "usesResin" BOOLEAN NOT NULL DEFAULT true;

-- Bestehende Jugendteams (C-/D-/E-/F-Jugend & Minis) automatisch auf "ohne Harz" setzen
UPDATE "team"
SET "usesResin" = false
WHERE "name" ~* '\m([mwg]?[cdef]-?jugend|männliche\s+[cdef]-?jugend|weibliche\s+[cdef]-?jugend|gemischte\s+[cdef]-?jugend|minis?|minihandball)\M'
   OR "category" ~* '\m([mwg]?[cdef]-?jugend|minis?|minihandball)\M';
