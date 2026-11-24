import { z } from "zod";

export const DutyScopeSchema = z.enum(["CLUB_MATCHDAY", "TEAM"]);
export type DutyScope = z.infer<typeof DutyScopeSchema>;

export const DUTY_SCOPE_LABELS: Record<DutyScope, string> = {
  CLUB_MATCHDAY: "Heimspieltag (Verein)",
  TEAM: "Team-Dienst",
};

export const DutyCategorySchema = z.enum([
  "TIMEKEEPER",
  "SECRETARY",
  "HALL_SETUP",
  "KIOSK",
  "TICKETING",
  "REFEREE_CARE",
  "ANNOUNCER",
  "JERSEY_LAUNDRY",
  "EQUIPMENT_BAG",
  "DRINKS",
  "OTHER",
]);
export type DutyCategory = z.infer<typeof DutyCategorySchema>;

export const DUTY_CATEGORY_LABELS: Record<DutyCategory, string> = {
  TIMEKEEPER: "Kampfgericht: Zeitnehmer",
  SECRETARY: "Kampfgericht: Sekretär",
  HALL_SETUP: "Hallendienst / Auf- & Abbau",
  KIOSK: "Kiosk / Theke",
  TICKETING: "Kasse / Eintritt",
  REFEREE_CARE: "Schiedsrichter-Betreuung",
  ANNOUNCER: "Hallensprecher",
  JERSEY_LAUNDRY: "Trikotwäsche",
  EQUIPMENT_BAG: "Bälle / Harz / Erste-Hilfe-Tasche",
  DRINKS: "Getränke",
  OTHER: "Sonstiger Dienst",
};

export const DutyAssignmentStatusSchema = z.enum([
  "OPEN",
  "ASSIGNED",
  "SWAP_REQUESTED",
  "COMPLETED",
]);
export type DutyAssignmentStatus = z.infer<typeof DutyAssignmentStatusSchema>;

export const DUTY_ASSIGNMENT_STATUS_LABELS: Record<
  DutyAssignmentStatus,
  string
> = {
  OPEN: "Offen",
  ASSIGNED: "Besetzt",
  SWAP_REQUESTED: "Tausch gesucht",
  COMPLETED: "Erledigt",
};

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional();

export const CreateMatchdaySchema = z.object({
  title: z.string().trim().min(2, "Titel erforderlich.").max(120),
  date: z.string().datetime("Gültiges Datum erforderlich."),
  venueId: z.string().min(1).nullable().optional(),
  seasonId: z.string().min(1).nullable().optional(),
  notes: optionalTrimmed(500),
});
export type CreateMatchdayInput = z.infer<typeof CreateMatchdaySchema>;

export const CreateWorkDutySchema = z.object({
  scope: DutyScopeSchema.default("CLUB_MATCHDAY"),
  teamId: z.string().min(1).nullable().optional(),
  matchdayId: z.string().min(1).nullable().optional(),
  eventId: z.string().min(1).nullable().optional(),
  category: DutyCategorySchema.default("OTHER"),
  title: z.string().trim().min(2, "Titel erforderlich.").max(120),
  description: optionalTrimmed(500),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  hoursCredit: z.number().min(0.25).max(24).default(2.0),
  requiresLicense: z.boolean().default(false),
  slotsNeeded: z.number().int().min(1).max(20).default(1),
  assignedTeamId: z.string().min(1).nullable().optional(),
  initialAssignedMemberId: z.string().min(1).nullable().optional(),
});
export type CreateWorkDutyInput = z.infer<typeof CreateWorkDutySchema>;

export const ClaimDutySchema = z.object({
  memberId: z.string().min(1, "Mitgliedsprofil erforderlich."),
});
export type ClaimDutyInput = z.infer<typeof ClaimDutySchema>;

export const SwapDutySchema = z.object({
  action: z.enum(["REQUEST_SWAP", "ACCEPT_SWAP", "CANCEL_SWAP"]),
  swapNote: optionalTrimmed(200),
  replacementMemberId: z.string().min(1).optional(),
});
export type SwapDutyInput = z.infer<typeof SwapDutySchema>;

export interface MatchdayDTO {
  id: string;
  clubId: string;
  seasonId: string | null;
  venueId: string | null;
  venueName: string | null;
  title: string;
  date: string;
  notes: string | null;
  dutyCount: number;
}

export interface WorkDutyAssignmentDTO {
  id: string;
  dutyId: string;
  assignedMemberId: string | null;
  assignedMemberFirstName: string | null;
  assignedMemberLastName: string | null;
  assignedMemberUserId: string | null;
  assignedMemberTeamName: string | null;
  status: DutyAssignmentStatus;
  swapNote: string | null;
  completedAt: string | null;
}

export interface WorkDutyDTO {
  id: string;
  clubId: string;
  teamId: string | null;
  teamName: string | null;
  matchdayId: string | null;
  matchdayTitle: string | null;
  eventId: string | null;
  scope: DutyScope;
  category: DutyCategory;
  title: string;
  description: string | null;
  startAt: string | null;
  endAt: string | null;
  hoursCredit: number;
  requiresLicense: boolean;
  slotsNeeded: number;
  assignedTeamId: string | null;
  assignedTeamName: string | null;
  assignments: WorkDutyAssignmentDTO[];
  openSlots: number;
}

export interface MemberWorkHoursDTO {
  memberId: string;
  firstName: string;
  lastName: string;
  role: string;
  completedDuties: number;
  completedHours: number;
  plannedDuties: number;
  plannedHours: number;
  targetHours: number;
  remainingHours: number;
  fulfillmentPercent: number;
}

export interface TeamWorkHoursSummaryDTO {
  teamId: string;
  annualTargetHours: number;
  totalCompletedHours: number;
  totalPlannedHours: number;
  members: MemberWorkHoursDTO[];
}
