import {
  CreateEventRecordInput,
  CreateRecurrenceRecordInput,
  EventRepository,
  VenueRepository,
} from "@/domain/adapters/event-repositories";
import {
  CreateVenueInput,
  DeclineReasonCategory,
  EventAttendanceEntity,
  EventEntity,
  EventType,
  MatchDetailsDTO,
  UpdateEventInput,
  UpdateMatchDetailsInput,
  UpdateVenueInput,
  VenueDTO,
} from "@/domain/schemas/event";
import { RsvpStatus } from "@/domain/schemas/handball";
import { prisma } from "../db/prisma";

function mapVenue(v: {
  id: string;
  clubId: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  resinPolicy: VenueDTO["resinPolicy"];
  notes: string | null;
}): VenueDTO {
  return {
    id: v.id,
    clubId: v.clubId,
    name: v.name,
    address: v.address,
    mapsUrl: v.mapsUrl,
    latitude: v.latitude,
    longitude: v.longitude,
    resinPolicy: v.resinPolicy,
    notes: v.notes,
  };
}

function mapMatchDetails(m: {
  id: string;
  eventId: string;
  opponentName: string;
  isHome: boolean;
  throwOffAt: Date | null;
  jerseyColor: string | null;
  refereeNote: string | null;
  nominatedMemberIds: string[];
  homeScoreHalf: number | null;
  awayScoreHalf: number | null;
  homeScoreFull: number | null;
  awayScoreFull: number | null;
}): MatchDetailsDTO {
  return {
    id: m.id,
    eventId: m.eventId,
    opponentName: m.opponentName,
    isHome: m.isHome,
    throwOffAt: m.throwOffAt ? m.throwOffAt.toISOString() : null,
    jerseyColor: m.jerseyColor,
    refereeNote: m.refereeNote,
    nominatedMemberIds: m.nominatedMemberIds,
    homeScoreHalf: m.homeScoreHalf,
    awayScoreHalf: m.awayScoreHalf,
    homeScoreFull: m.homeScoreFull,
    awayScoreFull: m.awayScoreFull,
  };
}

const EVENT_INCLUDE = {
  venue: true,
  matchDetails: true,
  attendances: {
    include: {
      member: {
        select: {
          clubId: true,
          teamId: true,
          userId: true,
          firstName: true,
          lastName: true,
          jerseyNumber: true,
          primaryPosition: true,
        },
      },
    },
    orderBy: [
      { member: { jerseyNumber: "asc" as const } },
      { member: { lastName: "asc" as const } },
    ],
  },
};

type PrismaEventWithRelations = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.event.findUnique<{
        where: { id: string };
        include: typeof EVENT_INCLUDE;
      }>
    >
  >
>;

function mapEvent(ev: PrismaEventWithRelations): EventEntity {
  return {
    id: ev.id,
    clubId: ev.clubId,
    teamId: ev.teamId,
    recurrenceId: ev.recurrenceId,
    venueId: ev.venueId,
    venue: ev.venue ? mapVenue(ev.venue) : null,
    type: ev.type,
    title: ev.title,
    description: ev.description,
    startAt: ev.startAt,
    endAt: ev.endAt,
    meetingAt: ev.meetingAt,
    rsvpDeadlineAt: ev.rsvpDeadlineAt,
    requireDeclineReason: ev.requireDeclineReason,
    isCancelled: ev.isCancelled,
    matchDetails: ev.matchDetails ? mapMatchDetails(ev.matchDetails) : null,
    attendances: ev.attendances.map((a) => ({
      id: a.id,
      eventId: a.eventId,
      memberId: a.memberId,
      clubId: a.member.clubId,
      teamId: a.member.teamId,
      memberUserId: a.member.userId,
      memberFirstName: a.member.firstName,
      memberLastName: a.member.lastName,
      memberJerseyNumber: a.member.jerseyNumber,
      memberPrimaryPosition: a.member.primaryPosition,
      status: a.status,
      declineReasonCategory: a.declineReasonCategory,
      declineReason: a.declineReason,
      respondedAt: a.respondedAt,
    })),
  };
}

export class PrismaVenueRepository implements VenueRepository {
  async findByClubId(clubId: string): Promise<VenueDTO[]> {
    const rows = await prisma.venue.findMany({
      where: { clubId },
      orderBy: { name: "asc" },
    });
    return rows.map(mapVenue);
  }

  async findById(venueId: string): Promise<VenueDTO | null> {
    const row = await prisma.venue.findUnique({ where: { id: venueId } });
    return row ? mapVenue(row) : null;
  }

  async create(clubId: string, input: CreateVenueInput): Promise<VenueDTO> {
    const row = await prisma.venue.create({
      data: {
        clubId,
        name: input.name,
        address: input.address ?? null,
        mapsUrl: input.mapsUrl ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        resinPolicy: input.resinPolicy,
        notes: input.notes ?? null,
      },
    });
    return mapVenue(row);
  }

  async update(venueId: string, input: UpdateVenueInput): Promise<VenueDTO> {
    const row = await prisma.venue.update({
      where: { id: venueId },
      data: input,
    });
    return mapVenue(row);
  }

  async delete(venueId: string): Promise<void> {
    await prisma.venue.delete({ where: { id: venueId } });
  }
}

export class PrismaEventRepository implements EventRepository {
  async findByTeamId(
    teamId: string,
    options?: { from?: Date; to?: Date; type?: EventType }
  ): Promise<EventEntity[]> {
    const rows = await prisma.event.findMany({
      where: {
        teamId,
        ...(options?.type ? { type: options.type } : {}),
        ...(options?.from || options?.to
          ? {
              startAt: {
                ...(options?.from ? { gte: options.from } : {}),
                ...(options?.to ? { lte: options.to } : {}),
              },
            }
          : {}),
      },
      include: EVENT_INCLUDE,
      orderBy: { startAt: "asc" },
    });
    return rows.map(mapEvent);
  }

  async findById(eventId: string): Promise<EventEntity | null> {
    const row = await prisma.event.findUnique({
      where: { id: eventId },
      include: EVENT_INCLUDE,
    });
    return row ? mapEvent(row) : null;
  }

  async createSingle(input: CreateEventRecordInput): Promise<EventEntity> {
    const created = await prisma.event.create({
      data: {
        clubId: input.clubId,
        teamId: input.teamId,
        recurrenceId: input.recurrenceId ?? null,
        venueId: input.venueId ?? null,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        meetingAt: input.meetingAt ?? null,
        rsvpDeadlineAt: input.rsvpDeadlineAt ?? null,
        requireDeclineReason: input.requireDeclineReason,
        ...(input.matchDetails
          ? {
              matchDetails: {
                create: {
                  opponentName: input.matchDetails.opponentName,
                  isHome: input.matchDetails.isHome,
                  throwOffAt: input.matchDetails.throwOffAt ?? input.startAt,
                  jerseyColor: input.matchDetails.jerseyColor ?? null,
                  refereeNote: input.matchDetails.refereeNote ?? null,
                },
              },
            }
          : {}),
      },
      include: EVENT_INCLUDE,
    });
    return mapEvent(created);
  }

  async createRecurringSeries(
    recurrence: CreateRecurrenceRecordInput,
    occurrences: Array<{
      startAt: Date;
      endAt: Date;
      rsvpDeadlineAt: Date | null;
    }>
  ): Promise<{ recurrenceId: string; events: EventEntity[] }> {
    const result = await prisma.$transaction(async (tx) => {
      const rec = await tx.eventRecurrence.create({
        data: {
          clubId: recurrence.clubId,
          teamId: recurrence.teamId,
          venueId: recurrence.venueId ?? null,
          type: recurrence.type,
          title: recurrence.title,
          description: recurrence.description ?? null,
          daysOfWeek: recurrence.daysOfWeek,
          startTime: recurrence.startTime,
          endTime: recurrence.endTime,
          startDate: recurrence.startDate,
          endDate: recurrence.endDate,
          excludedDates: recurrence.excludedDates,
          rsvpDeadlineHours: recurrence.rsvpDeadlineHours ?? null,
          requireDeclineReason: recurrence.requireDeclineReason,
        },
      });

      const createdEvents: PrismaEventWithRelations[] = [];
      for (const occ of occurrences) {
        const ev = await tx.event.create({
          data: {
            clubId: recurrence.clubId,
            teamId: recurrence.teamId,
            recurrenceId: rec.id,
            venueId: recurrence.venueId ?? null,
            type: recurrence.type,
            title: recurrence.title,
            description: recurrence.description ?? null,
            startAt: occ.startAt,
            endAt: occ.endAt,
            rsvpDeadlineAt: occ.rsvpDeadlineAt,
            requireDeclineReason: recurrence.requireDeclineReason,
          },
          include: EVENT_INCLUDE,
        });
        createdEvents.push(ev);
      }

      return { recurrenceId: rec.id, events: createdEvents };
    });

    return {
      recurrenceId: result.recurrenceId,
      events: result.events.map(mapEvent),
    };
  }

  async update(eventId: string, input: UpdateEventInput): Promise<EventEntity> {
    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.venueId !== undefined ? { venueId: input.venueId } : {}),
        ...(input.startAt !== undefined
          ? { startAt: new Date(input.startAt) }
          : {}),
        ...(input.endAt !== undefined
          ? { endAt: input.endAt ? new Date(input.endAt) : null }
          : {}),
        ...(input.meetingAt !== undefined
          ? { meetingAt: input.meetingAt ? new Date(input.meetingAt) : null }
          : {}),
        ...(input.rsvpDeadlineAt !== undefined
          ? {
              rsvpDeadlineAt: input.rsvpDeadlineAt
                ? new Date(input.rsvpDeadlineAt)
                : null,
            }
          : {}),
        ...(input.requireDeclineReason !== undefined
          ? { requireDeclineReason: input.requireDeclineReason }
          : {}),
        ...(input.isCancelled !== undefined
          ? { isCancelled: input.isCancelled }
          : {}),
      },
      include: EVENT_INCLUDE,
    });
    return mapEvent(updated);
  }

  async delete(eventId: string): Promise<void> {
    await prisma.event.delete({ where: { id: eventId } });
  }

  async upsertAttendance(input: {
    eventId: string;
    memberId: string;
    status: RsvpStatus;
    declineReasonCategory: DeclineReasonCategory | null;
    declineReason: string | null;
    respondedByUserId: string;
  }): Promise<EventAttendanceEntity> {
    const row = await prisma.eventAttendance.upsert({
      where: {
        eventId_memberId: {
          eventId: input.eventId,
          memberId: input.memberId,
        },
      },
      update: {
        status: input.status,
        declineReasonCategory: input.declineReasonCategory,
        declineReason: input.declineReason,
        respondedByUserId: input.respondedByUserId,
        respondedAt: new Date(),
      },
      create: {
        eventId: input.eventId,
        memberId: input.memberId,
        status: input.status,
        declineReasonCategory: input.declineReasonCategory,
        declineReason: input.declineReason,
        respondedByUserId: input.respondedByUserId,
        respondedAt: new Date(),
      },
      include: {
        member: {
          select: {
            clubId: true,
            teamId: true,
            userId: true,
            firstName: true,
            lastName: true,
            jerseyNumber: true,
            primaryPosition: true,
          },
        },
      },
    });

    return {
      id: row.id,
      eventId: row.eventId,
      memberId: row.memberId,
      clubId: row.member.clubId,
      teamId: row.member.teamId,
      memberUserId: row.member.userId,
      memberFirstName: row.member.firstName,
      memberLastName: row.member.lastName,
      memberJerseyNumber: row.member.jerseyNumber,
      memberPrimaryPosition: row.member.primaryPosition,
      status: row.status,
      declineReasonCategory: row.declineReasonCategory,
      declineReason: row.declineReason,
      respondedAt: row.respondedAt,
    };
  }

  async upsertMatchDetails(
    eventId: string,
    input: UpdateMatchDetailsInput
  ): Promise<MatchDetailsDTO> {
    const row = await prisma.matchDetails.upsert({
      where: { eventId },
      update: {
        ...(input.opponentName !== undefined
          ? { opponentName: input.opponentName }
          : {}),
        ...(input.isHome !== undefined ? { isHome: input.isHome } : {}),
        ...(input.throwOffAt !== undefined
          ? {
              throwOffAt: input.throwOffAt ? new Date(input.throwOffAt) : null,
            }
          : {}),
        ...(input.jerseyColor !== undefined
          ? { jerseyColor: input.jerseyColor }
          : {}),
        ...(input.refereeNote !== undefined
          ? { refereeNote: input.refereeNote }
          : {}),
        ...(input.nominatedMemberIds !== undefined
          ? { nominatedMemberIds: input.nominatedMemberIds }
          : {}),
        ...(input.homeScoreHalf !== undefined
          ? { homeScoreHalf: input.homeScoreHalf }
          : {}),
        ...(input.awayScoreHalf !== undefined
          ? { awayScoreHalf: input.awayScoreHalf }
          : {}),
        ...(input.homeScoreFull !== undefined
          ? { homeScoreFull: input.homeScoreFull }
          : {}),
        ...(input.awayScoreFull !== undefined
          ? { awayScoreFull: input.awayScoreFull }
          : {}),
      },
      create: {
        eventId,
        opponentName: input.opponentName ?? "Gegner",
        isHome: input.isHome ?? true,
        throwOffAt: input.throwOffAt ? new Date(input.throwOffAt) : null,
        jerseyColor: input.jerseyColor ?? null,
        refereeNote: input.refereeNote ?? null,
        nominatedMemberIds: input.nominatedMemberIds ?? [],
        homeScoreHalf: input.homeScoreHalf ?? null,
        awayScoreHalf: input.awayScoreHalf ?? null,
        homeScoreFull: input.homeScoreFull ?? null,
        awayScoreFull: input.awayScoreFull ?? null,
      },
    });
    return mapMatchDetails(row);
  }
}
