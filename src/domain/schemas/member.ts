import { z } from "zod";
import {
  AvailabilityStatus,
  AvailabilityStatusSchema,
  HandballPosition,
  HandballPositionSchema,
  MemberRole,
  MemberRoleSchema,
  ThrowingHand,
  ThrowingHandSchema,
} from "./handball";
import { optionalPhoneSchema } from "./phone";

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional();

export const CreateTeamMemberSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname erforderlich.").max(60),
  lastName: z.string().trim().min(1, "Nachname erforderlich.").max(60),
  role: MemberRoleSchema.default("PLAYER"),
  jerseyNumber: z.number().int().min(1).max(99).optional().nullable(),
  primaryPosition: HandballPositionSchema.optional().nullable(),
  secondaryPosition: HandballPositionSchema.optional().nullable(),
  throwingHand: ThrowingHandSchema.optional().nullable(),
  availabilityStatus: AvailabilityStatusSchema.default("FIT"),
  teamRoles: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  isMinor: z.boolean().default(false),
  // DSGVO-geschützte sensible Felder
  passNumber: optionalTrimmedString(40),
  injuryNote: optionalTrimmedString(500),
  emergencyContact: optionalTrimmedString(200),
  email: z
    .string()
    .trim()
    .email("Ungültige E-Mail-Adresse.")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  phone: optionalPhoneSchema,
});
export type CreateTeamMemberInput = z.infer<typeof CreateTeamMemberSchema>;

export const UpdateTeamMemberSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  role: MemberRoleSchema.optional(),
  jerseyNumber: z.number().int().min(1).max(99).optional().nullable(),
  primaryPosition: HandballPositionSchema.optional().nullable(),
  secondaryPosition: HandballPositionSchema.optional().nullable(),
  throwingHand: ThrowingHandSchema.optional().nullable(),
  availabilityStatus: AvailabilityStatusSchema.optional(),
  teamRoles: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  isMinor: z.boolean().optional(),
  passNumber: optionalTrimmedString(40),
  injuryNote: optionalTrimmedString(500),
  emergencyContact: optionalTrimmedString(200),
  email: z
    .string()
    .trim()
    .email("Ungültige E-Mail-Adresse.")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  phone: optionalPhoneSchema,
});
export type UpdateTeamMemberInput = z.infer<typeof UpdateTeamMemberSchema>;

/**
 * Eingeschränkte Felder, die ein Mitglied selbst oder ein verknüpftes Elternteil bearbeiten darf
 * (kein Ändern der eigenen Rolle, Trikotnummer, Passnummer oder Team-Ämter).
 */
export const SelfUpdateMemberSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname erforderlich.").max(60).optional(),
  lastName: z.string().trim().min(1, "Nachname erforderlich.").max(60).optional(),
  primaryPosition: HandballPositionSchema.optional().nullable(),
  secondaryPosition: HandballPositionSchema.optional().nullable(),
  throwingHand: ThrowingHandSchema.optional().nullable(),
  availabilityStatus: AvailabilityStatusSchema.optional(),
  injuryNote: optionalTrimmedString(500),
  emergencyContact: optionalTrimmedString(200),
  phone: optionalPhoneSchema,
  email: z
    .string()
    .trim()
    .email("Ungültige E-Mail-Adresse.")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
});
export type SelfUpdateMemberInput = z.infer<typeof SelfUpdateMemberSchema>;

/**
 * Vollständige interne Domain-Entität (niemals direkt in API-Responses zurückgeben!)
 */
export interface TeamMemberEntity {
  id: string;
  clubId: string;
  teamId: string;
  userId: string | null;
  role: MemberRole;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jerseyNumber: number | null;
  primaryPosition: HandballPosition | null;
  secondaryPosition: HandballPosition | null;
  throwingHand: ThrowingHand | null;
  availabilityStatus: AvailabilityStatus;
  teamRoles: string[];
  isMinor: boolean;
  passNumber: string | null;
  injuryNote: string | null;
  emergencyContact: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DSGVO-sicheres sportliches Basisprofil für Mitspieler (PLAYER) & Helfer (HELPER).
 * Enthält KEINE sensiblen Felder (kein emergencyContact, passNumber, injuryNote, phone, email).
 */
export interface TeamMemberPublicDTO {
  id: string;
  clubId: string;
  teamId: string;
  isClaimed: boolean;
  role: MemberRole;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  primaryPosition: HandballPosition | null;
  secondaryPosition: HandballPosition | null;
  throwingHand: ThrowingHand | null;
  availabilityStatus: AvailabilityStatus;
  teamRoles: string[];
  isMinor: boolean;
  canViewSensitive: false;
}

/**
 * Erweitertes Profil für berechtigte Betrachter (CLUB_ADMIN, COACH, ASSISTANT_COACH,
 * betroffener User selbst, oder verknüpfter PARENT-Account).
 */
export interface TeamMemberSensitiveDTO
  extends Omit<TeamMemberPublicDTO, "canViewSensitive"> {
  canViewSensitive: true;
  userId: string | null;
  passNumber: string | null;
  injuryNote: string | null;
  emergencyContact: string | null;
  email: string | null;
  phone: string | null;
}

export type TeamMemberResponseDTO = TeamMemberPublicDTO | TeamMemberSensitiveDTO;
