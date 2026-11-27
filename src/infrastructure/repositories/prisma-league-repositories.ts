import {
  CarpoolRepository,
  ExistingSyncedMatch,
  LeagueSyncRepository,
} from "@/domain/adapters/league-provider";
import {
  CarpoolBookingDTO,
  CarpoolDTO,
  CreateCarpoolInput,
} from "@/domain/schemas/carpool";
import {
  CreateLeagueSourceInput,
  LeagueImportSourceDTO,
  LeagueSyncChangeLogDTO,
  SyncChangeType,
  SyncStatus,
} from "@/domain/schemas/league";
import { prisma } from "../db/prisma";

function mapSource(s: {
  id: string;
  clubId: string;
  teamId: string;
  leagueGroupTeamId?: string | null;
  provider: LeagueImportSourceDTO["provider"];
  name: string;
  sourceUrl: string | null;
  teamNameMatch: string | null;
  isEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncedAt: Date | null;
  lastSyncStatus: SyncStatus;
  lastSyncError: string | null;
  createdAt: Date;
}): LeagueImportSourceDTO {
  return {
    id: s.id,
    clubId: s.clubId,
    teamId: s.teamId,
    leagueGroupTeamId: s.leagueGroupTeamId ?? null,
    provider: s.provider,
    name: s.name,
    sourceUrl: s.sourceUrl,
    teamNameMatch: s.teamNameMatch,
    isEnabled: s.isEnabled,
    syncIntervalMinutes: s.syncIntervalMinutes,
    lastSyncedAt: s.lastSyncedAt ? s.lastSyncedAt.toISOString() : null,
    lastSyncStatus: s.lastSyncStatus,
    lastSyncError: s.lastSyncError,
    createdAt: s.createdAt.toISOString(),
  };
}

function mapChangeLog(c: {
  id: string;
  sourceId: string;
  source?: { name: string };
  teamId: string;
  eventId: string | null;
  externalId: string;
  changeType: SyncChangeType;
  summary: string;
  oldStartAt: Date | null;
  newStartAt: Date | null;
  oldVenueName: string | null;
  newVenueName: string | null;
  detectedAt: Date;
}): LeagueSyncChangeLogDTO {
  return {
    id: c.id,
    sourceId: c.sourceId,
    sourceName: c.source?.name,
    teamId: c.teamId,
    eventId: c.eventId,
    externalId: c.externalId,
    changeType: c.changeType,
    summary: c.summary,
    oldStartAt: c.oldStartAt ? c.oldStartAt.toISOString() : null,
    newStartAt: c.newStartAt ? c.newStartAt.toISOString() : null,
    oldVenueName: c.oldVenueName,
    newVenueName: c.newVenueName,
    detectedAt: c.detectedAt.toISOString(),
  };
}

export class PrismaLeagueSyncRepository implements LeagueSyncRepository {
  async listSourcesByTeam(teamId: string): Promise<LeagueImportSourceDTO[]> {
    const rows = await prisma.leagueImportSource.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapSource);
  }

  async listEnabledIcalSources(): Promise<LeagueImportSourceDTO[]> {
    const rows = await prisma.leagueImportSource.findMany({
      where: {
        provider: { in: ["ICAL_URL", "HVNB_NULIGA"] },
        isEnabled: true,
        OR: [
          { sourceUrl: { not: null } },
          { provider: "HVNB_NULIGA", leagueGroupTeamId: { not: null } },
        ],
      },
    });
    return rows.map(mapSource);
  }

  async findSourceById(sourceId: string): Promise<LeagueImportSourceDTO | null> {
    const row = await prisma.leagueImportSource.findUnique({
      where: { id: sourceId },
    });
    return row ? mapSource(row) : null;
  }

  async createSource(
    clubId: string,
    teamId: string,
    input: CreateLeagueSourceInput
  ): Promise<LeagueImportSourceDTO> {
    const row = await prisma.leagueImportSource.create({
      data: {
        clubId,
        teamId,
        leagueGroupTeamId: input.leagueGroupTeamId ?? null,
        provider: input.provider,
        name: input.name,
        sourceUrl: input.sourceUrl ?? null,
        teamNameMatch: input.teamNameMatch ?? null,
        isEnabled: input.isEnabled,
        syncIntervalMinutes: input.syncIntervalMinutes,
      },
    });
    return mapSource(row);
  }

  async updateSourceSyncStatus(
    sourceId: string,
    status: SyncStatus,
    errorMessage?: string | null
  ): Promise<void> {
    await prisma.leagueImportSource.update({
      where: { id: sourceId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: errorMessage ?? null,
      },
    });
  }

  async deleteSource(sourceId: string): Promise<void> {
    await prisma.leagueImportSource.delete({ where: { id: sourceId } });
  }

  async findSyncedMatchesByTeam(teamId: string): Promise<ExistingSyncedMatch[]> {
    const rows = await prisma.event.findMany({
      where: {
        teamId,
        externalId: { not: null },
      },
      include: {
        venue: { select: { name: true } },
        matchDetails: {
          select: {
            opponentName: true,
            isHome: true,
            homeScoreHalf: true,
            awayScoreHalf: true,
            homeScoreFull: true,
            awayScoreFull: true,
          },
        },
      },
    });

    return rows
      .filter((r) => r.externalId !== null)
      .map((r) => ({
        eventId: r.id,
        externalId: r.externalId!,
        title: r.title,
        startAt: r.startAt,
        endAt: r.endAt,
        venueId: r.venueId,
        venueName: r.venue?.name ?? null,
        isCancelled: r.isCancelled,
        opponentName: r.matchDetails?.opponentName ?? null,
        isHome: r.matchDetails?.isHome ?? null,
        homeScoreHalf: r.matchDetails?.homeScoreHalf ?? null,
        awayScoreHalf: r.matchDetails?.awayScoreHalf ?? null,
        homeScoreFull: r.matchDetails?.homeScoreFull ?? null,
        awayScoreFull: r.matchDetails?.awayScoreFull ?? null,
      }));
  }

  async findPastMatchesWithoutScoresByTeam(
    teamId: string,
    before: Date
  ): Promise<
    Array<{
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
    }>
  > {
    const rows = await prisma.event.findMany({
      where: {
        teamId,
        type: "MATCH",
        isCancelled: false,
        startAt: { lt: before },
        matchDetails: {
          is: {
            OR: [{ homeScoreFull: null }, { awayScoreFull: null }],
          },
        },
      },
      include: {
        matchDetails: {
          select: {
            opponentName: true,
            isHome: true,
            homeScoreHalf: true,
            awayScoreHalf: true,
            homeScoreFull: true,
            awayScoreFull: true,
          },
        },
      },
    });

    return rows
      .filter((r) => r.matchDetails !== null)
      .map((r) => ({
        eventId: r.id,
        externalId: r.externalId,
        title: r.title,
        startAt: r.startAt,
        opponentName: r.matchDetails!.opponentName,
        isHome: r.matchDetails!.isHome,
        homeScoreHalf: r.matchDetails!.homeScoreHalf,
        awayScoreHalf: r.matchDetails!.awayScoreHalf,
        homeScoreFull: r.matchDetails!.homeScoreFull,
        awayScoreFull: r.matchDetails!.awayScoreFull,
      }));
  }

  async backfillMatchScores(
    eventId: string,
    scores: {
      homeScoreFull: number;
      awayScoreFull: number;
      homeScoreHalf: number | null;
      awayScoreHalf: number | null;
    }
  ): Promise<void> {
    await prisma.matchDetails.update({
      where: { eventId },
      data: {
        homeScoreFull: scores.homeScoreFull,
        awayScoreFull: scores.awayScoreFull,
        ...(scores.homeScoreHalf !== null
          ? { homeScoreHalf: scores.homeScoreHalf }
          : {}),
        ...(scores.awayScoreHalf !== null
          ? { awayScoreHalf: scores.awayScoreHalf }
          : {}),
      },
    });
  }

  async findOrCreateVenueByNamePreservingResin(
    clubId: string,
    venueName: string
  ): Promise<{ id: string; name: string }> {
    const trimmed = venueName.trim();
    const existing = await prisma.venue.findUnique({
      where: {
        clubId_name: {
          clubId,
          name: trimmed,
        },
      },
      select: { id: true, name: true },
    });
    if (existing) {
      // Bestehende Halle wird wiederverwendet — resinPolicy & notes bleiben 100% unverändert!
      return existing;
    }

    return prisma.venue.create({
      data: {
        clubId,
        name: trimmed,
        resinPolicy: "UNKNOWN",
      },
      select: { id: true, name: true },
    });
  }

  async createSyncedMatchEvent(input: {
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
  }): Promise<{ eventId: string }> {
    const created = await prisma.event.create({
      data: {
        clubId: input.clubId,
        teamId: input.teamId,
        type: "MATCH",
        externalId: input.externalId,
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        venueId: input.venueId,
        isCancelled: input.isCancelled,
        matchDetails: {
          create: {
            opponentName: input.opponentName,
            isHome: input.isHome,
            throwOffAt: input.startAt,
            homeScoreHalf: input.homeScoreHalf ?? null,
            awayScoreHalf: input.awayScoreHalf ?? null,
            homeScoreFull: input.homeScoreFull ?? null,
            awayScoreFull: input.awayScoreFull ?? null,
          },
        },
      },
      select: { id: true },
    });
    return { eventId: created.id };
  }

  async updateSyncedMatchSchedulePreservingLocal(input: {
    eventId: string;
    title: string;
    startAt: Date;
    endAt: Date | null;
    venueId: string | null;
    isCancelled: boolean;
    opponentName: string;
    isHome: boolean;
    backfillScores?: {
      homeScoreFull: number;
      awayScoreFull: number;
      homeScoreHalf: number | null;
      awayScoreHalf: number | null;
    } | null;
  }): Promise<void> {
    // VERBINDLICHER SCHUTZ LOKALER ANREICHERUNGEN:
    // Nur externe Terminfelder werden aktualisiert; meetingAt, description,
    // jerseyColor, nominatedMemberIds, refereeNote und carpools werden NICHT berührt!
    // Ergebnisse werden nur nachgetragen, wenn explizit über `backfillScores` übergeben.
    const scoreData = input.backfillScores
      ? {
          homeScoreFull: input.backfillScores.homeScoreFull,
          awayScoreFull: input.backfillScores.awayScoreFull,
          ...(input.backfillScores.homeScoreHalf !== null
            ? { homeScoreHalf: input.backfillScores.homeScoreHalf }
            : {}),
          ...(input.backfillScores.awayScoreHalf !== null
            ? { awayScoreHalf: input.backfillScores.awayScoreHalf }
            : {}),
        }
      : {};

    await prisma.$transaction([
      prisma.event.update({
        where: { id: input.eventId },
        data: {
          title: input.title,
          startAt: input.startAt,
          endAt: input.endAt,
          ...(input.venueId !== null ? { venueId: input.venueId } : {}),
          isCancelled: input.isCancelled,
        },
      }),
      prisma.matchDetails.upsert({
        where: { eventId: input.eventId },
        update: {
          opponentName: input.opponentName,
          isHome: input.isHome,
          throwOffAt: input.startAt,
          ...scoreData,
        },
        create: {
          eventId: input.eventId,
          opponentName: input.opponentName,
          isHome: input.isHome,
          throwOffAt: input.startAt,
          ...scoreData,
        },
      }),
    ]);
  }

  async createChangeLog(input: {
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
  }): Promise<LeagueSyncChangeLogDTO> {
    const row = await prisma.leagueSyncChangeLog.create({
      data: {
        sourceId: input.sourceId,
        teamId: input.teamId,
        eventId: input.eventId,
        externalId: input.externalId,
        changeType: input.changeType,
        summary: input.summary,
        oldStartAt: input.oldStartAt ?? null,
        newStartAt: input.newStartAt ?? null,
        oldVenueName: input.oldVenueName ?? null,
        newVenueName: input.newVenueName ?? null,
      },
      include: { source: { select: { name: true } } },
    });
    return mapChangeLog(row);
  }

  async listChangeLogsByTeam(
    teamId: string,
    limit = 50
  ): Promise<LeagueSyncChangeLogDTO[]> {
    const rows = await prisma.leagueSyncChangeLog.findMany({
      where: { teamId },
      include: { source: { select: { name: true } } },
      orderBy: { detectedAt: "desc" },
      take: limit,
    });
    return rows.map(mapChangeLog);
  }
}

const CARPOOL_INCLUDE = {
  event: { select: { clubId: true, teamId: true } },
  driverMember: { select: { firstName: true, lastName: true, userId: true } },
  bookings: {
    include: {
      passengerMember: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

function mapCarpool(c: {
  id: string;
  eventId: string;
  driverMemberId: string;
  driverMember: { firstName: string; lastName: string; userId: string | null };
  departureLocation: string;
  departureTime: string | null;
  totalSeats: number;
  notes: string | null;
  createdAt: Date;
  bookings: Array<{
    id: string;
    carpoolId: string;
    passengerMemberId: string;
    passengerMember: { firstName: string; lastName: string };
    bookedByUserId: string;
    createdAt: Date;
  }>;
}): CarpoolDTO {
  return {
    id: c.id,
    eventId: c.eventId,
    driverMemberId: c.driverMemberId,
    driverFirstName: c.driverMember.firstName,
    driverLastName: c.driverMember.lastName,
    driverUserId: c.driverMember.userId,
    departureLocation: c.departureLocation,
    departureTime: c.departureTime,
    totalSeats: c.totalSeats,
    availableSeats: Math.max(0, c.totalSeats - c.bookings.length),
    notes: c.notes,
    bookings: c.bookings.map((b) => ({
      id: b.id,
      carpoolId: b.carpoolId,
      passengerMemberId: b.passengerMemberId,
      passengerFirstName: b.passengerMember.firstName,
      passengerLastName: b.passengerMember.lastName,
      bookedByUserId: b.bookedByUserId,
      createdAt: b.createdAt.toISOString(),
    })),
    createdAt: c.createdAt.toISOString(),
  };
}

export class PrismaCarpoolRepository implements CarpoolRepository {
  async listByEventId(eventId: string): Promise<CarpoolDTO[]> {
    const rows = await prisma.carpool.findMany({
      where: { eventId },
      include: CARPOOL_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapCarpool);
  }

  async findById(
    carpoolId: string
  ): Promise<(CarpoolDTO & { clubId: string; teamId: string }) | null> {
    const row = await prisma.carpool.findUnique({
      where: { id: carpoolId },
      include: CARPOOL_INCLUDE,
    });
    if (!row) return null;
    return {
      ...mapCarpool(row),
      clubId: row.event.clubId,
      teamId: row.event.teamId,
    };
  }

  async create(eventId: string, input: CreateCarpoolInput): Promise<CarpoolDTO> {
    const row = await prisma.carpool.create({
      data: {
        eventId,
        driverMemberId: input.driverMemberId,
        departureLocation: input.departureLocation,
        departureTime: input.departureTime ?? null,
        totalSeats: input.totalSeats,
        notes: input.notes ?? null,
      },
      include: CARPOOL_INCLUDE,
    });
    return mapCarpool(row);
  }

  async delete(carpoolId: string): Promise<void> {
    await prisma.carpool.delete({ where: { id: carpoolId } });
  }

  async findBookingById(bookingId: string) {
    const row = await prisma.carpoolBooking.findUnique({
      where: { id: bookingId },
      include: {
        passengerMember: { select: { userId: true } },
        carpool: {
          select: {
            eventId: true,
            event: { select: { clubId: true, teamId: true } },
          },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      carpoolId: row.carpoolId,
      eventId: row.carpool.eventId,
      clubId: row.carpool.event.clubId,
      teamId: row.carpool.event.teamId,
      passengerMemberId: row.passengerMemberId,
      passengerUserId: row.passengerMember.userId,
      bookedByUserId: row.bookedByUserId,
    };
  }

  async createBooking(input: {
    carpoolId: string;
    passengerMemberId: string;
    bookedByUserId: string;
  }): Promise<CarpoolBookingDTO> {
    const row = await prisma.carpoolBooking.create({
      data: input,
      include: {
        passengerMember: { select: { firstName: true, lastName: true } },
      },
    });
    return {
      id: row.id,
      carpoolId: row.carpoolId,
      passengerMemberId: row.passengerMemberId,
      passengerFirstName: row.passengerMember.firstName,
      passengerLastName: row.passengerMember.lastName,
      bookedByUserId: row.bookedByUserId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async deleteBooking(bookingId: string): Promise<void> {
    await prisma.carpoolBooking.delete({ where: { id: bookingId } });
  }
}
