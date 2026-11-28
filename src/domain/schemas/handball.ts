import { z } from "zod";

export const MemberRoleSchema = z.enum([
  "CLUB_ADMIN",
  "COACH",
  "ASSISTANT_COACH",
  "TEAM_MANAGER",
  "TREASURER",
  "PLAYER",
  "PARENT",
  "HELPER",
]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

/** Kanonische Reihenfolge für die Anzeige mehrerer Rollen eines Mitglieds. */
export const MEMBER_ROLE_ORDER: readonly MemberRole[] = [
  "CLUB_ADMIN",
  "COACH",
  "ASSISTANT_COACH",
  "TEAM_MANAGER",
  "TREASURER",
  "PLAYER",
  "PARENT",
  "HELPER",
];

/**
 * Priorität für die primäre Team-Rolle (`role`-Feld).
 * `CLUB_ADMIN` steht bewusst zuletzt, damit eine Personalunion wie
 * Trainer + Vereins-Admin als primäre Team-Rolle `COACH` behält.
 */
const PRIMARY_TEAM_ROLE_PRIORITY: readonly MemberRole[] = [
  "COACH",
  "ASSISTANT_COACH",
  "TEAM_MANAGER",
  "TREASURER",
  "PLAYER",
  "PARENT",
  "HELPER",
  "CLUB_ADMIN",
];

export const COACHING_STAFF_ROLES: readonly MemberRole[] = [
  "CLUB_ADMIN",
  "COACH",
  "ASSISTANT_COACH",
];

export const TEAM_STAFF_ROLES: readonly MemberRole[] = [
  "CLUB_ADMIN",
  "COACH",
  "ASSISTANT_COACH",
  "TEAM_MANAGER",
];

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  CLUB_ADMIN: "Vereins-Admin",
  COACH: "Trainer",
  ASSISTANT_COACH: "Co-Trainer",
  TEAM_MANAGER: "Betreuer",
  TREASURER: "Kassenwart",
  PLAYER: "Spieler",
  PARENT: "Elternteil",
  HELPER: "Vereinshelfer",
};

export const MEMBER_ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  CLUB_ADMIN: "Verwaltet Verein, Saisons, Hallen und alle Mannschaften.",
  COACH: "Leitet die Mannschaft, plant Training, Taktik, Termine und Kader.",
  ASSISTANT_COACH: "Unterstützt das Trainer-Team bei Kader, Terminen, Training und Taktik.",
  TEAM_MANAGER: "Kümmert sich um Organisation, Kader, Termine, Dienste und Notfallkontakte.",
  TREASURER: "Verwaltet die Mannschaftskasse, Buchungen, Zahlungsstatus und den Strafenkatalog.",
  PLAYER: "Sagt zu Terminen zu/ab, sieht Spielpläne, Fahrgemeinschaften und Dienste.",
  PARENT: "Verwaltet Zu-/Absagen, Fahrgemeinschaften und Notfallkontakte für verknüpfte Kinder.",
  HELPER: "Übernimmt Spieltags- und Vereinsdienste wie Zeitnehmer, Kiosk oder Hallenaufbau.",
};

export interface RoleBearingMember {
  role: MemberRole;
  roles?: readonly MemberRole[] | null;
  isClubAdmin?: boolean;
}

/**
 * Normalisiert Rollen aus `roles`, `role` und dem Legacy-Flag `isClubAdmin`
 * zu einer eindeutigen, nicht-leeren, kanonisch sortierten Rollenliste.
 */
export function normalizeMemberRoles(input: {
  roles?: readonly MemberRole[] | null;
  role?: MemberRole | null;
  isClubAdmin?: boolean;
}): MemberRole[] {
  const set = new Set<MemberRole>();
  if (input.roles && input.roles.length > 0) {
    for (const r of input.roles) {
      set.add(r);
    }
  } else if (input.role) {
    set.add(input.role);
  }
  if (input.isClubAdmin) {
    set.add("CLUB_ADMIN");
  }
  if (set.size === 0) {
    set.add("PLAYER");
  }
  return MEMBER_ROLE_ORDER.filter((r) => set.has(r));
}

/**
 * Ermittelt die primäre Team-Rolle (z. B. für Kompatibilität, Sortierung & Tour).
 */
export function getPrimaryMemberRole(
  roles: readonly MemberRole[],
  preferred?: MemberRole | null
): MemberRole {
  if (preferred && roles.includes(preferred)) {
    return preferred;
  }
  for (const candidate of PRIMARY_TEAM_ROLE_PRIORITY) {
    if (roles.includes(candidate)) {
      return candidate;
    }
  }
  return roles[0] ?? "PLAYER";
}

export function getEffectiveRoles(
  member: RoleBearingMember | null | undefined
): MemberRole[] {
  if (!member) return [];
  return normalizeMemberRoles({
    roles: member.roles,
    role: member.role,
    isClubAdmin: member.isClubAdmin,
  });
}

export function hasMemberRole(
  member: RoleBearingMember | null | undefined,
  role: MemberRole
): boolean {
  if (!member) return false;
  return getEffectiveRoles(member).includes(role);
}

export function hasAnyMemberRole(
  member: RoleBearingMember | null | undefined,
  targetRoles: readonly MemberRole[]
): boolean {
  if (!member) return false;
  const effective = getEffectiveRoles(member);
  return targetRoles.some((r) => effective.includes(r));
}

export function isStaffMember(
  member: RoleBearingMember | null | undefined
): boolean {
  return hasAnyMemberRole(member, TEAM_STAFF_ROLES);
}

export function isCoachingStaffMember(
  member: RoleBearingMember | null | undefined
): boolean {
  return hasAnyMemberRole(member, COACHING_STAFF_ROLES);
}

export function isTreasurerMember(
  member: RoleBearingMember | null | undefined
): boolean {
  return hasMemberRole(member, "TREASURER");
}

export function formatMemberRoles(
  roles: readonly MemberRole[],
  separator = " · "
): string {
  const normalized = normalizeMemberRoles({ roles });
  return normalized.map((r) => MEMBER_ROLE_LABELS[r]).join(separator);
}

export const HandballPositionSchema = z.enum([
  "TW",
  "LA",
  "RL",
  "RM",
  "RR",
  "RA",
  "KM",
]);
export type HandballPosition = z.infer<typeof HandballPositionSchema>;

export const HANDBALL_POSITION_LABELS: Record<
  HandballPosition,
  { short: string; full: string }
> = {
  TW: { short: "TW", full: "Torwart" },
  LA: { short: "LA", full: "Linksaußen" },
  RL: { short: "RL", full: "Rückraum Links" },
  RM: { short: "RM", full: "Rückraum Mitte" },
  RR: { short: "RR", full: "Rückraum Rechts" },
  RA: { short: "RA", full: "Rechtsaußen" },
  KM: { short: "KM", full: "Kreismitte" },
};

export const ThrowingHandSchema = z.enum(["RIGHT", "LEFT", "BOTH"]);
export type ThrowingHand = z.infer<typeof ThrowingHandSchema>;

export const THROWING_HAND_LABELS: Record<ThrowingHand, string> = {
  RIGHT: "Rechts",
  LEFT: "Links",
  BOTH: "Beidhändig",
};

export const AvailabilityStatusSchema = z.enum([
  "FIT",
  "INJURED",
  "UNAVAILABLE",
]);
export type AvailabilityStatus = z.infer<typeof AvailabilityStatusSchema>;

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  FIT: "Fit",
  INJURED: "Verletzt",
  UNAVAILABLE: "Nicht verfügbar",
};

export const TeamGenderSchema = z.enum(["MALE", "FEMALE", "MIXED"]);
export type TeamGender = z.infer<typeof TeamGenderSchema>;

export const TEAM_GENDER_LABELS: Record<TeamGender, string> = {
  MALE: "Männlich / Herren",
  FEMALE: "Weiblich / Damen",
  MIXED: "Gemischt",
};

export const InviteTypeSchema = z.enum([
  "TEAM_JOIN",
  "PROFILE_CLAIM",
  "GUARDIAN_LINK",
]);
export type InviteType = z.infer<typeof InviteTypeSchema>;

export const INVITE_TYPE_LABELS: Record<InviteType, string> = {
  TEAM_JOIN: "Team-Einladung",
  PROFILE_CLAIM: "Profil übernehmen",
  GUARDIAN_LINK: "Eltern-Verknüpfung",
};

export const RsvpStatusSchema = z.enum([
  "ACCEPTED",
  "DECLINED",
  "MAYBE",
  "PENDING",
]);
export type RsvpStatus = z.infer<typeof RsvpStatusSchema>;

export const COMMON_TEAM_ROLES = [
  "Kapitän",
  "Vize-Kapitän",
  "Trikot-Verantwortlicher",
  "Harz- & Ballwart",
  "Mannschaftsrat",
] as const;

export function getCommonTeamRoles(usesResin: boolean): readonly string[] {
  if (usesResin) {
    return COMMON_TEAM_ROLES;
  }
  return COMMON_TEAM_ROLES.map((role) =>
    role === "Harz- & Ballwart" ? "Ballwart" : role
  );
}
