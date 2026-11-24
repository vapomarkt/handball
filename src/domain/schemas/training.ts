import { z } from "zod";

export const TrainingPhaseTypeSchema = z.enum([
  "WARMUP",
  "TECHNIQUE",
  "TACTICS",
  "GAME_FORM",
  "COOLDOWN",
]);
export type TrainingPhaseType = z.infer<typeof TrainingPhaseTypeSchema>;

export const TRAINING_PHASE_LABELS: Record<TrainingPhaseType, string> = {
  WARMUP: "Aufwärmen",
  TECHNIQUE: "Technik / Koordination",
  TACTICS: "Taktik / Kooperation",
  GAME_FORM: "Spielform",
  COOLDOWN: "Cool-down",
};

export const HANDBALL_DRILL_TAGS = [
  "Torwart",
  "Gegenstoß",
  "6:0-Abwehr",
  "5:1-Abwehr",
  "3:2:1-Abwehr",
  "1-gegen-1",
  "Überzahl",
  "Unterzahl",
  "Wurftraining",
  "Kreisanspiel",
  "Koordination",
] as const;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional();

export const CreateDrillSchema = z.object({
  title: z.string().trim().min(2, "Übungstitel erforderlich.").max(120),
  description: optionalTrimmed(1500),
  phase: TrainingPhaseTypeSchema.default("TECHNIQUE"),
  durationMinutes: z.number().int().min(3).max(90).default(15),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  equipment: optionalTrimmed(200),
  teamScope: z.enum(["CLUB", "TEAM"]).default("CLUB"),
});
export type CreateDrillInput = z.infer<typeof CreateDrillSchema>;

export const TrainingPhaseItemSchema = z.object({
  id: z.string().min(1),
  phase: TrainingPhaseTypeSchema,
  title: z.string().trim().min(1, "Phasentitel erforderlich.").max(120),
  durationMinutes: z.number().int().min(1).max(120),
  drillId: z.string().nullable().optional(),
  equipment: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export type TrainingPhaseItem = z.infer<typeof TrainingPhaseItemSchema>;

export const CreateTrainingPlanSchema = z.object({
  title: z.string().trim().min(2, "Trainingsplan-Titel erforderlich.").max(120),
  focus: optionalTrimmed(200),
  eventId: z.string().min(1).nullable().optional(),
  targetDurationMinutes: z.number().int().min(30).max(240).default(90),
  phases: z.array(TrainingPhaseItemSchema).max(20).default([]),
  isSharedWithTeam: z.boolean().default(false),
});
export type CreateTrainingPlanInput = z.infer<typeof CreateTrainingPlanSchema>;

export const UpdateTrainingPlanSchema = CreateTrainingPlanSchema.partial();
export type UpdateTrainingPlanInput = z.infer<typeof UpdateTrainingPlanSchema>;

export interface DrillDTO {
  id: string;
  clubId: string;
  teamId: string | null;
  title: string;
  description: string | null;
  phase: TrainingPhaseType;
  durationMinutes: number;
  tags: string[];
  equipment: string | null;
  tacticPlayId: string | null;
  createdAt: string;
}

export interface TrainingPlanDTO {
  id: string;
  clubId: string;
  teamId: string;
  eventId: string | null;
  title: string;
  focus: string | null;
  targetDurationMinutes: number;
  totalPlannedMinutes: number;
  phases: TrainingPhaseItem[];
  isSharedWithTeam: boolean;
  createdAt: string;
  updatedAt: string;
}
