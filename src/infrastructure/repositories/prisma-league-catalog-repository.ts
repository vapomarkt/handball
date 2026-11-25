import {
  LeagueCatalogFilter,
  LeagueCatalogRepository,
} from "@/domain/adapters/league-catalog-repository";
import { LeagueDTO } from "@/domain/schemas/league-catalog";
import { prisma } from "../db/prisma";

function toLeagueDTO(row: {
  id: string;
  code: string;
  countryCode: string;
  federationCode: string;
  federationName: string;
  ageGroup: LeagueDTO["ageGroup"];
  gender: LeagueDTO["gender"];
  tier: number;
  name: string;
  shortName: string | null;
  displayName: string;
}): LeagueDTO {
  return {
    id: row.id,
    code: row.code,
    countryCode: row.countryCode,
    federationCode: row.federationCode,
    federationName: row.federationName,
    ageGroup: row.ageGroup,
    gender: row.gender,
    tier: row.tier,
    name: row.name,
    shortName: row.shortName,
    displayName: row.displayName,
  };
}

export class PrismaLeagueCatalogRepository implements LeagueCatalogRepository {
  async findById(id: string): Promise<LeagueDTO | null> {
    const row = await prisma.league.findUnique({ where: { id } });
    return row && row.isActive ? toLeagueDTO(row) : null;
  }

  async findByCode(code: string): Promise<LeagueDTO | null> {
    const row = await prisma.league.findUnique({ where: { code } });
    return row && row.isActive ? toLeagueDTO(row) : null;
  }

  async findMany(filter: LeagueCatalogFilter): Promise<LeagueDTO[]> {
    const rows = await prisma.league.findMany({
      where: {
        isActive: true,
        countryCode: filter.countryCode,
        ...(filter.ageGroup ? { ageGroup: filter.ageGroup } : {}),
        ...(filter.gender ? { gender: filter.gender } : {}),
        ...(filter.federationCode
          ? { federationCode: filter.federationCode }
          : {}),
      },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    });
    return rows.map(toLeagueDTO);
  }
}
