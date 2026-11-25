import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  LeagueAgeGroup,
  LeagueProviderType,
  PrismaClient,
  TeamGender,
} from "@prisma/client";
import { Pool } from "pg";
import {
  buildHvnbDirectorySeed,
  HvnbDirectoryGroupSeed,
} from "../src/domain/data/hvnb-directory-seed";

export interface ImportHvnbDirectoryResult {
  groupsUpserted: number;
  teamsUpserted: number;
  source: "seed" | "remote-feed";
}

async function loadHvnbSnapshot(): Promise<{
  groups: HvnbDirectoryGroupSeed[];
  source: "seed" | "remote-feed";
}> {
  const feedUrl = process.env.HVNB_DIRECTORY_FEED_URL?.trim();
  if (feedUrl) {
    const res = await fetch(feedUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(
        `HVNB-Verzeichnis-Feed fehlgeschlagen (HTTP ${res.status}): ${feedUrl}`
      );
    }
    const payload = (await res.json()) as
      | HvnbDirectoryGroupSeed[]
      | { groups: HvnbDirectoryGroupSeed[] };
    const groups = Array.isArray(payload) ? payload : payload.groups;
    if (!Array.isArray(groups)) {
      throw new Error(
        "Ungültiges Format im HVNB-Verzeichnis-Feed: Array von Staffeln erwartet."
      );
    }
    return { groups, source: "remote-feed" };
  }

  return { groups: buildHvnbDirectorySeed(), source: "seed" };
}

/**
 * Importiert HVNB-Staffeln (`league_group`) und deren offizielle Mannschaften
 * (`league_group_team`) idempotent in die Datenbank.
 */
export async function importHvnbDirectory(
  prisma: PrismaClient
): Promise<ImportHvnbDirectoryResult> {
  const { groups, source } = await loadHvnbSnapshot();
  let groupsUpserted = 0;
  let teamsUpserted = 0;

  for (const g of groups) {
    const league = await prisma.league.findUnique({
      where: { code: g.leagueCode },
      select: { id: true },
    });

    const savedGroup = await prisma.leagueGroup.upsert({
      where: { code: g.code },
      update: {
        federationCode: g.federationCode,
        regionCode: g.regionCode,
        regionName: g.regionName,
        seasonName: g.seasonName,
        leagueId: league?.id ?? null,
        ageGroup: g.ageGroup as LeagueAgeGroup,
        gender: g.gender as TeamGender,
        name: g.name,
        shortName: g.shortName ?? null,
        externalProvider: g.externalProvider as LeagueProviderType,
        externalGroupId: g.externalGroupId ?? null,
        externalUrl: g.externalUrl ?? null,
        isActive: true,
        lastSyncedAt: new Date(),
      },
      create: {
        code: g.code,
        federationCode: g.federationCode,
        regionCode: g.regionCode,
        regionName: g.regionName,
        seasonName: g.seasonName,
        leagueId: league?.id ?? null,
        ageGroup: g.ageGroup as LeagueAgeGroup,
        gender: g.gender as TeamGender,
        name: g.name,
        shortName: g.shortName ?? null,
        externalProvider: g.externalProvider as LeagueProviderType,
        externalGroupId: g.externalGroupId ?? null,
        externalUrl: g.externalUrl ?? null,
        isActive: true,
        lastSyncedAt: new Date(),
      },
    });
    groupsUpserted += 1;

    for (const t of g.teams) {
      await prisma.leagueGroupTeam.upsert({
        where: {
          leagueGroupId_externalTeamId: {
            leagueGroupId: savedGroup.id,
            externalTeamId: t.externalTeamId,
          },
        },
        update: {
          name: t.name,
          clubName: t.clubName,
          shortName: t.shortName ?? null,
          icalUrl: t.icalUrl ?? null,
          externalUrl: t.externalUrl ?? null,
          isActive: true,
        },
        create: {
          leagueGroupId: savedGroup.id,
          externalTeamId: t.externalTeamId,
          name: t.name,
          clubName: t.clubName,
          shortName: t.shortName ?? null,
          icalUrl: t.icalUrl ?? null,
          externalUrl: t.externalUrl ?? null,
          isActive: true,
        },
      });
      teamsUpserted += 1;
    }
  }

  return { groupsUpserted, teamsUpserted, source };
}

async function runCli() {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "Keine Datenbank-URL gefunden (DATABASE_URL / POSTGRES_PRISMA_URL / POSTGRES_URL)."
    );
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    console.log("Starte Import des HVNB-Staffel- und Mannschaftsverzeichnisses...");
    const result = await importHvnbDirectory(prisma);
    console.log(
      `HVNB-Verzeichnis-Import (${result.source}) abgeschlossen: ${result.groupsUpserted} Staffeln, ${result.teamsUpserted} Mannschaften synchronisiert.`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("import-hvnb-directory.ts") ||
    process.argv[1].endsWith("import-hvnb-directory.js"));

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error("Fehler beim Import des HVNB-Verzeichnisses:", err);
    process.exit(1);
  });
}
