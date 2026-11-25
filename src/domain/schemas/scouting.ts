import { z } from "zod";
import {
  HandballPosition,
  HandballPositionSchema,
  ThrowingHand,
  ThrowingHandSchema,
} from "./handball";

export const ThreatLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type ThreatLevel = z.infer<typeof ThreatLevelSchema>;

export const THREAT_LEVEL_LABELS: Record<ThreatLevel, string> = {
  HIGH: "Schlüsselspieler (Hoch)",
  MEDIUM: "Wichtige Option (Mittel)",
  LOW: "Ergänzung (Niedrig)",
};

/**
 * 3x3 Tor-Wurfzonen-Heatmap (0..100 Prozent / Wurfintensität)
 */
export const ShotZonesSchema = z.object({
  topLeft: z.number().min(0).max(100).default(0),
  topCenter: z.number().min(0).max(100).default(0),
  topRight: z.number().min(0).max(100).default(0),
  midLeft: z.number().min(0).max(100).default(0),
  midCenter: z.number().min(0).max(100).default(0),
  midRight: z.number().min(0).max(100).default(0),
  botLeft: z.number().min(0).max(100).default(0),
  botCenter: z.number().min(0).max(100).default(0),
  botRight: z.number().min(0).max(100).default(0),
});
export type ShotZones = z.infer<typeof ShotZonesSchema>;

export const DEFAULT_SHOT_ZONES: ShotZones = {
  topLeft: 0,
  topCenter: 0,
  topRight: 0,
  midLeft: 0,
  midCenter: 0,
  midRight: 0,
  botLeft: 0,
  botCenter: 0,
  botRight: 0,
};

export const COMMON_DEFENSE_SYSTEMS = [
  "6:0 kompakt",
  "6:0 offensiv",
  "5:1 offensiv",
  "3:2:1",
  "4:2",
  "Manndeckung",
] as const;

export const COMMON_ATTACK_SYSTEMS = [
  "Kreuzung Rückraum",
  "Übergang 2. Kreis",
  "7-gegen-6",
  "Schnelle Mitte",
  "1. & 2. Welle",
  "Einläufer Außen",
] as const;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional();

const optionalUrl = z
  .string()
  .trim()
  .url("Bitte gültige URL (https://...) eingeben.")
  .nullable()
  .or(z.literal("").transform(() => null))
  .optional();

export const CreateOpponentSchema = z.object({
  name: z.string().trim().min(2, "Gegnername erforderlich.").max(120),
  leagueName: optionalTrimmed(100),
  externalUrl: optionalUrl,
  defenseSystems: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  attackSystems: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  transitionNotes: optionalTrimmed(600),
  strengths: optionalTrimmed(600),
  weaknesses: optionalTrimmed(600),
  generalNotes: optionalTrimmed(1000),
});
export type CreateOpponentInput = z.infer<typeof CreateOpponentSchema>;

export const UpdateOpponentSchema = CreateOpponentSchema.partial();
export type UpdateOpponentInput = z.infer<typeof UpdateOpponentSchema>;

export const CreateOpponentPlayerSchema = z.object({
  name: z.string().trim().min(2, "Spielername erforderlich.").max(100),
  externalPlayerId: optionalTrimmed(64),
  jerseyNumber: z.number().int().min(1).max(99).nullable().optional(),
  position: HandballPositionSchema.nullable().optional(),
  throwingHand: ThrowingHandSchema.nullable().optional(),
  shotZones: ShotZonesSchema.default(DEFAULT_SHOT_ZONES),
  feintPreference: optionalTrimmed(200),
  isSevenMeterShooter: z.boolean().default(false),
  threatLevel: ThreatLevelSchema.default("MEDIUM"),
  notes: optionalTrimmed(600),
  goalsTotal: z.number().int().min(0).max(2000).nullable().optional(),
  gamesPlayed: z.number().int().min(0).max(200).nullable().optional(),
  sevenMeterGoals: z.number().int().min(0).max(500).nullable().optional(),
  sevenMeterAttempts: z.number().int().min(0).max(500).nullable().optional(),
  statsUpdatedAt: z.string().datetime().nullable().optional(),
});
export type CreateOpponentPlayerInput = z.infer<
  typeof CreateOpponentPlayerSchema
>;

export const UpdateOpponentPlayerSchema = CreateOpponentPlayerSchema.partial();
export type UpdateOpponentPlayerInput = z.infer<
  typeof UpdateOpponentPlayerSchema
>;

export const NuligaPreviewOpponentPlayersSchema = z.object({
  sourceUrl: optionalUrl,
});
export type NuligaPreviewOpponentPlayersInput = z.infer<
  typeof NuligaPreviewOpponentPlayersSchema
>;

export const NuligaImportPlayerSelectionSchema = z.object({
  externalPlayerId: optionalTrimmed(64),
  name: z.string().trim().min(2).max(100),
  jerseyNumber: z.number().int().min(1).max(99).nullable().optional(),
  isSevenMeterShooter: z.boolean().default(false),
  threatLevel: ThreatLevelSchema.default("MEDIUM"),
  goalsTotal: z.number().int().min(0).max(2000).nullable().optional(),
  gamesPlayed: z.number().int().min(0).max(200).nullable().optional(),
  sevenMeterGoals: z.number().int().min(0).max(500).nullable().optional(),
  sevenMeterAttempts: z.number().int().min(0).max(500).nullable().optional(),
});

export const NuligaImportOpponentPlayersSchema = z.object({
  sourceUrl: optionalUrl,
  players: z
    .array(NuligaImportPlayerSelectionSchema)
    .min(1, "Bitte mindestens einen Spieler zum Importieren auswählen.")
    .max(40),
});
export type NuligaImportOpponentPlayersInput = z.infer<
  typeof NuligaImportOpponentPlayersSchema
>;

export const CreateScoutingNoteSchema = z.object({
  opponentId: z.string().min(1, "Gegner muss ausgewählt sein."),
  eventId: z.string().min(1).nullable().optional(),
  tacticPlayId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(2, "Titel erforderlich.").max(120),
  content: z.string().trim().min(2, "Inhalt erforderlich.").max(2500),
  videoUrl: z
    .string()
    .trim()
    .url("Bitte gültige Video-URL (https://...) eingeben.")
    .nullable()
    .or(z.literal("").transform(() => null))
    .optional(),
  isSharedWithTeam: z.boolean().default(false),
});
export type CreateScoutingNoteInput = z.infer<typeof CreateScoutingNoteSchema>;

export const UpdateScoutingNoteSchema = CreateScoutingNoteSchema.partial();
export type UpdateScoutingNoteInput = z.infer<typeof UpdateScoutingNoteSchema>;

export interface OpponentPlayerDTO {
  id: string;
  opponentId: string;
  name: string;
  externalPlayerId: string | null;
  jerseyNumber: number | null;
  position: HandballPosition | null;
  throwingHand: ThrowingHand | null;
  shotZones: ShotZones;
  feintPreference: string | null;
  isSevenMeterShooter: boolean;
  threatLevel: ThreatLevel;
  notes: string | null;
  goalsTotal: number | null;
  gamesPlayed: number | null;
  sevenMeterGoals: number | null;
  sevenMeterAttempts: number | null;
  statsUpdatedAt: string | null;
}

export interface NuligaOpponentPlayerPreviewDTO {
  externalPlayerId: string | null;
  name: string;
  jerseyNumber: number | null;
  goalsTotal: number | null;
  gamesPlayed: number | null;
  goalsPerGame: number | null;
  sevenMeterGoals: number | null;
  sevenMeterAttempts: number | null;
  isSevenMeterShooter: boolean;
  suggestedThreatLevel: ThreatLevel;
  sourceMatchesAnalyzed: number;
  alreadyImported: boolean;
  existingPlayerId: string | null;
}

export interface NuligaOpponentPlayersPreviewResponseDTO {
  resolvedTeamUrl: string | null;
  resolvedGroupUrl: string | null;
  reportsAnalyzed: number;
  statisticsAvailable: boolean;
  anonymizedDetected: boolean;
  warning: string | null;
  players: NuligaOpponentPlayerPreviewDTO[];
}

export interface NuligaImportOpponentPlayersResultDTO {
  createdCount: number;
  updatedCount: number;
  players: OpponentPlayerDTO[];
}

export interface ScoutingNoteDTO {
  id: string;
  clubId: string;
  teamId: string;
  opponentId: string;
  opponentName?: string;
  eventId: string | null;
  eventTitle?: string | null;
  tacticPlayId: string | null;
  tacticPlayTitle?: string | null;
  title: string;
  content: string;
  videoUrl: string | null;
  isSharedWithTeam: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpponentDTO {
  id: string;
  clubId: string;
  teamId: string;
  name: string;
  leagueName: string | null;
  externalUrl: string | null;
  defenseSystems: string[];
  attackSystems: string[];
  transitionNotes: string | null;
  strengths: string | null;
  weaknesses: string | null;
  generalNotes: string | null;
  keyPlayers: OpponentPlayerDTO[];
  scoutingNotes: ScoutingNoteDTO[];
  updatedAt: string;
}
