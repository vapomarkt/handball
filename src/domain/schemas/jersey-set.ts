import { z } from "zod";

export const JerseyConditionSchema = z.enum([
  "NEW",
  "GOOD",
  "WORN",
  "NEEDS_REPAIR",
  "INCOMPLETE",
  "RETIRED",
]);
export type JerseyCondition = z.infer<typeof JerseyConditionSchema>;

export const JERSEY_CONDITION_LABELS: Record<JerseyCondition, string> = {
  NEW: "Neu / Neuwertig",
  GOOD: "Gut",
  WORN: "Gebraucht",
  NEEDS_REPAIR: "Reparatur nötig",
  INCOMPLETE: "Unvollständig",
  RETIRED: "Ausgemustert",
};

export const JERSEY_CARE_PRESETS: readonly string[] = [
  "Max. 30 °C waschen",
  "Auf links waschen",
  "Kein Weichspüler",
  "Nicht trocknergeeignet",
  "Nicht bügeln (Beflockung)",
];

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional();

export const CreateJerseySetSchema = z.object({
  teamId: z.string().min(1).nullable().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Bezeichnung muss mindestens 2 Zeichen lang sein.")
    .max(100),
  colors: z
    .string()
    .trim()
    .min(2, "Farbangabe erforderlich (z. B. Orange / Schwarz).")
    .max(80),
  sizes: optionalTrimmed(120),
  jerseyCount: z.number().int().min(1).max(60).nullable().optional(),
  condition: JerseyConditionSchema.default("GOOD"),
  conditionNote: optionalTrimmed(500),
  careInstructions: optionalTrimmed(1000),
});
export type CreateJerseySetInput = z.infer<typeof CreateJerseySetSchema>;

export const UpdateJerseySetSchema = z.object({
  teamId: z.string().min(1).nullable().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Bezeichnung muss mindestens 2 Zeichen lang sein.")
    .max(100)
    .optional(),
  colors: z
    .string()
    .trim()
    .min(2, "Farbangabe erforderlich.")
    .max(80)
    .optional(),
  sizes: optionalTrimmed(120),
  jerseyCount: z.number().int().min(1).max(60).nullable().optional(),
  condition: JerseyConditionSchema.optional(),
  conditionNote: optionalTrimmed(500),
  careInstructions: optionalTrimmed(1000),
});
export type UpdateJerseySetInput = z.infer<typeof UpdateJerseySetSchema>;

export interface JerseySetSummaryDTO {
  id: string;
  name: string;
  colors: string;
  condition: JerseyCondition;
  conditionNote: string | null;
  careInstructions: string | null;
}

export interface JerseySetDTO {
  id: string;
  clubId: string;
  teamId: string | null;
  teamName: string | null;
  name: string;
  colors: string;
  sizes: string | null;
  jerseyCount: number | null;
  condition: JerseyCondition;
  conditionNote: string | null;
  careInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}
