import { LeagueAgeGroup, LeagueProviderType, TeamGender } from "@prisma/client";
import {
  LeagueDirectoryFilter,
  LeagueDirectoryGroupTeamRecord,
  LeagueDirectoryRepository,
} from "@/domain/adapters/league-directory-repository";
import { HvnbDirectoryGroupSeed } from "@/domain/data/hvnb-directory-seed";
import { LeagueGroupDTO } from "@/domain/schemas/league-directory";
import { prisma } from "../db/prisma";

export class PrismaLeagueDirectoryRepository
  implements LeagueDirectoryRepository
{
  async findGroupsWithTeams(
    filter: LeagueDirectoryFilter
  ): Promise<LeagueGroupDTO[]> {
    const rows = await prisma.leagueGroup.findMany({
      where: {
        isActive: true,
        federationCode: filter.federationCode,
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
      orderBy: [{ regionName: "asc" }, { name: "asc" }],
    });

    return rows.map((g) => ({
      id: g.id,
      code: g.code,
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
              select: { id: true, name: true, clubName: true },
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
      name: row.name,
      clubName: row.clubName,
      shortName: row.shortName,
      icalUrl: row.icalUrl,
      externalUrl: row.externalUrl,
      group: {
        id: row.leagueGroup.id,
        code: row.leagueGroup.code,
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
    groups: HvnbDirectoryGroupSeed[]
  ): Promise<{ groupsUpserted: number; teamsUpserted: number }> {
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

    return { groupsUpserted, teamsUpserted };
  }
}
