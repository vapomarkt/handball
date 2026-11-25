import { MemberRole } from "../schemas/handball";
import { TeamMemberEntity } from "../schemas/member";

export interface ViewerMembership {
  memberId: string;
  clubId: string;
  teamId: string;
  role: MemberRole;
}

export interface ViewerContext {
  userId: string;
  email: string;
  name: string;
  memberships: ViewerMembership[];
  /** TeamMember-IDs der Kinder, für die dieser User per GuardianLink berechtigt ist */
  linkedChildMemberIds: string[];
  /** Team-IDs, in denen verknüpfte Kinder spielen (erlaubt PARENT Leserechte aufs Team) */
  linkedChildTeamIds: string[];
}

export function isClubAdmin(viewer: ViewerContext, clubId: string): boolean {
  return viewer.memberships.some(
    (m) => m.clubId === clubId && m.role === "CLUB_ADMIN"
  );
}

export function isAnyClubAdmin(viewer: ViewerContext): boolean {
  return viewer.memberships.some((m) => m.role === "CLUB_ADMIN");
}

export function getTeamRolesForViewer(
  viewer: ViewerContext,
  teamId: string
): MemberRole[] {
  return viewer.memberships
    .filter((m) => m.teamId === teamId)
    .map((m) => m.role);
}

export function isTeamStaff(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  if (isClubAdmin(viewer, clubId)) return true;
  const roles = getTeamRolesForViewer(viewer, teamId);
  return roles.includes("COACH") || roles.includes("ASSISTANT_COACH");
}

export function isTeamHeadCoachOrAdmin(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  if (isClubAdmin(viewer, clubId)) return true;
  const roles = getTeamRolesForViewer(viewer, teamId);
  return roles.includes("COACH");
}

export function canViewClub(viewer: ViewerContext, clubId: string): boolean {
  return viewer.memberships.some((m) => m.clubId === clubId);
}

export function canManageClub(viewer: ViewerContext, clubId: string): boolean {
  return isClubAdmin(viewer, clubId);
}

export function canCreateTeam(viewer: ViewerContext, clubId: string): boolean {
  if (isClubAdmin(viewer, clubId)) return true;
  return viewer.memberships.some(
    (m) => m.clubId === clubId && m.role === "COACH"
  );
}

export function canViewTeam(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  if (isClubAdmin(viewer, clubId)) return true;
  if (viewer.memberships.some((m) => m.teamId === teamId)) return true;
  if (viewer.linkedChildTeamIds.includes(teamId)) return true;
  return false;
}

export function canManageRoster(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  return isTeamStaff(viewer, teamId, clubId);
}

export function canDeleteMember(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  return isTeamHeadCoachOrAdmin(viewer, teamId, clubId);
}

export function canManageInvites(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  return isTeamStaff(viewer, teamId, clubId);
}

export function canManageGuardians(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  return isTeamStaff(viewer, teamId, clubId);
}

export type MemberEditScope = "FULL" | "SELF_OR_GUARDIAN" | "NONE";

export function getMemberEditScope(
  viewer: ViewerContext,
  member: Pick<TeamMemberEntity, "id" | "clubId" | "teamId" | "userId">
): MemberEditScope {
  if (isTeamStaff(viewer, member.teamId, member.clubId)) {
    return "FULL";
  }
  if (member.userId !== null && member.userId === viewer.userId) {
    return "SELF_OR_GUARDIAN";
  }
  if (viewer.linkedChildMemberIds.includes(member.id)) {
    return "SELF_OR_GUARDIAN";
  }
  return "NONE";
}

export function canManageVenues(viewer: ViewerContext, clubId: string): boolean {
  if (isClubAdmin(viewer, clubId)) return true;
  return viewer.memberships.some(
    (m) =>
      m.clubId === clubId &&
      (m.role === "COACH" || m.role === "ASSISTANT_COACH")
  );
}

export function canManageEvents(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  return isTeamStaff(viewer, teamId, clubId);
}

export function canSubmitRsvpForMember(
  viewer: ViewerContext,
  member: Pick<TeamMemberEntity, "id" | "clubId" | "teamId" | "userId">
): boolean {
  if (isTeamStaff(viewer, member.teamId, member.clubId)) {
    return true;
  }
  if (member.userId !== null && member.userId === viewer.userId) {
    return true;
  }
  if (viewer.linkedChildMemberIds.includes(member.id)) {
    return true;
  }
  return false;
}
