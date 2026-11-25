import { HvnbDirectoryGroupSeed } from "../data/hvnb-directory-seed";
import { TeamGender } from "../schemas/handball";
import { LeagueAgeGroup } from "../schemas/league-catalog";
import { LeagueGroupDTO } from "../schemas/league-directory";

export interface LeagueDirectoryGroupTeamRecord {
  id: string;
  leagueGroupId: string;
  externalTeamId: string;
  name: string;
  clubName: string;
  shortName: string | null;
  icalUrl: string | null;
  externalUrl: string | null;
  group: {
    id: string;
    code: string;
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
    externalProvider: "ICAL_URL" | "CSV_MANUAL" | "HVNB_NULIGA";
    externalGroupId: string | null;
    externalUrl: string | null;
  };
  siblingTeams: Array<{
    id: string;
    name: string;
    clubName: string;
    externalUrl?: string | null;
  }>;
}

export interface LeagueDirectoryFilter {
  federationCode: string;
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
    groups: HvnbDirectoryGroupSeed[]
  ): Promise<{ groupsUpserted: number; teamsUpserted: number }>;
  /** Speichert eine live ermittelte Feed-URL am Verzeichnis-Eintrag. */
  updateGroupTeamIcalUrl(leagueGroupTeamId: string, icalUrl: string): Promise<void>;
}

export interface LeagueDirectoryProvider {
  readonly federationCode: string;
  fetchSnapshot(): Promise<HvnbDirectoryGroupSeed[]>;
}
