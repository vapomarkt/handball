import { HvnbDirectoryGroupSeed } from "../data/hvnb-directory-seed";
import { TeamGender } from "../schemas/handball";
import { LeagueProviderType } from "../schemas/league";
import { LeagueAgeGroup } from "../schemas/league-catalog";
import { LeagueGroupDTO } from "../schemas/league-directory";
import { DirectoryGroupSeed } from "./league-data-provider";

export interface LeagueDirectoryGroupTeamRecord {
  id: string;
  leagueGroupId: string;
  externalTeamId: string;
  externalClubId?: string | null;
  name: string;
  clubName: string;
  shortName: string | null;
  icalUrl: string | null;
  externalUrl: string | null;
  providerMeta?: Record<string, unknown> | null;
  group: {
    id: string;
    code: string;
    countryCode: string;
    federationCode: string;
    regionCode: string;
    regionName: string;
    seasonName: string;
    leagueId: string | null;
    leagueDisplayName: string | null;
    ageGroup: LeagueAgeGroup;
    gender: TeamGender;
    name: string;
    shortName: string | null;
    externalProvider: LeagueProviderType;
    externalGroupId: string | null;
    externalUrl: string | null;
    providerMeta?: Record<string, unknown> | null;
  };
  siblingTeams: Array<{
    id: string;
    name: string;
    clubName: string;
    externalUrl?: string | null;
  }>;
}

export interface LeagueDirectoryFilter {
  countryCode?: string;
  federationCode?: string;
  seasonName?: string;
  ageGroup?: LeagueAgeGroup;
  gender?: TeamGender;
  leagueId?: string;
  regionCode?: string;
}

export interface LeagueDirectoryRepository {
  findGroupsWithTeams(filter: LeagueDirectoryFilter): Promise<LeagueGroupDTO[]>;
  findGroupTeamById(
    leagueGroupTeamId: string
  ): Promise<LeagueDirectoryGroupTeamRecord | null>;
  upsertDirectorySnapshot(
    groups: Array<DirectoryGroupSeed | HvnbDirectoryGroupSeed>
  ): Promise<{ groupsUpserted: number; teamsUpserted: number }>;
  /** Speichert eine live ermittelte Feed-URL am Verzeichnis-Eintrag. */
  updateGroupTeamIcalUrl(leagueGroupTeamId: string, icalUrl: string): Promise<void>;
}

export interface LeagueDirectoryProvider {
  readonly countryCode?: string;
  readonly federationCode: string;
  fetchSnapshot(): Promise<Array<DirectoryGroupSeed | HvnbDirectoryGroupSeed>>;
}
