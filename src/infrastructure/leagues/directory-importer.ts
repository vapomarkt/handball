import {
  DirectorySyncRunStatus,
  LeagueProviderType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { getNuligaFederations } from "@/domain/data/federation-registry";
import {
  buildFederationLeagueCode,
  crawlNuligaFederation,
} from "./nuliga-live-crawler";

export interface ImportFederationLiveResult {
  countryCode: string;
  federationCode: string;
  provider: LeagueProviderType;
  seasonName: string;
  status: DirectorySyncRunStatus;
  groups: number;
  teams: number;
  deactivatedGroups: number;
  deactivatedTeams: number;
  safetyGuardTriggered: boolean;
  failures: Array<{ url: string; reason: string }>;
}

export interface ImportFederationOptions {
  seasonName?: string;
  delayMs?: number;
  dryRun?: boolean;
  /** Mindestquote an gefundenen Staffeln relativ zum bisherigen Bestand (Standard: 0.5). */
  minKeepRatio?: number;
  /** Mindestanzahl bestehender aktiver Staffeln, ab der der Safety-Guard greift (Standard: 10). */
  minExistingForGuard?: number;
  fetchText?: (url: string) => Promise<string>;
}

/**
 * Safety-Guard gegen Massen-Deaktivierung bei Wartungsseiten, Rate-Limits oder
 * HTML-Änderungen eines Verbandsportals.
 */
export function shouldTriggerDeactivationSafetyGuard(params: {
  existingActiveGroups: number;
  crawledGroups: number;
  minKeepRatio?: number;
  minExistingForGuard?: number;
}): boolean {
  const minRatio = params.minKeepRatio ?? 0.5;
  const minExisting = params.minExistingForGuard ?? 10;
  if (params.existingActiveGroups < minExisting) return false;
  return params.crawledGroups < Math.floor(params.existingActiveGroups * minRatio);
}

async function defaultFetchTextWithRetry(url: string): Promise<string> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "text/html, */*",
          "User-Agent": "ThrowOff-Handball-Sync/1.0 (+https://throwoff.de)",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Liest alle Staffeln und Mannschaften eines beliebigen nuLiga-Landesverbands
 * (DE oder AT/ÖHB) live aus nuLiga und spiegelt sie idempotent ins Verzeichnis
 * (`league_group` / `league_group_team`).
 * Protokolliert jeden Lauf in `directory_sync_run` und schützt über einen
 * Safety-Guard vor versehentlicher Massen-Deaktivierung.
 */
export async function importNuligaFederationLive(
  prisma: PrismaClient,
  federationCode: string,
  options: ImportFederationOptions = {}
): Promise<ImportFederationLiveResult> {
  const seasonName = options.seasonName ?? "2026/27";
  const delayMs = options.delayMs ?? 150;
  const fetchText = options.fetchText ?? defaultFetchTextWithRetry;
  const dryRun = options.dryRun ?? false;

  const provider: LeagueProviderType =
    federationCode.toUpperCase() === "HVNB" ? "HVNB_NULIGA" : "NULIGA";

  const leagues = await prisma.league.findMany({
    select: { id: true, code: true },
  });
  const leagueIdByCode = new Map(leagues.map((l) => [l.code, l.id]));

  const runRecord = dryRun
    ? null
    : await prisma.directorySyncRun.create({
        data: {
          countryCode: federationCode.toUpperCase() === "OEHB" ? "AT" : "DE",
          federationCode: federationCode.toUpperCase(),
          provider,
          seasonName,
          status: "RUNNING",
        },
      });

  try {
    console.log(
      `Crawle ${federationCode.toUpperCase()}-Staffeln aus nuLiga (Saison ${seasonName})…`
    );
    const { federation, groups, failures } = await crawlNuligaFederation({
      federationCode,
      seasonName,
      fetchText,
      delayMs,
      onProgress: (done) => {
        if (done % 100 === 0) {
          console.log(`  … ${federationCode.toUpperCase()}: ${done} Staffeln gelesen`);
        }
      },
    });

    const existingActiveGroups = await prisma.leagueGroup.count({
      where: {
        countryCode: federation.countryCode,
        federationCode: federation.federationCode,
        seasonName,
        isActive: true,
      },
    });

    const safetyGuardTriggered = shouldTriggerDeactivationSafetyGuard({
      existingActiveGroups,
      crawledGroups: groups.length,
      minKeepRatio: options.minKeepRatio,
      minExistingForGuard: options.minExistingForGuard,
    });

    if (safetyGuardTriggered) {
      console.warn(
        `[Safety-Guard] ${federation.federationCode}: Nur ${groups.length} statt bisher ${existingActiveGroups} Staffeln gefunden. Bestehender Bestand bleibt geschützt.`
      );
      if (runRecord) {
        await prisma.directorySyncRun.update({
          where: { id: runRecord.id },
          data: {
            countryCode: federation.countryCode,
            status: "ABORTED_SAFETY_GUARD",
            groupsSynced: groups.length,
            errorCount: failures.length,
            errorSample: failures.slice(0, 20) as unknown as Prisma.InputJsonValue,
            finishedAt: new Date(),
          },
        });
      }

      return {
        countryCode: federation.countryCode,
        federationCode: federation.federationCode,
        provider,
        seasonName,
        status: "ABORTED_SAFETY_GUARD",
        groups: groups.length,
        teams: 0,
        deactivatedGroups: 0,
        deactivatedTeams: 0,
        safetyGuardTriggered: true,
        failures,
      };
    }

    if (dryRun) {
      const teamsTotal = groups.reduce((acc, g) => acc + g.teams.length, 0);
      return {
        countryCode: federation.countryCode,
        federationCode: federation.federationCode,
        provider,
        seasonName,
        status: failures.length > 0 ? "PARTIAL" : "SUCCESS",
        groups: groups.length,
        teams: teamsTotal,
        deactivatedGroups: 0,
        deactivatedTeams: 0,
        safetyGuardTriggered: false,
        failures,
      };
    }

    let teamsTotal = 0;
    let deactivatedTeams = 0;
    const keptGroupCodes: string[] = [];

    for (const group of groups) {
      const leagueCode = buildFederationLeagueCode(
        group.countryCode,
        group.federationCode,
        group.ageGroup,
        group.gender,
        group.name
      );
      const leagueId = leagueCode ? (leagueIdByCode.get(leagueCode) ?? null) : null;

      const data = {
        countryCode: group.countryCode,
        federationCode: group.federationCode,
        regionCode: group.regionCode,
        regionName: group.regionName,
        seasonName: group.seasonName,
        leagueId,
        ageGroup: group.ageGroup,
        gender: group.gender,
        name: group.name,
        externalProvider: provider,
        externalGroupId: group.externalGroupId,
        externalUrl: group.externalUrl,
        providerMeta: group.providerMeta
          ? (group.providerMeta as Prisma.InputJsonValue)
          : Prisma.JsonNull,
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
            externalClubId: team.externalClubId ?? null,
            externalUrl: team.externalUrl,
            isActive: true,
          },
          create: {
            leagueGroupId: saved.id,
            externalTeamId: team.externalTeamId,
            externalClubId: team.externalClubId ?? null,
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
        countryCode: federation.countryCode,
        federationCode: federation.federationCode,
        seasonName,
        isActive: true,
        code: { notIn: keptGroupCodes },
      },
      data: { isActive: false },
    });

    const finalStatus: DirectorySyncRunStatus =
      failures.length > 0 ? "PARTIAL" : "SUCCESS";

    if (runRecord) {
      await prisma.directorySyncRun.update({
        where: { id: runRecord.id },
        data: {
          countryCode: federation.countryCode,
          status: finalStatus,
          groupsSynced: groups.length,
          teamsSynced: teamsTotal,
          deactivatedGroups: staleGroups.count,
          deactivatedTeams,
          errorCount: failures.length,
          errorSample:
            failures.length > 0
              ? (failures.slice(0, 20) as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          finishedAt: new Date(),
        },
      });
    }

    return {
      countryCode: federation.countryCode,
      federationCode: federation.federationCode,
      provider,
      seasonName,
      status: finalStatus,
      groups: groups.length,
      teams: teamsTotal,
      deactivatedGroups: staleGroups.count,
      deactivatedTeams,
      safetyGuardTriggered: false,
      failures,
    };
  } catch (err) {
    if (runRecord) {
      await prisma.directorySyncRun.update({
        where: { id: runRecord.id },
        data: {
          status: "ERROR",
          errorCount: 1,
          errorSample: [
            {
              url: federationCode,
              reason: err instanceof Error ? err.message : String(err),
            },
          ] as unknown as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      });
    }
    throw err;
  }
}

export async function importAllNuligaFederationsLive(
  prisma: PrismaClient,
  options: ImportFederationOptions & { countryCode?: string } = {}
): Promise<ImportFederationLiveResult[]> {
  const targets = getNuligaFederations(options.countryCode);
  const results: ImportFederationLiveResult[] = [];

  for (const fed of targets) {
    const result = await importNuligaFederationLive(
      prisma,
      fed.federationCode,
      options
    );
    results.push(result);
  }

  return results;
}
