import {
  ClubRepository,
  ClubWithDetails,
  GuardianRepository,
  InviteRepository,
  InviteWithContext,
  MemberRepository,
  TeamRecord,
  TeamRepository,
  UserLookupRepository,
} from "@/domain/adapters/repositories";
import { ClubDTO, SeasonDTO } from "@/domain/schemas/club";
import { InviteType, MemberRole, TeamGender } from "@/domain/schemas/handball";
import { LeagueAgeGroup } from "@/domain/schemas/league-catalog";
import { GuardianLinkDTO, TeamInviteEntity } from "@/domain/schemas/invite";
import {
  CreateTeamMemberInput,
  TeamMemberEntity,
  UpdateTeamMemberInput,
} from "@/domain/schemas/member";
import { prisma } from "../db/prisma";

function mapClub(c: {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  city: string | null;
  logoUrl: string | null;
  createdAt: Date;
}): ClubDTO {
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    slug: c.slug,
    city: c.city,
    logoUrl: c.logoUrl,
    createdAt: c.createdAt.toISOString(),
  };
}

function mapSeason(s: {
  id: string;
  clubId: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
}): SeasonDTO {
  return {
    id: s.id,
    clubId: s.clubId,
    name: s.name,
    startDate: s.startDate ? s.startDate.toISOString() : null,
    endDate: s.endDate ? s.endDate.toISOString() : null,
    isActive: s.isActive,
  };
}

export class PrismaClubRepository implements ClubRepository {
  async findClubsForUser(userId: string): Promise<ClubDTO[]> {
    const clubs = await prisma.club.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      orderBy: { name: "asc" },
    });
    return clubs.map(mapClub);
  }

  async findByIdWithDetails(clubId: string): Promise<ClubWithDetails | null> {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        seasons: { orderBy: [{ isActive: "desc" }, { name: "desc" }] },
        teams: {
          include: {
            season: { select: { name: true } },
            leagueGroupTeam: {
              select: {
                id: true,
                name: true,
                leagueGroup: { select: { name: true } },
              },
            },
            _count: { select: { members: true } },
          },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!club) return null;

    return {
      club: mapClub(club),
      seasons: club.seasons.map(mapSeason),
      teams: club.teams.map((t) => ({
        id: t.id,
        clubId: t.clubId,
        seasonId: t.seasonId,
        name: t.name,
        category: t.category,
        ageGroup: t.ageGroup,
        gender: t.gender,
        usesResin: t.usesResin,
        leagueId: t.leagueId,
        leagueName: t.leagueName,
        leagueGroupTeamId: t.leagueGroupTeamId,
        leagueGroupName: t.leagueGroupTeam?.leagueGroup.name ?? null,
        leagueOfficialTeamName: t.leagueGroupTeam?.name ?? null,
        seasonName: t.season.name,
        clubName: club.name,
        memberCount: t._count.members,
      })),
    };
  }

  async findBySlug(slug: string): Promise<ClubDTO | null> {
    const club = await prisma.club.findUnique({ where: { slug } });
    return club ? mapClub(club) : null;
  }

  async createClubWithSeason(input: {
    name: string;
    shortName?: string | null;
    slug: string;
    city?: string | null;
    seasonName: string;
    seasonStartDate?: Date | null;
    seasonEndDate?: Date | null;
  }): Promise<{ club: ClubDTO; season: SeasonDTO }> {
    const result = await prisma.$transaction(async (tx) => {
      const club = await tx.club.create({
        data: {
          name: input.name,
          shortName: input.shortName ?? null,
          slug: input.slug,
          city: input.city ?? null,
        },
      });
      const season = await tx.season.create({
        data: {
          clubId: club.id,
          name: input.seasonName,
          startDate: input.seasonStartDate ?? null,
          endDate: input.seasonEndDate ?? null,
          isActive: true,
        },
      });
      return { club, season };
    });

    return {
      club: mapClub(result.club),
      season: mapSeason(result.season),
    };
  }

  async createSeason(input: {
    clubId: string;
    name: string;
    startDate?: Date | null;
    endDate?: Date | null;
    isActive: boolean;
  }): Promise<SeasonDTO> {
    const season = await prisma.season.create({
      data: {
        clubId: input.clubId,
        name: input.name,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        isActive: input.isActive,
      },
    });
    return mapSeason(season);
  }
}

const TEAM_INCLUDE = {
  season: { select: { name: true } },
  club: { select: { name: true } },
  leagueGroupTeam: {
    select: {
      id: true,
      name: true,
      leagueGroup: { select: { name: true } },
    },
  },
  _count: { select: { members: true } },
} as const;

export class PrismaTeamRepository implements TeamRepository {
  async findById(teamId: string): Promise<TeamRecord | null> {
    const t = await prisma.team.findUnique({
      where: { id: teamId },
      include: TEAM_INCLUDE,
    });
    if (!t) return null;
    return {
      id: t.id,
      clubId: t.clubId,
      seasonId: t.seasonId,
      name: t.name,
      category: t.category,
      ageGroup: t.ageGroup,
      gender: t.gender,
      usesResin: t.usesResin,
      leagueId: t.leagueId,
      leagueName: t.leagueName,
      leagueGroupTeamId: t.leagueGroupTeamId,
      leagueGroupName: t.leagueGroupTeam?.leagueGroup.name ?? null,
      leagueOfficialTeamName: t.leagueGroupTeam?.name ?? null,
      seasonName: t.season.name,
      clubName: t.club.name,
      memberCount: t._count.members,
    };
  }

  async findByClubId(clubId: string): Promise<TeamRecord[]> {
    const teams = await prisma.team.findMany({
      where: { clubId },
      include: TEAM_INCLUDE,
      orderBy: { name: "asc" },
    });
    return teams.map((t) => ({
      id: t.id,
      clubId: t.clubId,
      seasonId: t.seasonId,
      name: t.name,
      category: t.category,
      ageGroup: t.ageGroup,
      gender: t.gender,
      usesResin: t.usesResin,
      leagueId: t.leagueId,
      leagueName: t.leagueName,
      leagueGroupTeamId: t.leagueGroupTeamId,
      leagueGroupName: t.leagueGroupTeam?.leagueGroup.name ?? null,
      leagueOfficialTeamName: t.leagueGroupTeam?.name ?? null,
      seasonName: t.season.name,
      clubName: t.club.name,
      memberCount: t._count.members,
    }));
  }

  async create(input: {
    clubId: string;
    seasonId: string;
    name: string;
    category: string;
    ageGroup?: LeagueAgeGroup | null;
    gender: TeamGender;
    usesResin?: boolean;
    leagueId?: string | null;
    leagueName?: string | null;
    leagueGroupTeamId?: string | null;
  }): Promise<TeamRecord> {
    const t = await prisma.team.create({
      data: {
        clubId: input.clubId,
        seasonId: input.seasonId,
        name: input.name,
        category: input.category,
        ageGroup: input.ageGroup ?? null,
        gender: input.gender,
        usesResin: input.usesResin ?? true,
        leagueId: input.leagueId ?? null,
        leagueName: input.leagueName ?? null,
        leagueGroupTeamId: input.leagueGroupTeamId ?? null,
      },
      include: TEAM_INCLUDE,
    });
    return {
      id: t.id,
      clubId: t.clubId,
      seasonId: t.seasonId,
      name: t.name,
      category: t.category,
      ageGroup: t.ageGroup,
      gender: t.gender,
      usesResin: t.usesResin,
      leagueId: t.leagueId,
      leagueName: t.leagueName,
      leagueGroupTeamId: t.leagueGroupTeamId,
      leagueGroupName: t.leagueGroupTeam?.leagueGroup.name ?? null,
      leagueOfficialTeamName: t.leagueGroupTeam?.name ?? null,
      seasonName: t.season.name,
      clubName: t.club.name,
      memberCount: t._count.members,
    };
  }

  async update(
    teamId: string,
    input: {
      name?: string;
      category?: string;
      ageGroup?: LeagueAgeGroup | null;
      gender?: TeamGender;
      usesResin?: boolean;
      leagueId?: string | null;
      leagueName?: string | null;
      leagueGroupTeamId?: string | null;
    }
  ): Promise<TeamRecord> {
    const t = await prisma.team.update({
      where: { id: teamId },
      data: input,
      include: TEAM_INCLUDE,
    });
    return {
      id: t.id,
      clubId: t.clubId,
      seasonId: t.seasonId,
      name: t.name,
      category: t.category,
      ageGroup: t.ageGroup,
      gender: t.gender,
      usesResin: t.usesResin,
      leagueId: t.leagueId,
      leagueName: t.leagueName,
      leagueGroupTeamId: t.leagueGroupTeamId,
      leagueGroupName: t.leagueGroupTeam?.leagueGroup.name ?? null,
      leagueOfficialTeamName: t.leagueGroupTeam?.name ?? null,
      seasonName: t.season.name,
      clubName: t.club.name,
      memberCount: t._count.members,
    };
  }
}

export class PrismaMemberRepository implements MemberRepository {
  async findByTeamId(teamId: string): Promise<TeamMemberEntity[]> {
    return prisma.teamMember.findMany({
      where: { teamId },
      orderBy: [
        { role: "asc" },
        { jerseyNumber: "asc" },
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });
  }

  async findById(memberId: string): Promise<TeamMemberEntity | null> {
    return prisma.teamMember.findUnique({ where: { id: memberId } });
  }

  async findByTeamAndUser(
    teamId: string,
    userId: string
  ): Promise<TeamMemberEntity | null> {
    return prisma.teamMember.findFirst({
      where: { teamId, userId },
    });
  }

  async create(
    clubId: string,
    teamId: string,
    input: CreateTeamMemberInput & { userId?: string | null }
  ): Promise<TeamMemberEntity> {
    return prisma.teamMember.create({
      data: {
        clubId,
        teamId,
        userId: input.userId ?? null,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        jerseyNumber: input.jerseyNumber ?? null,
        primaryPosition: input.primaryPosition ?? null,
        secondaryPosition: input.secondaryPosition ?? null,
        throwingHand: input.throwingHand ?? null,
        availabilityStatus: input.availabilityStatus,
        teamRoles: input.teamRoles ?? [],
        isMinor: input.isMinor ?? false,
        passNumber: input.passNumber ?? null,
        injuryNote: input.injuryNote ?? null,
        emergencyContact: input.emergencyContact ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
      },
    });
  }

  async update(
    memberId: string,
    input: UpdateTeamMemberInput
  ): Promise<TeamMemberEntity> {
    return prisma.teamMember.update({
      where: { id: memberId },
      data: input,
    });
  }

  async assignUser(memberId: string, userId: string): Promise<TeamMemberEntity> {
    return prisma.teamMember.update({
      where: { id: memberId },
      data: { userId },
    });
  }

  async delete(memberId: string): Promise<void> {
    await prisma.teamMember.delete({ where: { id: memberId } });
  }
}

export class PrismaInviteRepository implements InviteRepository {
  async findByTeamId(teamId: string): Promise<
    Array<{
      invite: TeamInviteEntity;
      targetMemberName: string | null;
    }>
  > {
    const rows = await prisma.teamInvite.findMany({
      where: { teamId },
      include: {
        targetMember: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((r) => ({
      invite: r,
      targetMemberName: r.targetMember
        ? `${r.targetMember.firstName} ${r.targetMember.lastName}`
        : null,
    }));
  }

  async findById(inviteId: string): Promise<TeamInviteEntity | null> {
    return prisma.teamInvite.findUnique({ where: { id: inviteId } });
  }

  async findByTokenWithContext(
    tokenOrShortCode: string
  ): Promise<InviteWithContext | null> {
    const isShort = /^[A-Z0-9]{6}$/.test(tokenOrShortCode);
    const row = await prisma.teamInvite.findFirst({
      where: isShort
        ? { OR: [{ token: tokenOrShortCode }, { shortCode: tokenOrShortCode }] }
        : { token: tokenOrShortCode },
      include: {
        club: { select: { name: true, logoUrl: true } },
        team: {
          select: {
            name: true,
            season: { select: { name: true } },
          },
        },
        targetMember: true,
      },
    });
    if (!row) return null;

    return {
      invite: row,
      clubName: row.club.name,
      clubLogoUrl: row.club.logoUrl,
      teamName: row.team.name,
      seasonName: row.team.season.name,
      targetMember: row.targetMember,
    };
  }

  async findByShortCode(shortCode: string): Promise<TeamInviteEntity | null> {
    return prisma.teamInvite.findUnique({ where: { shortCode } });
  }

  async create(input: {
    clubId: string;
    teamId: string;
    token: string;
    shortCode?: string | null;
    type: InviteType;
    role: MemberRole;
    targetMemberId: string | null;
    createdByUserId: string;
    maxUses: number | null;
    expiresAt: Date;
  }): Promise<TeamInviteEntity> {
    return prisma.teamInvite.create({
      data: {
        ...input,
        shortCode: input.shortCode ?? null,
      },
    });
  }

  async incrementUsedCount(inviteId: string): Promise<void> {
    await prisma.teamInvite.update({
      where: { id: inviteId },
      data: { usedCount: { increment: 1 } },
    });
  }

  async revoke(inviteId: string): Promise<void> {
    await prisma.teamInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });
  }
}

export class PrismaGuardianRepository implements GuardianRepository {
  async findByGuardianUserId(userId: string): Promise<GuardianLinkDTO[]> {
    const rows = await prisma.guardianLink.findMany({
      where: { guardianUserId: userId },
      include: {
        guardianUser: { select: { name: true, email: true } },
        childMember: {
          select: {
            firstName: true,
            lastName: true,
            teamId: true,
            team: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((r) => ({
      id: r.id,
      guardianUserId: r.guardianUserId,
      guardianName: r.guardianUser.name,
      guardianEmail: r.guardianUser.email,
      childMemberId: r.childMemberId,
      childFirstName: r.childMember.firstName,
      childLastName: r.childMember.lastName,
      teamId: r.childMember.teamId,
      teamName: r.childMember.team.name,
      relationship: r.relationship,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async findByTeamId(teamId: string): Promise<GuardianLinkDTO[]> {
    const rows = await prisma.guardianLink.findMany({
      where: { childMember: { teamId } },
      include: {
        guardianUser: { select: { name: true, email: true } },
        childMember: {
          select: {
            firstName: true,
            lastName: true,
            teamId: true,
            team: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((r) => ({
      id: r.id,
      guardianUserId: r.guardianUserId,
      guardianName: r.guardianUser.name,
      guardianEmail: r.guardianUser.email,
      childMemberId: r.childMemberId,
      childFirstName: r.childMember.firstName,
      childLastName: r.childMember.lastName,
      teamId: r.childMember.teamId,
      teamName: r.childMember.team.name,
      relationship: r.relationship,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async findById(linkId: string) {
    const row = await prisma.guardianLink.findUnique({
      where: { id: linkId },
      include: {
        childMember: { select: { teamId: true, clubId: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      guardianUserId: row.guardianUserId,
      childMemberId: row.childMemberId,
      teamId: row.childMember.teamId,
      clubId: row.childMember.clubId,
    };
  }

  async exists(guardianUserId: string, childMemberId: string): Promise<boolean> {
    const count = await prisma.guardianLink.count({
      where: { guardianUserId, childMemberId },
    });
    return count > 0;
  }

  async create(input: {
    guardianUserId: string;
    childMemberId: string;
    relationship: string;
  }): Promise<GuardianLinkDTO> {
    const r = await prisma.guardianLink.create({
      data: input,
      include: {
        guardianUser: { select: { name: true, email: true } },
        childMember: {
          select: {
            firstName: true,
            lastName: true,
            teamId: true,
            team: { select: { name: true } },
          },
        },
      },
    });
    return {
      id: r.id,
      guardianUserId: r.guardianUserId,
      guardianName: r.guardianUser.name,
      guardianEmail: r.guardianUser.email,
      childMemberId: r.childMemberId,
      childFirstName: r.childMember.firstName,
      childLastName: r.childMember.lastName,
      teamId: r.childMember.teamId,
      teamName: r.childMember.team.name,
      relationship: r.relationship,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async delete(linkId: string): Promise<void> {
    await prisma.guardianLink.delete({ where: { id: linkId } });
  }
}

export class PrismaUserLookupRepository implements UserLookupRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true },
    });
  }
}
