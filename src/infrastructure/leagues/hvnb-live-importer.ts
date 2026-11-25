import { PrismaClient } from "@prisma/client";
import {
  buildLeagueCode,
  crawlHvnbDirectory,
} from "./hvnb-live-crawler";

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
 * Nicht mehr enthaltene Staffeln und Mannschaften werden deaktiviert, nicht gelöscht.
 */
export async function importHvnbLive(
  prisma: PrismaClient
): Promise<ImportHvnbLiveResult> {
  const leagues = await prisma.league.findMany({
    select: { id: true, code: true },
  });
  const leagueIdByCode = new Map(leagues.map((l) => [l.code, l.id]));

  const fetchText = async (url: string) => {
    const res = await fetch(url, {
      headers: { Accept: "text/html, */*" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };

  console.log("Crawle HVNB-Staffeln aus nuLiga (alle Regionen, Saison 2026/27)…");
  const { groups, failures } = await crawlHvnbDirectory({
    fetchText,
    onProgress: (done) => {
      if (done % 100 === 0) console.log(`  … ${done} Staffeln gelesen`);
    },
  });
  console.log(`Crawl abgeschlossen: ${groups.length} Staffeln, ${failures.length} Fehler.`);

  let teamsTotal = 0;
  let deactivatedTeams = 0;
  const keptGroupCodes: string[] = [];

  for (const group of groups) {
    const leagueId =
      leagueIdByCode.get(
        buildLeagueCode(group.ageGroup, group.gender, group.name) ?? ""
      ) ?? null;

    const data = {
      federationCode: group.federationCode,
      regionCode: group.regionCode,
      regionName: group.regionName,
      seasonName: group.seasonName,
      leagueId,
      ageGroup: group.ageGroup,
      gender: group.gender,
      name: group.name,
      externalProvider: "HVNB_NULIGA" as const,
      externalGroupId: group.externalGroupId,
      externalUrl: group.externalUrl,
      isActive: true,
      lastSyncedAt: new Date(),
    };

    const saved = await prisma.leagueGroup.upsert({
      where: { code: group.code },
      update: data,
      create: { code: group.code, ...data },
    });
    keptGroupCodes.push(group.code);

    const teamIds = group.teams.map((t) => t.externalTeamId);
    for (const team of group.teams) {
      await prisma.leagueGroupTeam.upsert({
        where: {
          leagueGroupId_externalTeamId: {
            leagueGroupId: saved.id,
            externalTeamId: team.externalTeamId,
          },
        },
        update: {
          name: team.name,
          clubName: team.clubName,
          externalUrl: team.externalUrl,
          isActive: true,
        },
        create: {
          leagueGroupId: saved.id,
          externalTeamId: team.externalTeamId,
          name: team.name,
          clubName: team.clubName,
          externalUrl: team.externalUrl,
          isActive: true,
        },
      });
      teamsTotal += 1;
    }

    const deactivated = await prisma.leagueGroupTeam.updateMany({
      where: {
        leagueGroupId: saved.id,
        isActive: true,
        externalTeamId: { notIn: teamIds },
      },
      data: { isActive: false },
    });
    deactivatedTeams += deactivated.count;
  }

  const staleGroups = await prisma.leagueGroup.updateMany({
    where: {
      federationCode: "HVNB",
      seasonName: "2026/27",
      isActive: true,
      code: { notIn: keptGroupCodes },
    },
    data: { isActive: false },
  });

  return {
    groups: groups.length,
    teams: teamsTotal,
    deactivatedGroups: staleGroups.count,
    deactivatedTeams,
    failures,
  };
}
