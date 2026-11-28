import {
  LeagueAgeGroup,
  LeagueProviderType,
  Prisma,
  TeamGender,
} from "@prisma/client";
import { DirectoryGroupSeed } from "@/domain/adapters/league-data-provider";
import {
  LeagueDirectoryFilter,
  LeagueDirectoryGroupTeamRecord,
  LeagueDirectoryRepository,
} from "@/domain/adapters/league-directory-repository";
import { HvnbDirectoryGroupSeed } from "@/domain/data/hvnb-directory-seed";
import { LeagueGroupDTO } from "@/domain/schemas/league-directory";
import { prisma } from "../db/prisma";

function toRecordOrNull(
  value: Prisma.JsonValue | null | undefined
): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export class PrismaLeagueDirectoryRepository
  implements LeagueDirectoryRepository
{
  async findGroupsWithTeams(
    filter: LeagueDirectoryFilter
  ): Promise<LeagueGroupDTO[]> {
    const rows = await prisma.leagueGroup.findMany({
      where: {
        isActive: true,
        ...(filter.countryCode ? { countryCode: filter.countryCode } : {}),
        ...(filter.federationCode
          ? { federationCode: filter.federationCode }
          : {}),
        ...(filter.seasonName ? { seasonName: filter.seasonName } : {}),
        ...(filter.ageGroup ? { ageGroup: filter.ageGroup } : {}),
        ...(filter.gender ? { gender: filter.gender } : {}),
        ...(filter.leagueId ? { leagueId: filter.leagueId } : {}),
        ...(filter.regionCode ? { regionCode: filter.regionCode } : {}),
      },
      include: {
        league: { select: { displayName: true } },
        teams: {
          where: { isActive: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: [{ federationCode: "asc" }, { regionName: "asc" }, { name: "asc" }],
    });

    return rows.map((g) => ({
      id: g.id,
      code: g.code,
      countryCode: g.countryCode,
      federationCode: g.federationCode,
      regionCode: g.regionCode,
      regionName: g.regionName,
      seasonName: g.seasonName,
      leagueId: g.leagueId,
      leagueDisplayName: g.league?.displayName ?? null,
      ageGroup: g.ageGroup,
      gender: g.gender,
      name: g.name,
      shortName: g.shortName,
      externalProvider: g.externalProvider,
      externalGroupId: g.externalGroupId,
      externalUrl: g.externalUrl,
      teams: g.teams.map((t) => ({
        id: t.id,
        leagueGroupId: t.leagueGroupId,
        externalTeamId: t.externalTeamId,
        externalClubId: t.externalClubId,
        name: t.name,
        clubName: t.clubName,
        shortName: t.shortName,
        hasIcalFeed: Boolean(t.icalUrl),
        externalUrl: t.externalUrl,
      })),
    }));
  }

  async findGroupTeamById(
    leagueGroupTeamId: string
  ): Promise<LeagueDirectoryGroupTeamRecord | null> {
    const row = await prisma.leagueGroupTeam.findUnique({
      where: { id: leagueGroupTeamId },
      include: {
        leagueGroup: {
          include: {
            league: { select: { displayName: true } },
            teams: {
              where: { isActive: true },
              select: { id: true, name: true, clubName: true, externalUrl: true },
              orderBy: { name: "asc" },
            },
          },
        },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      leagueGroupId: row.leagueGroupId,
      externalTeamId: row.externalTeamId,
      externalClubId: row.externalClubId,
      name: row.name,
      clubName: row.clubName,
      shortName: row.shortName,
      icalUrl: row.icalUrl,
      externalUrl: row.externalUrl,
      providerMeta: toRecordOrNull(row.providerMeta),
      group: {
        id: row.leagueGroup.id,
        code: row.leagueGroup.code,
        countryCode: row.leagueGroup.countryCode,
        federationCode: row.leagueGroup.federationCode,
        regionCode: row.leagueGroup.regionCode,
        regionName: row.leagueGroup.regionName,
        seasonName: row.leagueGroup.seasonName,
        leagueId: row.leagueGroup.leagueId,
        leagueDisplayName: row.leagueGroup.league?.displayName ?? null,
        ageGroup: row.leagueGroup.ageGroup,
        gender: row.leagueGroup.gender,
        name: row.leagueGroup.name,
        shortName: row.leagueGroup.shortName,
        externalProvider: row.leagueGroup.externalProvider,
        externalGroupId: row.leagueGroup.externalGroupId,
        externalUrl: row.leagueGroup.externalUrl,
        providerMeta: toRecordOrNull(row.leagueGroup.providerMeta),
      },
      siblingTeams: row.leagueGroup.teams,
    };
  }

  async updateGroupTeamIcalUrl(
    leagueGroupTeamId: string,
    icalUrl: string
  ): Promise<void> {
    await prisma.leagueGroupTeam.update({
      where: { id: leagueGroupTeamId },
      data: { icalUrl },
    });
  }

  async upsertDirectorySnapshot(
    groups: Array<DirectoryGroupSeed | HvnbDirectoryGroupSeed>
  ): Promise<{ groupsUpserted: number; teamsUpserted: number }> {
    let groupsUpserted = 0;
    let teamsUpserted = 0;

    for (const g of groups) {
      const league = g.leagueCode
        ? await prisma.league.findUnique({
            where: { code: g.leagueCode },
            select: { id: true },
          })
        : null;

      const countryCode = "countryCode" in g && g.countryCode ? g.countryCode : "DE";
      const providerMeta =
        "providerMeta" in g && g.providerMeta
          ? (g.providerMeta as Prisma.InputJsonValue)
          : Prisma.JsonNull;

      const savedGroup = await prisma.leagueGroup.upsert({
        where: { code: g.code },
        update: {
          countryCode,
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
          providerMeta,
          isActive: true,
          lastSyncedAt: new Date(),
        },
        create: {
          code: g.code,
          countryCode,
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
          providerMeta,
          isActive: true,
          lastSyncedAt: new Date(),
        },
      });
      groupsUpserted += 1;

      for (const t of g.teams) {
        const externalClubId =
          "externalClubId" in t ? (t.externalClubId ?? null) : null;
        const teamMeta =
          "providerMeta" in t && t.providerMeta
            ? (t.providerMeta as Prisma.InputJsonValue)
            : Prisma.JsonNull;

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
            externalClubId,
            shortName: t.shortName ?? null,
            icalUrl: t.icalUrl ?? null,
            externalUrl: t.externalUrl ?? null,
            providerMeta: teamMeta,
            isActive: true,
          },
          create: {
            leagueGroupId: savedGroup.id,
            externalTeamId: t.externalTeamId,
            externalClubId,
            name: t.name,
            clubName: t.clubName,
            shortName: t.shortName ?? null,
            icalUrl: t.icalUrl ?? null,
            externalUrl: t.externalUrl ?? null,
            providerMeta: teamMeta,
            isActive: true,
          },
        });
        teamsUpserted += 1;
      }
    }

    return { groupsUpserted, teamsUpserted };
  }
}
