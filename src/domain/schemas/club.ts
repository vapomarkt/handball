import { z } from "zod";
import { TeamGenderSchema } from "./handball";
import { LeagueAgeGroup, LeagueAgeGroupSchema } from "./league-catalog";

export const CreateClubSchema = z.object({
  name: z.string().trim().min(2, "Vereinsname muss mindestens 2 Zeichen lang sein.").max(100),
  shortName: z.string().trim().min(2).max(20).optional(),
  city: z.string().trim().max(80).optional(),
  seasonName: z
    .string()
    .trim()
    .min(3, "Saisonname erforderlich (z. B. 2026/27).")
    .max(30)
    .default("2026/27"),
});
export type CreateClubInput = z.infer<typeof CreateClubSchema>;

export const CreateSeasonSchema = z.object({
  name: z.string().trim().min(3, "Saisonname erforderlich (z. B. 2026/27).").max(30),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});
export type CreateSeasonInput = z.infer<typeof CreateSeasonSchema>;

export const CreateTeamSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Mannschaftsname muss mindestens 2 Zeichen lang sein.")
      .max(80),
    seasonId: z.string().trim().min(1).optional(),
    seasonCatalogId: z.string().trim().min(1).optional(),
    seasonName: z.string().trim().min(3).max(30).optional(),
    category: z.string().trim().min(2).max(50).default("Aktive"),
    ageGroup: LeagueAgeGroupSchema.optional().nullable(),
    gender: TeamGenderSchema.default("MALE"),
    usesResin: z.boolean().optional(),
    leagueId: z.string().trim().min(1).optional().nullable(),
    leagueName: z.string().trim().max(100).optional().nullable(),
    leagueGroupTeamId: z.string().trim().min(1).optional().nullable(),
    autoImportSchedule: z.boolean().optional().default(true),
    seedGroupOpponents: z.boolean().optional().default(true),
  })
  .refine(
    (data) => Boolean(data.seasonId || data.seasonCatalogId || data.seasonName),
    {
      message: "Saison muss ausgewählt sein.",
      path: ["seasonId"],
    }
  );
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  category: z.string().trim().min(2).max(50).optional(),
  ageGroup: LeagueAgeGroupSchema.optional().nullable(),
  gender: TeamGenderSchema.optional(),
  usesResin: z.boolean().optional(),
  leagueId: z.string().trim().min(1).optional().nullable(),
  leagueName: z.string().trim().max(100).optional().nullable(),
  leagueGroupTeamId: z.string().trim().min(1).optional().nullable(),
});
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;

export const OnboardingSchema = z.object({
  clubName: z
    .string()
    .trim()
    .min(2, "Vereins- oder Teamname muss mindestens 2 Zeichen lang sein.")
    .max(100),
  clubShortName: z.string().trim().max(20).optional(),
  city: z.string().trim().max(80).optional(),
  seasonId: z.string().trim().min(1).optional(),
  seasonName: z.string().trim().min(3).max(30).default("2026/27"),
  teamName: z.string().trim().min(2, "Mannschaftsname erforderlich.").max(80),
  category: z.string().trim().min(2).max(50).default("Aktive"),
  ageGroup: LeagueAgeGroupSchema.optional().nullable(),
  gender: TeamGenderSchema.default("MALE"),
  usesResin: z.boolean().optional(),
  leagueId: z.string().trim().min(1).optional(),
  leagueName: z.string().trim().max(100).optional(),
  leagueGroupTeamId: z.string().trim().min(1).optional().nullable(),
  autoImportSchedule: z.boolean().optional().default(true),
  seedGroupOpponents: z.boolean().optional().default(true),
  creatorFirstName: z.string().trim().min(1, "Vorname erforderlich.").max(60),
  creatorLastName: z.string().trim().min(1, "Nachname erforderlich.").max(60),
  creatorRole: z.enum(["CLUB_ADMIN", "COACH"]).default("COACH"),
});
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export interface ClubDTO {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  city: string | null;
  logoUrl: string | null;
  createdAt: string;
}

export interface SeasonDTO {
  id: string;
  clubId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export interface TeamDTO {
  id: string;
  clubId: string;
  seasonId: string;
  name: string;
  category: string;
  ageGroup?: LeagueAgeGroup | null;
  gender: "MALE" | "FEMALE" | "MIXED";
  usesResin: boolean;
  leagueId?: string | null;
  leagueName: string | null;
  leagueGroupTeamId?: string | null;
  leagueGroupName?: string | null;
  leagueOfficialTeamName?: string | null;
  memberCount?: number;
  seasonName?: string;
  clubName?: string;
}
