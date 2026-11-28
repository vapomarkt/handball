import { z } from "zod";
import { parseGermanDateToIso } from "../date-time";

const OptionalDateInputSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Unterstützt TT.MM.JJJJ, YYYY-MM-DD und ISO-Timestamps
    const parsedIsoDate = parseGermanDateToIso(trimmed);
    if (parsedIsoDate) {
      return `${parsedIsoDate}T00:00:00.000Z`;
    }
    return trimmed;
  })
  .refine(
    (val) => {
      if (val === undefined || val === null) return true;
      return !Number.isNaN(Date.parse(val));
    },
    { message: "Ungültiges Datum (erwartet TT.MM.JJJJ oder ISO-Datum)." }
  );

export const CreateSeasonCatalogSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Saisonname muss mindestens 3 Zeichen lang sein (z. B. 2026/27).")
      .max(30, "Saisonname darf maximal 30 Zeichen lang sein."),
    startDate: OptionalDateInputSchema,
    endDate: OptionalDateInputSchema,
    sortOrder: z.coerce.number().int().min(-9999).max(9999).default(0),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return Date.parse(data.endDate) >= Date.parse(data.startDate);
      }
      return true;
    },
    {
      message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
      path: ["endDate"],
    }
  );
export type CreateSeasonCatalogInput = z.infer<
  typeof CreateSeasonCatalogSchema
>;

export const UpdateSeasonCatalogSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Saisonname muss mindestens 3 Zeichen lang sein (z. B. 2026/27).")
      .max(30, "Saisonname darf maximal 30 Zeichen lang sein.")
      .optional(),
    startDate: OptionalDateInputSchema,
    endDate: OptionalDateInputSchema,
    sortOrder: z.coerce.number().int().min(-9999).max(9999).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return Date.parse(data.endDate) >= Date.parse(data.startDate);
      }
      return true;
    },
    {
      message: "Das Enddatum darf nicht vor dem Startdatum liegen.",
      path: ["endDate"],
    }
  );
export type UpdateSeasonCatalogInput = z.infer<
  typeof UpdateSeasonCatalogSchema
>;

export interface SeasonCatalogDTO {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
