import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { LeagueAgeGroup, PrismaClient, TeamGender } from "@prisma/client";
import { Pool } from "pg";
import {
  buildGermanLeaguesCatalog,
  GERMAN_FEDERATIONS,
} from "../src/domain/data/german-leagues";

export interface ImportGermanLeaguesResult {
  total: number;
  federationCount: number;
}

/**
 * Importiert alle gängigen deutschen Handballligen (DHB + alle 18 Landesverbände,
 * von Erwachsenen bis Minis) idempotent in die Tabelle `league`.
 */
export async function importGermanLeagues(
  prisma: PrismaClient
): Promise<ImportGermanLeaguesResult> {
  const entries = buildGermanLeaguesCatalog();
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

  return {
    total: entries.length,
    federationCount: GERMAN_FEDERATIONS.length,
  };
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
    console.log("Starte Import der deutschen Handballligen (DHB & Landesverbände)...");
    const result = await importGermanLeagues(prisma);
    console.log(
      `Liga-Import Deutschland abgeschlossen: ${result.total} Ligen in ${result.federationCount} Verbänden synchronisiert.`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("import-leagues-de.ts") ||
    process.argv[1].endsWith("import-leagues-de.js"));

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error("Fehler beim Import der deutschen Handballligen:", err);
    process.exit(1);
  });
}
