/**
 * Reiner Domain-Vertrag für den Handball360 / handball.net API-Client.
 * Kapselt den konkreten Transport (offizielle DHB-Partner-API / iSquad-Schnittstelle)
 * vollständig von der Domänen-Normalisierung.
 */

export interface Handball360ClubSearchItem {
  clubId: string;
  clubName: string;
  federationCode?: string | null;
  logoUrl?: string | null;
  teams: Array<{
    teamId: string;
    teamName: string;
    tournamentId: string;
    tournamentName: string;
    regionCode?: string | null;
    regionName?: string | null;
    seasonName?: string | null;
    ageGroupHint?: string | null;
    genderHint?: string | null;
    teamUrl?: string | null;
    tournamentUrl?: string | null;
    siblingTeams?: Array<{
      teamId: string;
      teamName: string;
      clubId?: string | null;
      clubName?: string | null;
      teamUrl?: string | null;
    }>;
  }>;
}

export interface Handball360MatchPayload {
  matchId: string;
  matchNumber?: string | null;
  /** ISO-8601-Zeitstempel (UTC oder mit Offset). Kann bei noch nicht angesetzten Spielen nur ein Datum (YYYY-MM-DD) sein. */
  startsAt: string;
  /** true, wenn noch keine konkrete Anwurfzeit feststeht (nur Rahmentermin). */
  timeTbd?: boolean;
  homeTeamId?: string | null;
  homeTeamName: string;
  awayTeamId?: string | null;
  awayTeamName: string;
  venueName?: string | null;
  venueAddress?: string | null;
  leagueGroupName?: string | null;
  status?: "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELLED" | "POSTPONED" | "FORFEIT";
  homeScoreFull?: number | null;
  awayScoreFull?: number | null;
  homeScoreHalf?: number | null;
  awayScoreHalf?: number | null;
}

export interface Handball360LineupPlayerPayload {
  playerId?: string | null;
  /** Name kann im Jugendbereich oder bei Datenschutz-Opt-out leer/anonymisiert sein. */
  displayName?: string | null;
  anonymized?: boolean;
  jerseyNumber?: number | null;
  goals?: number | null;
  sevenMeterGoals?: number | null;
  sevenMeterAttempts?: number | null;
}

export interface Handball360MatchReportPayload {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeLineup: Handball360LineupPlayerPayload[];
  awayLineup: Handball360LineupPlayerPayload[];
}

export interface Handball360Client {
  /** Zeigt an, ob eine offizielle API-Konfiguration (Base-URL / Credentials) aktiv ist. */
  isConfigured(): boolean;

  searchClubsAndTeams(params: {
    query: string;
    federationCode?: string;
    seasonName?: string;
  }): Promise<Handball360ClubSearchItem[]>;

  fetchTeamSchedule(params: {
    teamExternalId: string;
    tournamentExternalId?: string | null;
    seasonName?: string | null;
  }): Promise<Handball360MatchPayload[]>;

  fetchMatchReport?(matchId: string): Promise<Handball360MatchReportPayload | null>;
}
