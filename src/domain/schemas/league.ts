import { z } from "zod";

export const LeagueProviderTypeSchema = z.enum([
  "ICAL_URL",
  "CSV_MANUAL",
  "HVNB_NULIGA",
  "NULIGA",
  "HANDBALL360",
  "HANDBALL4ALL",
]);
export type LeagueProviderType = z.infer<typeof LeagueProviderTypeSchema>;

export const DirectorySyncRunStatusSchema = z.enum([
  "RUNNING",
  "SUCCESS",
  "PARTIAL",
  "ERROR",
  "ABORTED_SAFETY_GUARD",
]);
export type DirectorySyncRunStatus = z.infer<
  typeof DirectorySyncRunStatusSchema
>;

/** Normalisiert Legacy-Provider (HVNB_NULIGA -> NULIGA) für den Adapter-Dispatch. */
export function normalizeProviderType(
  provider: LeagueProviderType
): LeagueProviderType {
  return provider === "HVNB_NULIGA" ? "NULIGA" : provider;
}

export function isNuligaProvider(provider: LeagueProviderType): boolean {
  return provider === "HVNB_NULIGA" || provider === "NULIGA";
}

export function isDirectoryManagedProvider(
  provider: LeagueProviderType
): boolean {
  return (
    provider === "HVNB_NULIGA" ||
    provider === "NULIGA" ||
    provider === "HANDBALL360" ||
    provider === "HANDBALL4ALL"
  );
}

export function isAutoSyncProvider(provider: LeagueProviderType): boolean {
  return (
    provider === "ICAL_URL" ||
    provider === "HVNB_NULIGA" ||
    provider === "NULIGA" ||
    provider === "HANDBALL360" ||
    provider === "HANDBALL4ALL"
  );
}

export const LEAGUE_PROVIDER_LABELS: Record<LeagueProviderType, string> = {
  ICAL_URL: "iCal-Feed",
  CSV_MANUAL: "CSV-Import",
  HVNB_NULIGA: "nuLiga (HVNB)",
  NULIGA: "nuLiga",
  HANDBALL360: "Handball360 / handball.net",
  HANDBALL4ALL: "Handball4All",
};

export const SyncStatusSchema = z.enum(["NEVER", "SUCCESS", "ERROR"]);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const SyncChangeTypeSchema = z.enum([
  "CREATED",
  "RESCHEDULED",
  "VENUE_CHANGED",
  "CANCELLED",
  "UPDATED",
]);
export type SyncChangeType = z.infer<typeof SyncChangeTypeSchema>;

export const SYNC_CHANGE_TYPE_LABELS: Record<SyncChangeType, string> = {
  CREATED: "Neues Spiel",
  RESCHEDULED: "Spielverlegung",
  VENUE_CHANGED: "Hallenwechsel",
  CANCELLED: "Spiel abgesagt",
  UPDATED: "Aktualisiert",
};

export const ProviderConfigSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional();
export type ProviderConfig = Record<string, unknown>;

export const CreateLeagueSourceSchema = z
  .object({
    provider: LeagueProviderTypeSchema.default("ICAL_URL"),
    leagueGroupTeamId: z.string().trim().min(1).nullable().optional(),
    name: z.string().trim().min(2, "Bezeichnung erforderlich.").max(120),
    sourceUrl: z
      .string()
      .trim()
      .url("Bitte gültige iCal-URL (https://...) eingeben.")
      .nullable()
      .or(z.literal("").transform(() => null))
      .optional(),
    teamNameMatch: z.string().trim().max(100).nullable().optional(),
    providerConfig: ProviderConfigSchema,
    isEnabled: z.boolean().default(true),
    syncIntervalMinutes: z.number().int().min(15).max(1440).default(60),
  })
  .superRefine((val, ctx) => {
    if (val.provider === "ICAL_URL" && !val.sourceUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Für eine iCal-Quelle muss eine URL angegeben werden.",
        path: ["sourceUrl"],
      });
    }
  });
export type CreateLeagueSourceInput = z.infer<typeof CreateLeagueSourceSchema>;

export const TriggerIcalSyncSchema = z.object({
  /** Optional: Direkter .ics-Inhalt (z. B. Datei-Upload oder Test-Sync ohne externe URL) */
  icalContent: z.string().min(10).optional(),
});
export type TriggerIcalSyncInput = z.infer<typeof TriggerIcalSyncSchema>;

export const CsvColumnMappingSchema = z.object({
  dateColumn: z.string().trim().min(1, "Datumsspalte erforderlich."),
  timeColumn: z.string().trim().optional().nullable(),
  homeTeamColumn: z.string().trim().min(1, "Heimteam-Spalte erforderlich."),
  awayTeamColumn: z.string().trim().min(1, "Gastteam-Spalte erforderlich."),
  venueColumn: z.string().trim().optional().nullable(),
  externalIdColumn: z.string().trim().optional().nullable(),
  scoreColumn: z.string().trim().optional().nullable(),
  halfScoreColumn: z.string().trim().optional().nullable(),
  delimiter: z.enum([";", ","]).default(";"),
});
export type CsvColumnMapping = z.infer<typeof CsvColumnMappingSchema>;

export const CsvLeagueImportSchema = z.object({
  sourceName: z.string().trim().min(2).max(120).default("CSV Spielplan-Import"),
  teamNameMatch: z
    .string()
    .trim()
    .min(
      2,
      "Eigener Mannschafts-/Vereinsname zur Heim/Auswärts-Erkennung erforderlich."
    )
    .max(100),
  csvContent: z.string().min(10, "CSV-Inhalt darf nicht leer sein."),
  mapping: CsvColumnMappingSchema,
});
export type CsvLeagueImportInput = z.infer<typeof CsvLeagueImportSchema>;

export interface LeagueImportSourceDTO {
  id: string;
  clubId: string;
  teamId: string;
  leagueGroupTeamId?: string | null;
  provider: LeagueProviderType;
  name: string;
  sourceUrl: string | null;
  teamNameMatch: string | null;
  providerConfig?: ProviderConfig | null;
  isEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncedAt: string | null;
  lastSyncStatus: SyncStatus;
  lastSyncError: string | null;
  consecutiveErrors?: number;
  createdAt: string;
}

export interface LeagueSyncChangeLogDTO {
  id: string;
  sourceId: string;
  sourceName?: string;
  teamId: string;
  eventId: string | null;
  externalId: string;
  changeType: SyncChangeType;
  summary: string;
  oldStartAt: string | null;
  newStartAt: string | null;
  oldVenueName: string | null;
  newVenueName: string | null;
  detectedAt: string;
}

export interface SyncRunSummaryDTO {
  sourceId: string;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  resultsUpdatedCount?: number;
  changes: LeagueSyncChangeLogDTO[];
}

export interface DirectorySyncRunDTO {
  id: string;
  countryCode: string;
  federationCode: string;
  provider: LeagueProviderType;
  seasonName: string;
  status: DirectorySyncRunStatus;
  groupsSynced: number;
  teamsSynced: number;
  deactivatedGroups: number;
  deactivatedTeams: number;
  errorCount: number;
  startedAt: string;
  finishedAt: string | null;
}
