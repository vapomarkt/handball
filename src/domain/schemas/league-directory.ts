import { z } from "zod";
import { TeamGenderSchema } from "./handball";
import {
  LeagueProviderType,
  LeagueProviderTypeSchema,
  SyncRunSummaryDTO,
} from "./league";
import { LeagueAgeGroupSchema } from "./league-catalog";

export const LeagueDirectorySearchQuerySchema = z.object({
  countryCode: z.string().trim().min(2).max(2).toUpperCase().default("DE"),
  federationCode: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .toUpperCase()
    .optional(),
  seasonName: z.string().trim().min(3).max(30).optional(),
  ageGroup: LeagueAgeGroupSchema.optional(),
  gender: TeamGenderSchema.optional(),
  leagueId: z.string().trim().min(1).optional(),
  regionCode: z.string().trim().min(2).max(30).toUpperCase().optional(),
  q: z.string().trim().max(100).optional(),
  clubName: z.string().trim().max(100).optional(),
});
export type LeagueDirectorySearchQuery = z.infer<
  typeof LeagueDirectorySearchQuerySchema
>;

export const LinkTeamToDirectorySchema = z.object({
  leagueGroupTeamId: z
    .string()
    .trim()
    .min(1, "Bitte wähle eine Mannschaft aus der Staffel aus."),
  autoImportSchedule: z.boolean().default(true),
  seedGroupOpponents: z.boolean().default(true),
});
export type LinkTeamToDirectoryInput = z.infer<
  typeof LinkTeamToDirectorySchema
>;

export interface LeagueGroupTeamDTO {
  id: string;
  leagueGroupId: string;
  externalTeamId: string;
  externalClubId?: string | null;
  name: string;
  clubName: string;
  shortName: string | null;
  hasIcalFeed: boolean;
  externalUrl: string | null;
}

export interface LeagueGroupDTO {
  id: string;
  code: string;
  countryCode: string;
  federationCode: string;
  regionCode: string;
  regionName: string;
  seasonName: string;
  leagueId: string | null;
  leagueDisplayName: string | null;
  ageGroup: z.infer<typeof LeagueAgeGroupSchema>;
  gender: z.infer<typeof TeamGenderSchema>;
  name: string;
  shortName: string | null;
  externalProvider: z.infer<typeof LeagueProviderTypeSchema>;
  externalGroupId: string | null;
  externalUrl: string | null;
  teams: LeagueGroupTeamDTO[];
}

export interface LeagueDirectoryMatchSuggestionDTO {
  team: LeagueGroupTeamDTO;
  group: Omit<LeagueGroupDTO, "teams">;
  opponentCount: number;
  score: number;
  matchReason: string;
}

export interface LeagueDirectoryFederationOptionDTO {
  code: string;
  name: string;
  countryCode: string;
  provider: LeagueProviderType | null;
  groupCount: number;
}

export interface LeagueDirectorySearchResponseDTO {
  countryCode: string;
  federationCode: string | null;
  federations: LeagueDirectoryFederationOptionDTO[];
  regions: Array<{
    code: string;
    name: string;
    groupCount: number;
  }>;
  suggestions: LeagueDirectoryMatchSuggestionDTO[];
  groups: LeagueGroupDTO[];
}

export interface TeamLeagueLinkResultDTO {
  teamId: string;
  leagueId: string | null;
  leagueName: string;
  leagueGroupTeamId: string;
  officialTeamName: string;
  groupName: string;
  regionName: string;
  federationCode: string;
  countryCode: string;
  provider: LeagueProviderType;
  sourceId: string;
  hasIcalFeed: boolean;
  syncSummary: SyncRunSummaryDTO | null;
  syncWarning: string | null;
  seededOpponentsCount: number;
}
