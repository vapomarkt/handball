import { TeamGender } from "../schemas/handball";
import { LeagueAgeGroup, LeagueDTO } from "../schemas/league-catalog";

export interface LeagueCatalogFilter {
  countryCode: string;
  ageGroup?: LeagueAgeGroup;
  gender?: TeamGender;
  federationCode?: string;
  q?: string;
}

export interface LeagueCatalogRepository {
  findById(id: string): Promise<LeagueDTO | null>;
  findByCode(code: string): Promise<LeagueDTO | null>;
  findMany(filter: LeagueCatalogFilter): Promise<LeagueDTO[]>;
}
