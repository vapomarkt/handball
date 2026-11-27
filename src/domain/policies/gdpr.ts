import { RsvpStatus } from "../schemas/handball";
import {
  TeamMemberEntity,
  TeamMemberPublicDTO,
  TeamMemberResponseDTO,
  TeamMemberSensitiveDTO,
} from "../schemas/member";
import { isClubAdmin, isTeamStaff, ViewerContext } from "./rbac";

/**
 * Verbindliche DSGVO-Feldsichtbarkeits-Regel (API-Layer):
 * Sensible Felder (emergencyContact, passNumber, injuryNote, private Kontaktdaten)
 * dürfen NUR an CLUB_ADMIN, COACH, ASSISTANT_COACH, TEAM_MANAGER des jeweiligen Teams,
 * den betroffenen User selbst oder verknüpfte PARENT-Accounts ausgeliefert werden.
 */
export function canViewSensitiveMemberFields(
  viewer: ViewerContext,
  member: Pick<TeamMemberEntity, "id" | "clubId" | "teamId" | "userId">
): boolean {
  if (isClubAdmin(viewer, member.clubId)) {
    return true;
  }
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

/**
 * Serverseitige DTO-Projektion für TeamMember.
 * Garantiert, dass nicht berechtigte Rollen (insb. PLAYER, HELPER, fremde PARENT)
 * niemals sensible Felder im JSON-Payload erhalten.
 */
export function projectTeamMemberDTO(
  viewer: ViewerContext,
  member: TeamMemberEntity
): TeamMemberResponseDTO {
  const baseProfile: Omit<TeamMemberPublicDTO, "canViewSensitive"> = {
    id: member.id,
    clubId: member.clubId,
    teamId: member.teamId,
    isClaimed: member.userId !== null,
    role: member.role,
    isClubAdmin: Boolean(member.isClubAdmin || member.role === "CLUB_ADMIN"),
    firstName: member.firstName,
    lastName: member.lastName,
    jerseyNumber: member.jerseyNumber,
    primaryPosition: member.primaryPosition,
    secondaryPosition: member.secondaryPosition,
    throwingHand: member.throwingHand,
    availabilityStatus: member.availabilityStatus,
    teamRoles: [...member.teamRoles],
    isMinor: member.isMinor,
  };

  if (!canViewSensitiveMemberFields(viewer, member)) {
    const publicDto: TeamMemberPublicDTO = {
      ...baseProfile,
      canViewSensitive: false,
    };
    return publicDto;
  }

  const sensitiveDto: TeamMemberSensitiveDTO = {
    ...baseProfile,
    canViewSensitive: true,
    userId: member.userId,
    passNumber: member.passNumber,
    injuryNote: member.injuryNote,
    emergencyContact: member.emergencyContact,
    email: member.email,
    phone: member.phone,
  };
  return sensitiveDto;
}

/**
 * DSGVO-Projektion für RSVP-Rückmeldungen (vorbereitet für M2a, getestet ab M1):
 * Ein PLAYER sieht den RSVP-Status von Mitspielern, aber NIEMALS fremde Absagegründe (declineReason).
 */
export interface AttendanceEntityLike {
  id: string;
  eventId: string;
  memberId: string;
  clubId: string;
  teamId: string;
  memberUserId: string | null;
  status: RsvpStatus;
  declineReason: string | null;
}

export interface AttendancePublicDTO {
  id: string;
  eventId: string;
  memberId: string;
  status: RsvpStatus;
}

export interface AttendanceSensitiveDTO extends AttendancePublicDTO {
  declineReason: string | null;
}

export function projectAttendanceDTO(
  viewer: ViewerContext,
  attendance: AttendanceEntityLike
): AttendancePublicDTO | AttendanceSensitiveDTO {
  const allowed = canViewSensitiveMemberFields(viewer, {
    id: attendance.memberId,
    clubId: attendance.clubId,
    teamId: attendance.teamId,
    userId: attendance.memberUserId,
  });

  if (!allowed) {
    return {
      id: attendance.id,
      eventId: attendance.eventId,
      memberId: attendance.memberId,
      status: attendance.status,
    };
  }

  return {
    id: attendance.id,
    eventId: attendance.eventId,
    memberId: attendance.memberId,
    status: attendance.status,
    declineReason: attendance.declineReason,
  };
}

import type {
  EventAttendanceEntity,
  EventAttendancePublicDTO,
  EventAttendanceResponseDTO,
  EventAttendanceSensitiveDTO,
} from "../schemas/event";

/**
 * Vollständige DSGVO-DTO-Projektion für EventAttendance (M2a):
 * Entfernt `declineReason` und `declineReasonCategory` serverseitig für alle
 * unberechtigten Rollen (PLAYER bei Mitspielern, HELPER, fremde PARENT).
 */
export function projectEventAttendanceDTO(
  viewer: ViewerContext,
  attendance: EventAttendanceEntity
): EventAttendanceResponseDTO {
  const allowed = canViewSensitiveMemberFields(viewer, {
    id: attendance.memberId,
    clubId: attendance.clubId,
    teamId: attendance.teamId,
    userId: attendance.memberUserId,
  });

  const base = {
    id: attendance.id,
    eventId: attendance.eventId,
    memberId: attendance.memberId,
    memberFirstName: attendance.memberFirstName,
    memberLastName: attendance.memberLastName,
    memberJerseyNumber: attendance.memberJerseyNumber,
    memberPrimaryPosition: attendance.memberPrimaryPosition,
    status: attendance.status,
    respondedAt: attendance.respondedAt
      ? attendance.respondedAt.toISOString()
      : null,
  };

  if (!allowed) {
    const publicDto: EventAttendancePublicDTO = {
      ...base,
      canViewSensitive: false,
    };
    return publicDto;
  }

  const sensitiveDto: EventAttendanceSensitiveDTO = {
    ...base,
    canViewSensitive: true,
    declineReasonCategory: attendance.declineReasonCategory,
    declineReason: attendance.declineReason,
  };
  return sensitiveDto;
}
