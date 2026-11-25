import { z } from "zod";
import { TeamGenderSchema } from "./handball";

export const LeagueAgeGroupSchema = z.enum([
  "ADULT",
  "YOUTH_A",
  "YOUTH_B",
  "YOUTH_C",
  "YOUTH_D",
  "YOUTH_E",
  "YOUTH_F_MINI",
  "SENIOR",
]);
export type LeagueAgeGroup = z.infer<typeof LeagueAgeGroupSchema>;

export const LeagueCatalogQuerySchema = z.object({
  countryCode: z.string().trim().min(2).max(2).toUpperCase().default("DE"),
  ageGroup: LeagueAgeGroupSchema.optional(),
  gender: TeamGenderSchema.optional(),
  federationCode: z.string().trim().min(2).max(20).toUpperCase().optional(),
  q: z.string().trim().max(80).optional(),
});
export type LeagueCatalogQuery = z.infer<typeof LeagueCatalogQuerySchema>;

export interface LeagueDTO {
  id: string;
  code: string;
  countryCode: string;
  federationCode: string;
  federationName: string;
  ageGroup: LeagueAgeGroup;
  gender: "MALE" | "FEMALE" | "MIXED";
  tier: number;
  name: string;
  shortName: string | null;
  displayName: string;
}

export interface LeagueFederationSummaryDTO {
  code: string;
  name: string;
  regionLabel: string;
  isNational: boolean;
  leagueCount: number;
  searchKeywords: string[];
}

export interface LeagueCatalogResponseDTO {
  countryCode: string;
  federations: LeagueFederationSummaryDTO[];
  leagues: LeagueDTO[];
}
