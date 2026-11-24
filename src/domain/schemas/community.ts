import { z } from "zod";

export const AnnouncementAudienceSchema = z.enum(["ALL", "STAFF_ONLY"]);
export type AnnouncementAudience = z.infer<typeof AnnouncementAudienceSchema>;

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudience, string> =
  {
    ALL: "Gesamtes Team & Eltern",
    STAFF_ONLY: "Nur Trainerteam",
  };

export const CashEntryTypeSchema = z.enum(["FINE", "INCOME", "EXPENSE"]);
export type CashEntryType = z.infer<typeof CashEntryTypeSchema>;

export const CASH_ENTRY_TYPE_LABELS: Record<CashEntryType, string> = {
  FINE: "Strafe",
  INCOME: "Einzahlung",
  EXPENSE: "Ausgabe",
};

export const CashEntryStatusSchema = z.enum(["OPEN", "PAID"]);
export type CashEntryStatus = z.infer<typeof CashEntryStatusSchema>;

export const CASH_ENTRY_STATUS_LABELS: Record<CashEntryStatus, string> = {
  OPEN: "Offen",
  PAID: "Bezahlt",
};

export const CreateAnnouncementSchema = z.object({
  title: z.string().trim().min(2, "Titel erforderlich.").max(140),
  body: z.string().trim().min(2, "Nachricht erforderlich.").max(4000),
  audience: AnnouncementAudienceSchema.default("ALL"),
  isPinned: z.boolean().default(false),
});
export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;

export const UpdateAnnouncementSchema = CreateAnnouncementSchema.partial();
export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementSchema>;

export interface TeamAnnouncementDTO {
  id: string;
  clubId: string;
  teamId: string;
  authorUserId: string;
  authorName: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CreatePollSchema = z.object({
  question: z.string().trim().min(3, "Frage erforderlich.").max(200),
  allowMultiple: z.boolean().default(false),
  options: z
    .array(z.string().trim().min(1, "Option darf nicht leer sein.").max(100))
    .min(2, "Mindestens 2 Antwortoptionen erforderlich.")
    .max(8, "Maximal 8 Antwortoptionen."),
});
export type CreatePollInput = z.infer<typeof CreatePollSchema>;

export const VotePollSchema = z.object({
  optionId: z.string().min(1, "Option erforderlich."),
});
export type VotePollInput = z.infer<typeof VotePollSchema>;

export interface TeamPollOptionDTO {
  id: string;
  label: string;
  sortOrder: number;
  voteCount: number;
  votedByMe: boolean;
}

export interface TeamPollDTO {
  id: string;
  clubId: string;
  teamId: string;
  createdByName: string;
  question: string;
  allowMultiple: boolean;
  isClosed: boolean;
  totalVotes: number;
  options: TeamPollOptionDTO[];
  createdAt: string;
}

export const CreateFineCatalogItemSchema = z.object({
  title: z.string().trim().min(2, "Bezeichnung erforderlich.").max(120),
  amountCents: z
    .number()
    .int("Betrag muss in Cent angegeben werden.")
    .min(50, "Mindestens 0,50 €.")
    .max(100_000, "Maximal 1.000,00 €."),
  category: z.string().trim().min(2).max(50).default("Allgemein"),
});
export type CreateFineCatalogItemInput = z.infer<
  typeof CreateFineCatalogItemSchema
>;

export interface FineCatalogItemDTO {
  id: string;
  clubId: string;
  teamId: string;
  title: string;
  amountCents: number;
  category: string;
}

const optionalNotes = z
  .string()
  .trim()
  .max(400)
  .nullable()
  .transform((v) => (v === "" ? null : v))
  .optional();

export const CreateCashEntrySchema = z.object({
  type: CashEntryTypeSchema.default("FINE"),
  status: CashEntryStatusSchema.optional(),
  memberId: z
    .string()
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional(),
  title: z.string().trim().min(2, "Beschreibung erforderlich.").max(140),
  amountCents: z
    .number()
    .int("Betrag in Cent erforderlich.")
    .min(50, "Mindestens 0,50 €.")
    .max(1_000_000, "Maximal 10.000,00 €."),
  notes: optionalNotes,
});
export type CreateCashEntryInput = z.infer<typeof CreateCashEntrySchema>;

export const UpdateCashEntryStatusSchema = z.object({
  status: CashEntryStatusSchema,
});
export type UpdateCashEntryStatusInput = z.infer<
  typeof UpdateCashEntryStatusSchema
>;

export interface TeamCashEntryDTO {
  id: string;
  clubId: string;
  teamId: string;
  memberId: string | null;
  memberName: string | null;
  type: CashEntryType;
  status: CashEntryStatus;
  title: string;
  amountCents: number;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface CashboxSummaryDTO {
  balanceCents: number;
  totalIncomeCents: number;
  totalPaidFinesCents: number;
  totalExpensesCents: number;
  openFinesTotalCents: number;
  openFinesCount: number;
  myOpenFinesCents: number;
  myOpenFinesCount: number;
}

export interface CashboxOverviewDTO {
  summary: CashboxSummaryDTO;
  entries: TeamCashEntryDTO[];
  catalog: FineCatalogItemDTO[];
  canManage: boolean;
}
