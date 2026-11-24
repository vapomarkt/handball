import { z } from "zod";

export const CourtModeSchema = z.enum(["HALF_COURT", "FULL_COURT"]);
export type CourtMode = z.infer<typeof CourtModeSchema>;

export const COURT_MODE_LABELS: Record<CourtMode, string> = {
  HALF_COURT: "Halbfeld (Angriff / Abwehr)",
  FULL_COURT: "Ganzfeld (Gegenstoß / Rückzug)",
};

export const TacticCategorySchema = z.enum([
  "TRIGGER_PLAY",
  "DEFENSE_6_0",
  "DEFENSE_5_1",
  "DEFENSE_3_2_1",
  "DEFENSE_4_2",
  "POWERPLAY_7_6",
  "SHORTHANDED",
  "FREE_THROW",
  "FAST_BREAK",
  "OTHER",
]);
export type TacticCategory = z.infer<typeof TacticCategorySchema>;

export const TACTIC_CATEGORY_LABELS: Record<TacticCategory, string> = {
  TRIGGER_PLAY: "Auslösehandlung",
  DEFENSE_6_0: "6:0-Abwehr",
  DEFENSE_5_1: "5:1-Abwehr",
  DEFENSE_3_2_1: "3:2:1-Abwehr",
  DEFENSE_4_2: "4:2-Abwehr",
  POWERPLAY_7_6: "Überzahl / 7-gegen-6",
  SHORTHANDED: "Unterzahl",
  FREE_THROW: "Freiwurf-Variante",
  FAST_BREAK: "Gegenstoß (1. / 2. Welle)",
  OTHER: "Sonstiges",
};

export const TokenKindSchema = z.enum([
  "ATTACKER",
  "DEFENDER",
  "GOALKEEPER",
  "BALL",
  "CONE",
]);
export type TokenKind = z.infer<typeof TokenKindSchema>;

export const TacticTokenSchema = z.object({
  id: z.string().min(1),
  kind: TokenKindSchema,
  label: z.string().trim().max(8),
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
});
export type TacticToken = z.infer<typeof TacticTokenSchema>;

export const DrawingKindSchema = z.enum([
  "RUN",
  "PASS",
  "SCREEN",
  "SHOT",
  "ZONE",
]);
export type DrawingKind = z.infer<typeof DrawingKindSchema>;

export const DRAWING_KIND_LABELS: Record<DrawingKind, string> = {
  RUN: "Laufweg",
  PASS: "Passweg",
  SCREEN: "Sperre / Block",
  SHOT: "Wurf",
  ZONE: "Zone markieren",
};

export const TacticDrawingSchema = z.object({
  id: z.string().min(1),
  kind: DrawingKindSchema,
  x1: z.number().min(0).max(1000),
  y1: z.number().min(0).max(1000),
  x2: z.number().min(0).max(1000),
  y2: z.number().min(0).max(1000),
  color: z.string().max(32).optional(),
  label: z.string().max(40).optional(),
});
export type TacticDrawing = z.infer<typeof TacticDrawingSchema>;

export const TacticKeyframeSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(60),
  notes: z.string().trim().max(400).optional().nullable(),
  durationMs: z.number().int().min(400).max(6000).default(1400),
  tokens: z.array(TacticTokenSchema).max(40),
  drawings: z.array(TacticDrawingSchema).max(60),
});
export type TacticKeyframe = z.infer<typeof TacticKeyframeSchema>;

export const TacticBoardDataSchema = z.object({
  version: z.literal(1).default(1),
  keyframes: z
    .array(TacticKeyframeSchema)
    .min(1, "Mindestens ein Schritt (Keyframe) erforderlich.")
    .max(16, "Maximal 16 Animationsschritte pro Spielzug."),
});
export type TacticBoardData = z.infer<typeof TacticBoardDataSchema>;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional();

export const CreateTacticPlaySchema = z.object({
  title: z.string().trim().min(2, "Titel erforderlich.").max(120),
  description: optionalTrimmed(1000),
  category: TacticCategorySchema.default("TRIGGER_PLAY"),
  courtMode: CourtModeSchema.default("HALF_COURT"),
  boardData: TacticBoardDataSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  isSharedWithTeam: z.boolean().default(false),
});
export type CreateTacticPlayInput = z.infer<typeof CreateTacticPlaySchema>;

export const UpdateTacticPlaySchema = CreateTacticPlaySchema.partial();
export type UpdateTacticPlayInput = z.infer<typeof UpdateTacticPlaySchema>;

export interface TacticPlayDTO {
  id: string;
  clubId: string;
  teamId: string;
  title: string;
  description: string | null;
  category: TacticCategory;
  courtMode: CourtMode;
  boardData: TacticBoardData;
  tags: string[];
  isSharedWithTeam: boolean;
  createdAt: string;
  updatedAt: string;
}
