import { ClubDTO, SeasonDTO, TeamDTO } from "../schemas/club";
import { InviteType, MemberRole, TeamGender } from "../schemas/handball";
import { LeagueAgeGroup } from "../schemas/league-catalog";
import {
  GuardianLinkDTO,
  TeamInviteEntity,
} from "../schemas/invite";
import {
  CreateTeamMemberInput,
  TeamMemberEntity,
  UpdateTeamMemberInput,
} from "../schemas/member";

export interface ClubWithDetails {
  club: ClubDTO;
  seasons: SeasonDTO[];
  teams: TeamDTO[];
}

export interface TeamRecord {
  id: string;
  clubId: string;
  seasonId: string;
  name: string;
  category: string;
  ageGroup?: LeagueAgeGroup | null;
  gender: TeamGender;
  usesResin?: boolean;
  leagueId?: string | null;
  leagueName: string | null;
  leagueGroupTeamId?: string | null;
  leagueGroupName?: string | null;
  leagueOfficialTeamName?: string | null;
  seasonName?: string;
  clubName?: string;
  memberCount?: number;
}

export interface ClubLogoRecord {
  data: Uint8Array;
  mimeType: string;
  updatedAt: Date;
}

export interface ClubRepository {
  findClubsForUser(userId: string): Promise<ClubDTO[]>;
  findByIdWithDetails(clubId: string): Promise<ClubWithDetails | null>;
  findBySlug(slug: string): Promise<ClubDTO | null>;
  findLogoById?(clubId: string): Promise<ClubLogoRecord | null>;
  updateLogo?(
    clubId: string,
    logo: { data: Uint8Array; mimeType: string; logoUrl: string } | null
  ): Promise<ClubDTO>;
  createClubWithSeason(input: {
    name: string;
    shortName?: string | null;
    slug: string;
    city?: string | null;
    seasonName: string;
    seasonStartDate?: Date | null;
    seasonEndDate?: Date | null;
  }): Promise<{ club: ClubDTO; season: SeasonDTO }>;
  createSeason(input: {
    clubId: string;
    name: string;
    startDate?: Date | null;
    endDate?: Date | null;
    isActive: boolean;
  }): Promise<SeasonDTO>;
}

export interface TeamRepository {
  findById(teamId: string): Promise<TeamRecord | null>;
  findByClubId(clubId: string): Promise<TeamRecord[]>;
  create(input: {
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
  }): Promise<TeamRecord>;
  update(
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
  ): Promise<TeamRecord>;
}

export interface MemberRepository {
  findByTeamId(teamId: string): Promise<TeamMemberEntity[]>;
  findById(memberId: string): Promise<TeamMemberEntity | null>;
  findByTeamAndUser(
    teamId: string,
    userId: string
  ): Promise<TeamMemberEntity | null>;
  create(
    clubId: string,
    teamId: string,
    input: CreateTeamMemberInput & { userId?: string | null }
  ): Promise<TeamMemberEntity>;
  update(
    memberId: string,
    input: UpdateTeamMemberInput
  ): Promise<TeamMemberEntity>;
  assignUser(memberId: string, userId: string): Promise<TeamMemberEntity>;
  delete(memberId: string): Promise<void>;
}

export interface InviteWithContext {
  invite: TeamInviteEntity;
  clubName: string;
  clubLogoUrl?: string | null;
  teamName: string;
  seasonName: string;
  targetMember: TeamMemberEntity | null;
}

export interface InviteRepository {
  findByTeamId(teamId: string): Promise<
    Array<{
      invite: TeamInviteEntity;
      targetMemberName: string | null;
    }>
  >;
  findById(inviteId: string): Promise<TeamInviteEntity | null>;
  findByTokenWithContext(tokenOrShortCode: string): Promise<InviteWithContext | null>;
  findByShortCode?(shortCode: string): Promise<TeamInviteEntity | null>;
  create(input: {
    clubId: string;
    teamId: string;
    token: string;
    shortCode?: string | null;
    type: InviteType;
    role: MemberRole;
    roles?: MemberRole[];
    targetMemberId: string | null;
    createdByUserId: string;
    maxUses: number | null;
    expiresAt: Date;
  }): Promise<TeamInviteEntity>;
  incrementUsedCount(inviteId: string): Promise<void>;
  revoke(inviteId: string): Promise<void>;
}

export interface GuardianRepository {
  findByGuardianUserId(userId: string): Promise<GuardianLinkDTO[]>;
  findByTeamId(teamId: string): Promise<GuardianLinkDTO[]>;
  findById(linkId: string): Promise<{
    id: string;
    guardianUserId: string;
    childMemberId: string;
    teamId: string;
    clubId: string;
  } | null>;
  exists(guardianUserId: string, childMemberId: string): Promise<boolean>;
  create(input: {
    guardianUserId: string;
    childMemberId: string;
    relationship: string;
  }): Promise<GuardianLinkDTO>;
  delete(linkId: string): Promise<void>;
}

export interface UserLookupRepository {
  findByEmail(email: string): Promise<{
    id: string;
    email: string;
    name: string;
  } | null>;
}
