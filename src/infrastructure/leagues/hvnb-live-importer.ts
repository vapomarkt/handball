import { PrismaClient } from "@prisma/client";
import { importNuligaFederationLive } from "./directory-importer";

export interface ImportHvnbLiveResult {
  groups: number;
  teams: number;
  deactivatedGroups: number;
  deactivatedTeams: number;
  failures: Array<{ url: string; reason: string }>;
}

/**
 * Liest alle Staffeln und Mannschaften der HVNB-Hauptwettbewerbe live aus nuLiga
 * und spiegelt sie idempotent ins Verzeichnis (league_group / league_group_team).
 * Nicht mehr enthaltene Staffeln und Mannschaften werden (mit Safety-Guard) deaktiviert.
 */
export async function importHvnbLive(
  prisma: PrismaClient
): Promise<ImportHvnbLiveResult> {
  const result = await importNuligaFederationLive(prisma, "HVNB", {
    seasonName: "2026/27",
    delayMs: 120,
  });

  return {
    groups: result.groups,
    teams: result.teams,
    deactivatedGroups: result.deactivatedGroups,
    deactivatedTeams: result.deactivatedTeams,
    failures: result.failures,
  };
}
