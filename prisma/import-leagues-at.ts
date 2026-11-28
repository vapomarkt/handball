import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { LeagueAgeGroup, PrismaClient, TeamGender } from "@prisma/client";
import { Pool } from "pg";
import { buildAustrianLeaguesCatalog } from "../src/domain/data/austrian-leagues";

export interface ImportAustrianLeaguesResult {
  total: number;
}

/**
 * Importiert die österreichischen Handballligen (ÖHB, countryCode = "AT")
 * idempotent in die Tabelle `league`.
 */
export async function importAustrianLeagues(
  prisma: PrismaClient
): Promise<ImportAustrianLeaguesResult> {
  const entries = buildAustrianLeaguesCatalog();
  const BATCH_SIZE = 50;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((entry) =>
        prisma.league.upsert({
          where: { code: entry.code },
          update: {
            countryCode: entry.countryCode,
            federationCode: entry.federationCode,
            federationName: entry.federationName,
            ageGroup: entry.ageGroup as LeagueAgeGroup,
            gender: entry.gender as TeamGender,
            tier: entry.tier,
            name: entry.name,
            shortName: entry.shortName,
            displayName: entry.displayName,
            isActive: true,
          },
          create: {
            code: entry.code,
            countryCode: entry.countryCode,
            federationCode: entry.federationCode,
            federationName: entry.federationName,
            ageGroup: entry.ageGroup as LeagueAgeGroup,
            gender: entry.gender as TeamGender,
            tier: entry.tier,
            name: entry.name,
            shortName: entry.shortName,
            displayName: entry.displayName,
            isActive: true,
          },
        })
      )
    );
  }

  return { total: entries.length };
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
    console.log("Starte Import der österreichischen Handballligen (ÖHB)…");
    const result = await importAustrianLeagues(prisma);
    console.log(
      `Liga-Import Österreich abgeschlossen: ${result.total} Ligen (ÖHB) synchronisiert.`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("import-leagues-at.ts") ||
    process.argv[1].endsWith("import-leagues-at.js"));

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error("Fehler beim Import der österreichischen Handballligen:", err);
    process.exit(1);
  });
}
