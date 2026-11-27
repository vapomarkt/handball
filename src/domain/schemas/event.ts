import { z } from "zod";
import { RsvpStatus, RsvpStatusSchema } from "./handball";
import type { JerseySetSummaryDTO } from "./jersey-set";

export const ResinPolicySchema = z.enum([
  "RESIN_ALLOWED",
  "RESIN_FORBIDDEN",
  "WATER_SOLUBLE_ONLY",
  "UNKNOWN",
]);
export type ResinPolicy = z.infer<typeof ResinPolicySchema>;

export const RESIN_POLICY_LABELS: Record<ResinPolicy, string> = {
  RESIN_ALLOWED: "Harz erlaubt",
  RESIN_FORBIDDEN: "Harz verboten",
  WATER_SOLUBLE_ONLY: "Nur wasserlösliches Harz",
  UNKNOWN: "Harz-Regelung unbekannt",
};

export const EventTypeSchema = z.enum([
  "TRAINING",
  "MATCH",
  "TOURNAMENT",
  "CLUB_EVENT",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  TRAINING: "Training",
  MATCH: "Punktspiel",
  TOURNAMENT: "Turnier",
  CLUB_EVENT: "Vereinstermin",
};

export const MatchOutcomeSchema = z.enum(["WIN", "LOSS", "DRAW"]);
export type MatchOutcome = z.infer<typeof MatchOutcomeSchema>;

export const MATCH_OUTCOME_LABELS: Record<MatchOutcome, string> = {
  WIN: "Gewonnen",
  LOSS: "Verloren",
  DRAW: "Unentschieden",
};

/**
 * Ermittelt aus Sicht der eigenen Mannschaft, ob ein Spiel gewonnen, verloren
 * oder unentschieden ausgegangen ist. Gibt `null` zurück, solange kein Endstand vorliegt.
 */
export function getMatchOutcome(matchDetails: {
  isHome: boolean;
  homeScoreFull: number | null;
  awayScoreFull: number | null;
}): MatchOutcome | null {
  if (
    matchDetails.homeScoreFull === null ||
    matchDetails.awayScoreFull === null
  ) {
    return null;
  }
  const ownScore = matchDetails.isHome
    ? matchDetails.homeScoreFull
    : matchDetails.awayScoreFull;
  const opponentScore = matchDetails.isHome
    ? matchDetails.awayScoreFull
    : matchDetails.homeScoreFull;

  if (ownScore > opponentScore) return "WIN";
  if (ownScore < opponentScore) return "LOSS";
  return "DRAW";
}

/**
 * Formatiert den Spielstand als `Heim:Gast` (optional inkl. Halbzeitstand in Klammern).
 */
export function formatMatchScore(matchDetails: {
  homeScoreFull: number | null;
  awayScoreFull: number | null;
  homeScoreHalf?: number | null;
  awayScoreHalf?: number | null;
}): string | null {
  if (
    matchDetails.homeScoreFull === null ||
    matchDetails.awayScoreFull === null
  ) {
    return null;
  }
  const full = `${matchDetails.homeScoreFull}:${matchDetails.awayScoreFull}`;
  if (
    matchDetails.homeScoreHalf !== null &&
    matchDetails.homeScoreHalf !== undefined &&
    matchDetails.awayScoreHalf !== null &&
    matchDetails.awayScoreHalf !== undefined
  ) {
    return `${full} (${matchDetails.homeScoreHalf}:${matchDetails.awayScoreHalf})`;
  }
  return full;
}

export function hasOfficialMatchScore(matchDetails: {
  officialHomeScoreFull?: number | null;
  officialAwayScoreFull?: number | null;
}): boolean {
  return (
    matchDetails.officialHomeScoreFull !== null &&
    matchDetails.officialHomeScoreFull !== undefined &&
    matchDetails.officialAwayScoreFull !== null &&
    matchDetails.officialAwayScoreFull !== undefined
  );
}

/**
 * Formatiert das offiziell gemeldete Liga-Ergebnis als `Heim:Gast` (inkl. Halbzeitstand, falls vorhanden).
 */
export function formatOfficialMatchScore(matchDetails: {
  officialHomeScoreFull?: number | null;
  officialAwayScoreFull?: number | null;
  officialHomeScoreHalf?: number | null;
  officialAwayScoreHalf?: number | null;
}): string | null {
  if (!hasOfficialMatchScore(matchDetails)) return null;
  return formatMatchScore({
    homeScoreFull: matchDetails.officialHomeScoreFull!,
    awayScoreFull: matchDetails.officialAwayScoreFull!,
    homeScoreHalf: matchDetails.officialHomeScoreHalf ?? null,
    awayScoreHalf: matchDetails.officialAwayScoreHalf ?? null,
  });
}

/**
 * Prüft, ob zwischen dem lokal angezeigten Spielstand und dem offiziell gemeldeten
 * Liga-Ergebnis (nuLiga) eine Abweichung im Endstand oder Halbzeitstand besteht.
 */
export function hasOfficialScoreDiscrepancy(matchDetails: {
  homeScoreFull: number | null;
  awayScoreFull: number | null;
  homeScoreHalf?: number | null;
  awayScoreHalf?: number | null;
  officialHomeScoreFull?: number | null;
  officialAwayScoreFull?: number | null;
  officialHomeScoreHalf?: number | null;
  officialAwayScoreHalf?: number | null;
}): boolean {
  if (
    !hasOfficialMatchScore(matchDetails) ||
    matchDetails.homeScoreFull === null ||
    matchDetails.awayScoreFull === null
  ) {
    return false;
  }

  if (
    matchDetails.homeScoreFull !== matchDetails.officialHomeScoreFull ||
    matchDetails.awayScoreFull !== matchDetails.officialAwayScoreFull
  ) {
    return true;
  }

  const localHasHalf =
    matchDetails.homeScoreHalf !== null &&
    matchDetails.homeScoreHalf !== undefined &&
    matchDetails.awayScoreHalf !== null &&
    matchDetails.awayScoreHalf !== undefined;
  const officialHasHalf =
    matchDetails.officialHomeScoreHalf !== null &&
    matchDetails.officialHomeScoreHalf !== undefined &&
    matchDetails.officialAwayScoreHalf !== null &&
    matchDetails.officialAwayScoreHalf !== undefined;

  if (
    localHasHalf &&
    officialHasHalf &&
    (matchDetails.homeScoreHalf !== matchDetails.officialHomeScoreHalf ||
      matchDetails.awayScoreHalf !== matchDetails.officialAwayScoreHalf)
  ) {
    return true;
  }

  return false;
}

export const DeclineReasonCategorySchema = z.enum([
  "WORK",
  "INJURY",
  "VACATION",
  "SCHOOL_UNI",
  "OTHER",
]);
export type DeclineReasonCategory = z.infer<typeof DeclineReasonCategorySchema>;

export const DECLINE_REASON_CATEGORY_LABELS: Record<
  DeclineReasonCategory,
  string
> = {
  WORK: "Arbeit / Beruf",
  INJURY: "Verletzung / Krankheit",
  VACATION: "Urlaub",
  SCHOOL_UNI: "Schule / Studium",
  OTHER: "Sonstiges",
};

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  ACCEPTED: "Zugesagt",
  DECLINED: "Abgesagt",
  MAYBE: "Vielleicht",
  PENDING: "Offen",
};

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional();

// ============================================================================
// Hallen (Venue)
// ============================================================================

export const CreateVenueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Hallenname muss mindestens 2 Zeichen lang sein.")
    .max(120),
  address: optionalTrimmed(200),
  mapsUrl: z
    .string()
    .trim()
    .url("Bitte gültige Karten-URL (https://...) eingeben.")
    .nullable()
    .or(z.literal("").transform(() => null))
    .optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  resinPolicy: ResinPolicySchema.default("UNKNOWN"),
  notes: optionalTrimmed(500),
});
export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;

export const UpdateVenueSchema = CreateVenueSchema.partial();
export type UpdateVenueInput = z.infer<typeof UpdateVenueSchema>;

export interface VenueDTO {
  id: string;
  clubId: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  resinPolicy: ResinPolicy;
  notes: string | null;
}

// ============================================================================
// Termine & Serientermine (Event, EventRecurrence, MatchDetails)
// ============================================================================

export const MatchDetailsInputSchema = z.object({
  opponentName: z
    .string()
    .trim()
    .min(2, "Gegnername erforderlich.")
    .max(120),
  isHome: z.boolean().default(true),
  throwOffAt: z.string().datetime().nullable().optional(),
  jerseyColor: optionalTrimmed(60),
  jerseySetId: z.string().min(1).nullable().optional(),
  refereeNote: optionalTrimmed(200),
});
export type MatchDetailsInput = z.infer<typeof MatchDetailsInputSchema>;

export const UpdateMatchDetailsSchema = z.object({
  opponentName: z.string().trim().min(2).max(120).optional(),
  isHome: z.boolean().optional(),
  throwOffAt: z.string().datetime().nullable().optional(),
  jerseyColor: optionalTrimmed(60),
  jerseySetId: z.string().min(1).nullable().optional(),
  refereeNote: optionalTrimmed(200),
  nominatedMemberIds: z.array(z.string().min(1)).max(30).optional(),
  homeScoreHalf: z.number().int().min(0).max(99).nullable().optional(),
  awayScoreHalf: z.number().int().min(0).max(99).nullable().optional(),
  homeScoreFull: z.number().int().min(0).max(99).nullable().optional(),
  awayScoreFull: z.number().int().min(0).max(99).nullable().optional(),
});
export type UpdateMatchDetailsInput = z.infer<typeof UpdateMatchDetailsSchema>;

export const CreateEventSchema = z
  .object({
    type: EventTypeSchema,
    title: z.string().trim().min(2, "Titel erforderlich.").max(120),
    description: optionalTrimmed(1000),
    venueId: z.string().min(1).nullable().optional(),
    startAt: z.string().datetime("Ungültiges Startdatum."),
    endAt: z.string().datetime().nullable().optional(),
    meetingAt: z.string().datetime().nullable().optional(),
    rsvpDeadlineAt: z.string().datetime().nullable().optional(),
    requireDeclineReason: z.boolean().default(false),
    matchDetails: MatchDetailsInputSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "MATCH" && !val.matchDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Für ein Punktspiel muss ein Gegner angegeben werden.",
        path: ["matchDetails"],
      });
    }
  });
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: optionalTrimmed(1000),
  venueId: z.string().min(1).nullable().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().nullable().optional(),
  meetingAt: z.string().datetime().nullable().optional(),
  rsvpDeadlineAt: z.string().datetime().nullable().optional(),
  requireDeclineReason: z.boolean().optional(),
  isCancelled: z.boolean().optional(),
});
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const CreateRecurringEventsSchema = z.object({
  type: EventTypeSchema.default("TRAINING"),
  title: z.string().trim().min(2, "Titel erforderlich.").max(120),
  description: optionalTrimmed(1000),
  venueId: z.string().min(1).nullable().optional(),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Mindestens ein Wochentag muss gewählt werden.")
    .max(7),
  startTime: z.string().regex(timeRegex, "Uhrzeit im Format HH:mm erforderlich."),
  endTime: z.string().regex(timeRegex, "Endzeit im Format HH:mm erforderlich."),
  startDate: z.string().regex(isoDateRegex, "Startdatum YYYY-MM-DD erforderlich."),
  endDate: z.string().regex(isoDateRegex, "Enddatum YYYY-MM-DD erforderlich."),
  excludedDates: z
    .array(z.string().regex(isoDateRegex, "Ausnahmedatum YYYY-MM-DD."))
    .max(60)
    .default([]),
  rsvpDeadlineHours: z.number().int().min(1).max(168).nullable().optional(),
  requireDeclineReason: z.boolean().default(false),
});
export type CreateRecurringEventsInput = z.infer<
  typeof CreateRecurringEventsSchema
>;

// ============================================================================
// 1-Klick-RSVP & Statistiken
// ============================================================================

export const SubmitRsvpSchema = z.object({
  memberId: z.string().min(1, "Kader-Mitglied erforderlich."),
  status: RsvpStatusSchema,
  declineReasonCategory: DeclineReasonCategorySchema.nullable().optional(),
  declineReason: optionalTrimmed(300),
});
export type SubmitRsvpInput = z.infer<typeof SubmitRsvpSchema>;

export interface MatchDetailsDTO {
  id: string;
  eventId: string;
  opponentName: string;
  isHome: boolean;
  throwOffAt: string | null;
  jerseyColor: string | null;
  jerseySetId: string | null;
  jerseySet: JerseySetSummaryDTO | null;
  refereeNote: string | null;
  nominatedMemberIds: string[];
  homeScoreHalf: number | null;
  awayScoreHalf: number | null;
  homeScoreFull: number | null;
  awayScoreFull: number | null;
  scoreManuallyEdited: boolean;
  officialHomeScoreHalf: number | null;
  officialAwayScoreHalf: number | null;
  officialHomeScoreFull: number | null;
  officialAwayScoreFull: number | null;
}

export interface EventAttendanceEntity {
  id: string;
  eventId: string;
  memberId: string;
  clubId: string;
  teamId: string;
  memberUserId: string | null;
  memberFirstName: string;
  memberLastName: string;
  memberJerseyNumber: number | null;
  memberPrimaryPosition: string | null;
  status: RsvpStatus;
  declineReasonCategory: DeclineReasonCategory | null;
  declineReason: string | null;
  respondedAt: Date | null;
}

export interface EventAttendancePublicDTO {
  id: string;
  eventId: string;
  memberId: string;
  memberFirstName: string;
  memberLastName: string;
  memberJerseyNumber: number | null;
  memberPrimaryPosition: string | null;
  status: RsvpStatus;
  respondedAt: string | null;
  canViewSensitive: false;
}

export interface EventAttendanceSensitiveDTO
  extends Omit<EventAttendancePublicDTO, "canViewSensitive"> {
  canViewSensitive: true;
  declineReasonCategory: DeclineReasonCategory | null;
  declineReason: string | null;
}

export type EventAttendanceResponseDTO =
  | EventAttendancePublicDTO
  | EventAttendanceSensitiveDTO;

export interface EventEntity {
  id: string;
  clubId: string;
  teamId: string;
  recurrenceId: string | null;
  venueId: string | null;
  venue: VenueDTO | null;
  type: EventType;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  meetingAt: Date | null;
  rsvpDeadlineAt: Date | null;
  requireDeclineReason: boolean;
  isCancelled: boolean;
  matchDetails: MatchDetailsDTO | null;
  attendances: EventAttendanceEntity[];
}

export interface EventDTO {
  id: string;
  clubId: string;
  teamId: string;
  recurrenceId: string | null;
  venueId: string | null;
  venue: VenueDTO | null;
  type: EventType;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  meetingAt: string | null;
  rsvpDeadlineAt: string | null;
  requireDeclineReason: boolean;
  isCancelled: boolean;
  matchDetails: MatchDetailsDTO | null;
  attendances: EventAttendanceResponseDTO[];
  summary: {
    accepted: number;
    declined: number;
    maybe: number;
    pending: number;
  };
}

export interface MemberAttendanceStatDTO {
  memberId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  primaryPosition: string | null;
  totalEvents: number;
  accepted: number;
  declined: number;
  maybe: number;
  pending: number;
  participationRate: number; // 0..100
}
