import { z } from "zod";

export const MemberRoleSchema = z.enum([
  "CLUB_ADMIN",
  "COACH",
  "ASSISTANT_COACH",
  "TEAM_MANAGER",
  "PLAYER",
  "PARENT",
  "HELPER",
]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  CLUB_ADMIN: "Vereins-Admin",
  COACH: "Trainer",
  ASSISTANT_COACH: "Co-Trainer",
  TEAM_MANAGER: "Betreuer",
  PLAYER: "Spieler",
  PARENT: "Elternteil",
  HELPER: "Vereinshelfer",
};

export const MEMBER_ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  CLUB_ADMIN: "Verwaltet Verein, Saisons, Hallen und alle Mannschaften.",
  COACH: "Leitet die Mannschaft, plant Training, Taktik, Termine und Kader.",
  ASSISTANT_COACH: "Unterstützt das Trainer-Team bei Kader, Terminen, Training und Taktik.",
  TEAM_MANAGER: "Kümmert sich um Organisation, Kader, Termine, Dienste, Kasse und Notfallkontakte.",
  PLAYER: "Sagt zu Terminen zu/ab, sieht Spielpläne, Fahrgemeinschaften und Dienste.",
  PARENT: "Verwaltet Zu-/Absagen, Fahrgemeinschaften und Notfallkontakte für verknüpfte Kinder.",
  HELPER: "Übernimmt Spieltags- und Vereinsdienste wie Zeitnehmer, Kiosk oder Hallenaufbau.",
};

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
  "Kassenwart",
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
