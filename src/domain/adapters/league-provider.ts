import {
  CarpoolBookingDTO,
  CarpoolDTO,
  CreateCarpoolInput,
} from "../schemas/carpool";
import {
  CreateLeagueSourceInput,
  LeagueImportSourceDTO,
  LeagueProviderType,
  LeagueSyncChangeLogDTO,
  SyncChangeType,
  SyncStatus,
} from "../schemas/league";

/**
 * Normalisiertes Liga-Spiel als gemeinsamer Vertrag aller Provider-Adapter
 * (iCal, CSV, und künftig nuLiga-HTML / nuPortalRS / handball.net).
 */
export interface MatchScoresSnapshot {
  homeScoreFull: number;
  awayScoreFull: number;
  homeScoreHalf: number | null;
  awayScoreHalf: number | null;
}

export interface NormalizedLeagueMatch {
  externalId: string;
  title: string;
  opponentName: string;
  isHome: boolean;
  startAt: Date;
  endAt: Date | null;
  venueName: string | null;
  isCancelled: boolean;
  matchNumber?: string | null;
  leagueGroupName?: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeScoreHalf?: number | null;
  awayScoreHalf?: number | null;
  homeScoreFull?: number | null;
  awayScoreFull?: number | null;
}

export interface LeagueProviderAdapter<TOptions = unknown> {
  readonly provider: LeagueProviderType;
  parse(rawContent: string, options: TOptions): NormalizedLeagueMatch[];
}

export interface ExistingSyncedMatch {
  eventId: string;
  externalId: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  venueId: string | null;
  venueName: string | null;
  isCancelled: boolean;
  opponentName: string | null;
  isHome: boolean | null;
  homeScoreHalf?: number | null;
  awayScoreHalf?: number | null;
  homeScoreFull?: number | null;
  awayScoreFull?: number | null;
}

export interface ExistingUnscoredMatch {
  eventId: string;
  externalId: string | null;
  title: string;
  startAt: Date;
  opponentName: string;
  isHome: boolean;
  homeScoreHalf: number | null;
  awayScoreHalf: number | null;
  homeScoreFull: number | null;
  awayScoreFull: number | null;
}

export interface LeagueSyncRepository {
  listSourcesByTeam(teamId: string): Promise<LeagueImportSourceDTO[]>;
  listEnabledIcalSources(): Promise<LeagueImportSourceDTO[]>;
  findSourceById(sourceId: string): Promise<LeagueImportSourceDTO | null>;
  createSource(
    clubId: string,
    teamId: string,
    input: CreateLeagueSourceInput
  ): Promise<LeagueImportSourceDTO>;
  updateSourceSyncStatus(
    sourceId: string,
    status: SyncStatus,
    errorMessage?: string | null
  ): Promise<void>;
  deleteSource(sourceId: string): Promise<void>;

  findSyncedMatchesByTeam(teamId: string): Promise<ExistingSyncedMatch[]>;
  findPastMatchesWithoutScoresByTeam?(
    teamId: string,
    before: Date
  ): Promise<ExistingUnscoredMatch[]>;
  backfillMatchScores?(
    eventId: string,
    scores: MatchScoresSnapshot
  ): Promise<void>;
  findOrCreateVenueByNamePreservingResin(
    clubId: string,
    venueName: string
  ): Promise<{ id: string; name: string }>;
  createSyncedMatchEvent(input: {
    clubId: string;
    teamId: string;
    externalId: string;
    title: string;
    startAt: Date;
    endAt: Date | null;
    venueId: string | null;
    isCancelled: boolean;
    opponentName: string;
    isHome: boolean;
    homeScoreHalf?: number | null;
    awayScoreHalf?: number | null;
    homeScoreFull?: number | null;
    awayScoreFull?: number | null;
  }): Promise<{ eventId: string }>;
  /**
   * Aktualisiert AUSSCHLIESSLICH externe Liga-Felder.
   * Lokale Anreicherungen (meetingAt, description, jerseyColor, nominatedMemberIds,
   * refereeNote, carpools, venue.resinPolicy) sowie bereits manuell gepflegte
   * Endstände bleiben 100% unberührt; fehlende Ergebnisse können gezielt
   * über `backfillScores` nachgetragen werden.
   */
  updateSyncedMatchSchedulePreservingLocal(input: {
    eventId: string;
    title: string;
    startAt: Date;
    endAt: Date | null;
    venueId: string | null;
    isCancelled: boolean;
    opponentName: string;
    isHome: boolean;
    backfillScores?: MatchScoresSnapshot | null;
  }): Promise<void>;

  createChangeLog(input: {
    sourceId: string;
    teamId: string;
    eventId: string | null;
    externalId: string;
    changeType: SyncChangeType;
    summary: string;
    oldStartAt?: Date | null;
    newStartAt?: Date | null;
    oldVenueName?: string | null;
    newVenueName?: string | null;
  }): Promise<LeagueSyncChangeLogDTO>;
  listChangeLogsByTeam(
    teamId: string,
    limit?: number
  ): Promise<LeagueSyncChangeLogDTO[]>;
}

export interface CarpoolRepository {
  listByEventId(eventId: string): Promise<CarpoolDTO[]>;
  findById(carpoolId: string): Promise<
    (CarpoolDTO & { clubId: string; teamId: string }) | null
  >;
  create(
    eventId: string,
    input: CreateCarpoolInput
  ): Promise<CarpoolDTO>;
  delete(carpoolId: string): Promise<void>;
  findBookingById(bookingId: string): Promise<{
    id: string;
    carpoolId: string;
    eventId: string;
    clubId: string;
    teamId: string;
    passengerMemberId: string;
    passengerUserId: string | null;
    bookedByUserId: string;
  } | null>;
  createBooking(input: {
    carpoolId: string;
    passengerMemberId: string;
    bookedByUserId: string;
  }): Promise<CarpoolBookingDTO>;
  deleteBooking(bookingId: string): Promise<void>;
}

export type FetchTextFn = (url: string) => Promise<string>;
