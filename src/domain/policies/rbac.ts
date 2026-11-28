import { getEffectiveRoles, MemberRole } from "../schemas/handball";
import { TeamMemberEntity } from "../schemas/member";

export interface ViewerMembership {
  memberId: string;
  clubId: string;
  teamId: string;
  role: MemberRole;
  roles?: MemberRole[];
  isClubAdmin?: boolean;
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

export function getMembershipRoles(membership: ViewerMembership): MemberRole[] {
  return getEffectiveRoles(membership);
}

export function isClubAdmin(viewer: ViewerContext, clubId: string): boolean {
  return viewer.memberships.some(
    (m) =>
      m.clubId === clubId && getMembershipRoles(m).includes("CLUB_ADMIN")
  );
}

export function isAnyClubAdmin(viewer: ViewerContext): boolean {
  return viewer.memberships.some((m) =>
    getMembershipRoles(m).includes("CLUB_ADMIN")
  );
}

export function getTeamRolesForViewer(
  viewer: ViewerContext,
  teamId: string
): MemberRole[] {
  const set = new Set<MemberRole>();
  for (const m of viewer.memberships) {
    if (m.teamId === teamId) {
      for (const r of getMembershipRoles(m)) {
        set.add(r);
      }
    }
  }
  return Array.from(set);
}

/**
 * Sportliche Leitung (Trainer-Team): CLUB_ADMIN, COACH, ASSISTANT_COACH.
 * Berechtigt für Taktiktafel, Trainingspläne, Übungen und Gegner-Scouting.
 */
export function isTeamCoachingStaff(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  if (isClubAdmin(viewer, clubId)) return true;
  const roles = getTeamRolesForViewer(viewer, teamId);
  return roles.includes("COACH") || roles.includes("ASSISTANT_COACH");
}

/**
 * Team-Leitung & Organisation: CLUB_ADMIN, COACH, ASSISTANT_COACH und TEAM_MANAGER (Betreuer).
 * Berechtigt für Kaderpflege, Einladungen, Termine, Hallen, Dienste, Fahrgemeinschaften & Notfallkontakte.
 * Hinweis: Änderungen an der Mannschaftskasse erfordern explizit die Rolle TREASURER (Kassenwart).
 */
export function isTeamStaff(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  if (isTeamCoachingStaff(viewer, teamId, clubId)) return true;
  const roles = getTeamRolesForViewer(viewer, teamId);
  return roles.includes("TEAM_MANAGER");
}

/**
 * Prüft, ob der Nutzer im Team explizit die Rolle Kassenwart (TREASURER) besitzt.
 */
export function isTeamTreasurer(
  viewer: ViewerContext,
  teamId: string
): boolean {
  return getTeamRolesForViewer(viewer, teamId).includes("TREASURER");
}

/**
 * Mannschaftskasse verwalten (Buchungen, Zahlungsstatus, Strafenkatalog):
 * Ausschließlich Mitglieder mit expliziter Rolle TREASURER (Kassenwart) im jeweiligen Team.
 */
export function canManageCashbox(
  viewer: ViewerContext,
  teamId: string
): boolean {
  return isTeamTreasurer(viewer, teamId);
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
    (m) => m.clubId === clubId && getMembershipRoles(m).includes("COACH")
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

export function canManageTacticsAndTraining(
  viewer: ViewerContext,
  teamId: string,
  clubId: string
): boolean {
  return isTeamCoachingStaff(viewer, teamId, clubId);
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
  return viewer.memberships.some((m) => {
    if (m.clubId !== clubId) return false;
    const roles = getMembershipRoles(m);
    return (
      roles.includes("COACH") ||
      roles.includes("ASSISTANT_COACH") ||
      roles.includes("TEAM_MANAGER")
    );
  });
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

export function canManageJerseySets(
  viewer: ViewerContext,
  clubId: string,
  teamId?: string | null
): boolean {
  if (teamId) {
    return isTeamStaff(viewer, teamId, clubId);
  }
  return canManageVenues(viewer, clubId);
}
