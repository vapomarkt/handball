export type MemberRole =
  | "CLUB_ADMIN"
  | "COACH"
  | "ASSISTANT_COACH"
  | "PLAYER"
  | "PARENT"
  | "HELPER";

export type HandballPosition = "TW" | "LA" | "RL" | "RM" | "RR" | "RA" | "KM";

export type AvailabilityStatus = "FIT" | "INJURED" | "UNAVAILABLE";

export type LeagueAgeGroup =
  | "ADULT"
  | "YOUTH_A"
  | "YOUTH_B"
  | "YOUTH_C"
  | "YOUTH_D"
  | "YOUTH_E"
  | "YOUTH_F_MINI"
  | "SENIOR";

export type EventType = "TRAINING" | "MATCH" | "TOURNAMENT" | "CLUB_EVENT";

export type RsvpStatus = "ACCEPTED" | "DECLINED" | "MAYBE" | "PENDING";

export type DeclineReasonCategory =
  | "WORK"
  | "INJURY"
  | "VACATION"
  | "SCHOOL_UNI"
  | "OTHER";

export type ResinPolicy =
  | "RESIN_ALLOWED"
  | "RESIN_FORBIDDEN"
  | "WATER_SOLUBLE_ONLY"
  | "UNKNOWN";

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
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  primaryPosition: HandballPosition | null;
  availabilityStatus: AvailabilityStatus;
  club: ClubSummaryDTO;
  team: TeamSummaryDTO;
}

export interface GuardianLinkSummaryDTO {
  id: string;
  guardianUserId: string;
  childMemberId: string;
  relation: string | null;
  childMember?: {
    id: string;
    firstName: string;
    lastName: string;
    teamId: string;
  };
}

export interface MePayloadDTO {
  user: {
    id: string;
    email: string;
    name: string;
  };
  memberships: MeMembershipDTO[];
  adminClubTeams: Array<TeamSummaryDTO & { club: ClubSummaryDTO }>;
  guardianLinks: GuardianLinkSummaryDTO[];
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

export interface VenueSummaryDTO {
  id: string;
  name: string;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  resinPolicy?: ResinPolicy;
}

export interface EventRsvpSummaryDTO {
  id: string;
  memberId: string;
  status: RsvpStatus;
  declineReasonCategory?: DeclineReasonCategory | null;
  declineReasonNote?: string | null;
  respondedAt?: string | null;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    jerseyNumber?: number | null;
    primaryPosition?: HandballPosition | null;
    role?: MemberRole;
  };
}

export interface TeamEventDTO {
  id: string;
  teamId: string;
  type: EventType;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  meetingAt?: string | null;
  rsvpDeadlineAt?: string | null;
  isCancelled: boolean;
  venue?: VenueSummaryDTO | null;
  attendances?: EventRsvpSummaryDTO[];
  rsvpSummary?: {
    accepted: number;
    declined: number;
    maybe: number;
    pending: number;
  };
  matchDetails?: {
    opponentName?: string | null;
    isHome?: boolean;
    homeScore?: number | null;
    awayScore?: number | null;
  } | null;
}

export interface UpsertRsvpInput {
  memberId?: string;
  status: Exclude<RsvpStatus, "PENDING">;
  declineReasonCategory?: DeclineReasonCategory | null;
  declineReasonNote?: string | null;
}

export interface TeamMemberDTO {
  id: string;
  clubId: string;
  teamId: string;
  userId: string | null;
  role: MemberRole;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  primaryPosition: HandballPosition | null;
  secondaryPosition?: HandballPosition | null;
  availabilityStatus: AvailabilityStatus;
  isMinor?: boolean;
}

export interface AnnouncementDTO {
  id: string;
  teamId: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  authorName?: string | null;
}

export interface PollOptionDTO {
  id: string;
  label: string;
  voteCount: number;
  votedByMe?: boolean;
}

export interface PollDTO {
  id: string;
  teamId: string;
  question: string;
  description?: string | null;
  allowMultiple: boolean;
  closesAt?: string | null;
  createdAt: string;
  options: PollOptionDTO[];
}

export interface TacticPlayDTO {
  id: string;
  teamId: string;
  name: string;
  category: string;
  description?: string | null;
  updatedAt: string;
  frames?: unknown;
}

export interface ClubDutyDTO {
  id: string;
  clubId: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt?: string | null;
  requiredHelpers: number;
  assignedCount?: number;
  assignments?: Array<{
    id: string;
    memberId: string;
    status: string;
    memberName?: string;
  }>;
}

export interface CarpoolOfferDTO {
  id: string;
  eventId: string;
  driverName?: string;
  departureLocation: string;
  departureTime?: string | null;
  totalSeats: number;
  availableSeats: number;
  notes?: string | null;
}

export interface InviteInfoDTO {
  token: string;
  type: "TEAM_JOIN" | "PROFILE_CLAIM" | "GUARDIAN_LINK";
  clubName: string;
  teamName: string;
  role: MemberRole;
  expiresAt: string;
}

export function deriveSelectableTeams(me: MePayloadDTO): SelectableTeamDTO[] {
  const byTeamId = new Map<string, SelectableTeamDTO>();

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
      isClubAdmin: m.role === "CLUB_ADMIN",
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
