import type {
  AvailabilityStatus,
  HandballPosition,
  MemberRole,
  ThrowingHand,
} from "../../../../src/domain/schemas/handball";
import type { GuardianLinkDTO } from "../../../../src/domain/schemas/invite";
import type { LeagueAgeGroup } from "../../../../src/domain/schemas/league-catalog";
import type {
  AuthMethodsSummaryDTO,
  UserOnboardingStateDTO,
} from "../../../../src/domain/schemas/onboarding-state";

/** Response shape of GET /api/v1/me (mirrors src/app/api/v1/me/route.ts). */
export interface ClubSummaryDTO {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  logoUrl: string | null;
}

export interface TeamSummaryDTO {
  id: string;
  name: string;
  category: string;
  ageGroup: LeagueAgeGroup | null;
  gender: "MALE" | "FEMALE" | "MIXED";
  usesResin: boolean;
  leagueName: string | null;
  seasonName: string;
}

export interface MeMembershipDTO {
  memberId: string;
  role: MemberRole;
  isClubAdmin?: boolean;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  primaryPosition: HandballPosition | null;
  secondaryPosition?: HandballPosition | null;
  throwingHand?: ThrowingHand | null;
  availabilityStatus: AvailabilityStatus;
  phone?: string | null;
  emergencyContact?: string | null;
  injuryNote?: string | null;
  club: ClubSummaryDTO;
  team: TeamSummaryDTO;
}

export interface MeGuardianLinkDTO extends GuardianLinkDTO {
  childEmergencyContact?: string | null;
  childInjuryNote?: string | null;
  childJerseyNumber?: number | null;
  childPrimaryPosition?: HandballPosition | null;
}

export interface MePayloadDTO {
  user: {
    id: string;
    email: string;
    name: string;
  };
  onboardingState?: UserOnboardingStateDTO;
  authMethods?: AuthMethodsSummaryDTO;
  memberships: MeMembershipDTO[];
  adminClubTeams: Array<TeamSummaryDTO & { club: ClubSummaryDTO }>;
  guardianLinks: MeGuardianLinkDTO[];
}

export interface SelectableTeamDTO {
  teamId: string;
  teamName: string;
  ageGroup: LeagueAgeGroup | null;
  usesResin: boolean;
  leagueName: string | null;
  seasonName: string;
  clubId: string;
  clubName: string;
  clubLogoUrl: string | null;
  role: MemberRole;
  isClubAdmin: boolean;
}

export function deriveSelectableTeams(me: MePayloadDTO): SelectableTeamDTO[] {
  const byTeamId = new Map<string, SelectableTeamDTO>();
  const adminClubIds = new Set(
    me.memberships
      .filter((m) => m.role === "CLUB_ADMIN" || Boolean(m.isClubAdmin))
      .map((m) => m.club.id)
  );

  for (const m of me.memberships) {
    byTeamId.set(m.team.id, {
      teamId: m.team.id,
      teamName: m.team.name,
      ageGroup: m.team.ageGroup,
      usesResin: m.team.usesResin,
      leagueName: m.team.leagueName,
      seasonName: m.team.seasonName,
      clubId: m.club.id,
      clubName: m.club.name,
      clubLogoUrl: m.club.logoUrl,
      role: m.role,
      isClubAdmin: adminClubIds.has(m.club.id),
    });
  }

  for (const t of me.adminClubTeams) {
    if (!byTeamId.has(t.id)) {
      byTeamId.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        ageGroup: t.ageGroup,
        usesResin: t.usesResin,
        leagueName: t.leagueName,
        seasonName: t.seasonName,
        clubId: t.club.id,
        clubName: t.club.name,
        clubLogoUrl: t.club.logoUrl,
        role: "CLUB_ADMIN",
        isClubAdmin: true,
      });
    }
  }

  return Array.from(byTeamId.values());
}
