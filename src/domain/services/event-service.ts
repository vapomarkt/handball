import {
  EventRepository,
  VenueRepository,
} from "../adapters/event-repositories";
import { JerseySetRepository } from "../adapters/jersey-set-repository";
import { MemberRepository, TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import { projectEventAttendanceDTO } from "../policies/gdpr";
import {
  canManageEvents,
  canSubmitRsvpForMember,
  canViewTeam,
  isTeamStaff,
  ViewerContext,
} from "../policies/rbac";
import {
  CreateEventSchema,
  CreateRecurringEventsSchema,
  EventAttendanceResponseDTO,
  EventDTO,
  EventEntity,
  EventType,
  MatchDetailsDTO,
  MemberAttendanceStatDTO,
  SubmitRsvpSchema,
  UpdateEventSchema,
  UpdateMatchDetailsInput,
  UpdateMatchDetailsSchema,
} from "../schemas/event";
import { expandRecurrenceDates } from "./recurrence";

function projectEventDTO(
  viewer: ViewerContext,
  event: EventEntity,
  totalRosterPlayers: number
): EventDTO {
  const attendances = event.attendances.map((a) =>
    projectEventAttendanceDTO(viewer, a)
  );

  let accepted = 0;
  let declined = 0;
  let maybe = 0;
  let explicitPending = 0;

  for (const a of attendances) {
    if (a.status === "ACCEPTED") accepted += 1;
    else if (a.status === "DECLINED") declined += 1;
    else if (a.status === "MAYBE") maybe += 1;
    else explicitPending += 1;
  }

  const responded = accepted + declined + maybe;
  const pending = Math.max(explicitPending, totalRosterPlayers - responded);

  return {
    id: event.id,
    clubId: event.clubId,
    teamId: event.teamId,
    recurrenceId: event.recurrenceId,
    venueId: event.venueId,
    venue: event.venue,
    type: event.type,
    title: event.title,
    description: event.description,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt ? event.endAt.toISOString() : null,
    meetingAt: event.meetingAt ? event.meetingAt.toISOString() : null,
    rsvpDeadlineAt: event.rsvpDeadlineAt
      ? event.rsvpDeadlineAt.toISOString()
      : null,
    requireDeclineReason: event.requireDeclineReason,
    isCancelled: event.isCancelled,
    matchDetails: event.matchDetails,
    attendances,
    summary: {
      accepted,
      declined,
      maybe,
      pending,
    },
  };
}

export class EventService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly members: MemberRepository,
    private readonly venues: VenueRepository,
    private readonly events: EventRepository,
    private readonly jerseySets?: JerseySetRepository
  ) {}

  async listEvents(
    viewer: ViewerContext,
    teamId: string,
    options?: { from?: Date; to?: Date; type?: EventType }
  ): Promise<EventDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf die Termine dieser Mannschaft.");
    }

    const [roster, events] = await Promise.all([
      this.members.findByTeamId(teamId),
      this.events.findByTeamId(teamId, options),
    ]);

    const playerCount = roster.filter((m) => m.role === "PLAYER").length;
    return events.map((ev) => projectEventDTO(viewer, ev, playerCount));
  }

  async getEvent(
    viewer: ViewerContext,
    teamId: string,
    eventId: string
  ): Promise<EventDTO> {
    const event = await this.events.findById(eventId);
    if (!event || event.teamId !== teamId) {
      throw DomainError.notFound("Termin nicht gefunden.");
    }
    if (!canViewTeam(viewer, event.teamId, event.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Termin.");
    }

    const roster = await this.members.findByTeamId(teamId);
    const playerCount = roster.filter((m) => m.role === "PLAYER").length;
    return projectEventDTO(viewer, event, playerCount);
  }

  async createSingleEvent(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<EventDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Termine anlegen."
      );
    }

    const parsed = CreateEventSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Termindaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const data = parsed.data;
    if (data.venueId) {
      const venue = await this.venues.findById(data.venueId);
      if (!venue || venue.clubId !== team.clubId) {
        throw DomainError.notFound("Ausgewählte Halle nicht gefunden.");
      }
    }

    let resolvedJerseyColor = data.matchDetails?.jerseyColor ?? null;
    const resolvedJerseySetId = data.matchDetails?.jerseySetId ?? null;
    if (resolvedJerseySetId && this.jerseySets) {
      const jerseySet = await this.jerseySets.findById(resolvedJerseySetId);
      if (!jerseySet || jerseySet.clubId !== team.clubId) {
        throw DomainError.notFound("Ausgewählter Trikotsatz nicht gefunden.");
      }
      if (!resolvedJerseyColor) {
        resolvedJerseyColor = jerseySet.colors;
      }
    }

    const created = await this.events.createSingle({
      clubId: team.clubId,
      teamId: team.id,
      venueId: data.venueId ?? null,
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
      meetingAt: data.meetingAt ? new Date(data.meetingAt) : null,
      rsvpDeadlineAt: data.rsvpDeadlineAt
        ? new Date(data.rsvpDeadlineAt)
        : null,
      requireDeclineReason: data.requireDeclineReason,
      matchDetails: data.matchDetails
        ? {
            opponentName: data.matchDetails.opponentName,
            isHome: data.matchDetails.isHome,
            throwOffAt: data.matchDetails.throwOffAt
              ? new Date(data.matchDetails.throwOffAt)
              : new Date(data.startAt),
            jerseyColor: resolvedJerseyColor,
            jerseySetId: resolvedJerseySetId,
            refereeNote: data.matchDetails.refereeNote ?? null,
          }
        : undefined,
    });

    const roster = await this.members.findByTeamId(teamId);
    const playerCount = roster.filter((m) => m.role === "PLAYER").length;
    return projectEventDTO(viewer, created, playerCount);
  }

  async createRecurringEvents(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<{ recurrenceId: string; events: EventDTO[] }> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Serientermine anlegen."
      );
    }

    const parsed = CreateRecurringEventsSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Serientermindaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const data = parsed.data;
    if (data.venueId) {
      const venue = await this.venues.findById(data.venueId);
      if (!venue || venue.clubId !== team.clubId) {
        throw DomainError.notFound("Ausgewählte Halle nicht gefunden.");
      }
    }

    const occurrences = expandRecurrenceDates({
      daysOfWeek: data.daysOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      startDate: data.startDate,
      endDate: data.endDate,
      excludedDates: data.excludedDates,
      rsvpDeadlineHours: data.rsvpDeadlineHours,
    });

    const result = await this.events.createRecurringSeries(
      {
        clubId: team.clubId,
        teamId: team.id,
        venueId: data.venueId ?? null,
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        daysOfWeek: data.daysOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        startDate: new Date(`${data.startDate}T00:00:00.000Z`),
        endDate: new Date(`${data.endDate}T23:59:59.000Z`),
        excludedDates: data.excludedDates,
        rsvpDeadlineHours: data.rsvpDeadlineHours ?? null,
        requireDeclineReason: data.requireDeclineReason,
      },
      occurrences.map((o) => ({
        startAt: o.startAt,
        endAt: o.endAt,
        rsvpDeadlineAt: o.rsvpDeadlineAt,
      }))
    );

    const roster = await this.members.findByTeamId(teamId);
    const playerCount = roster.filter((m) => m.role === "PLAYER").length;
    return {
      recurrenceId: result.recurrenceId,
      events: result.events.map((ev) =>
        projectEventDTO(viewer, ev, playerCount)
      ),
    };
  }

  async updateEvent(
    viewer: ViewerContext,
    teamId: string,
    eventId: string,
    rawInput: unknown
  ): Promise<EventDTO> {
    const existing = await this.events.findById(eventId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Termin nicht gefunden.");
    }
    if (!canManageEvents(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Bearbeiten.");
    }

    const parsed = UpdateEventSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Termindaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const updated = await this.events.update(eventId, parsed.data);
    const roster = await this.members.findByTeamId(teamId);
    const playerCount = roster.filter((m) => m.role === "PLAYER").length;
    return projectEventDTO(viewer, updated, playerCount);
  }

  async deleteEvent(
    viewer: ViewerContext,
    teamId: string,
    eventId: string
  ): Promise<void> {
    const existing = await this.events.findById(eventId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Termin nicht gefunden.");
    }
    if (!canManageEvents(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.events.delete(eventId);
  }

  async submitRsvp(
    viewer: ViewerContext,
    teamId: string,
    eventId: string,
    rawInput: unknown,
    now = new Date()
  ): Promise<EventAttendanceResponseDTO> {
    const event = await this.events.findById(eventId);
    if (!event || event.teamId !== teamId) {
      throw DomainError.notFound("Termin nicht gefunden.");
    }
    if (event.isCancelled) {
      throw DomainError.validation("Dieser Termin wurde abgesagt.");
    }

    const parsed = SubmitRsvpSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Rückmeldedaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const member = await this.members.findById(parsed.data.memberId);
    if (!member || member.teamId !== teamId) {
      throw DomainError.notFound("Kader-Mitglied nicht gefunden.");
    }

    if (!canSubmitRsvpForMember(viewer, member)) {
      throw DomainError.forbidden(
        "Du darfst nur für dich selbst oder deine verknüpften Kinder rückmelden."
      );
    }

    // Frist prüfen (Trainer/Admin dürfen auch nach Fristablauf noch eintragen)
    const staff = isTeamStaff(viewer, event.teamId, event.clubId);
    if (
      !staff &&
      event.rsvpDeadlineAt &&
      now.getTime() > event.rsvpDeadlineAt.getTime()
    ) {
      throw DomainError.validation(
        "Die Rückmeldefrist für diesen Termin ist bereits abgelaufen."
      );
    }

    // Pflicht-Absagegrund prüfen
    if (
      parsed.data.status === "DECLINED" &&
      event.requireDeclineReason &&
      !parsed.data.declineReasonCategory &&
      !parsed.data.declineReason
    ) {
      throw DomainError.validation(
        "Für eine Absage ist ein Absagegrund erforderlich."
      );
    }

    const isDeclined = parsed.data.status === "DECLINED";
    const saved = await this.events.upsertAttendance({
      eventId: event.id,
      memberId: member.id,
      status: parsed.data.status,
      declineReasonCategory: isDeclined
        ? (parsed.data.declineReasonCategory ?? null)
        : null,
      declineReason: isDeclined ? (parsed.data.declineReason ?? null) : null,
      respondedByUserId: viewer.userId,
    });

    return projectEventAttendanceDTO(viewer, saved);
  }

  async updateMatchDetails(
    viewer: ViewerContext,
    teamId: string,
    eventId: string,
    rawInput: unknown
  ): Promise<MatchDetailsDTO> {
    const event = await this.events.findById(eventId);
    if (!event || event.teamId !== teamId) {
      throw DomainError.notFound("Termin nicht gefunden.");
    }
    if (event.type !== "MATCH") {
      throw DomainError.validation(
        "Spieltagsdetails können nur für Punktspiele bearbeitet werden."
      );
    }
    if (!canManageEvents(viewer, event.teamId, event.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Spieltagsdetails bearbeiten."
      );
    }

    const parsed = UpdateMatchDetailsSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Spieltagsdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    // Validieren, dass nominierte Spieler zum Team gehören
    if (parsed.data.nominatedMemberIds) {
      const roster = await this.members.findByTeamId(teamId);
      const validIds = new Set(roster.map((m) => m.id));
      const invalid = parsed.data.nominatedMemberIds.filter(
        (id) => !validIds.has(id)
      );
      if (invalid.length > 0) {
        throw DomainError.validation(
          "Mindestens ein nominierter Spieler gehört nicht zu dieser Mannschaft."
        );
      }
    }

    const updatePayload: UpdateMatchDetailsInput & {
      scoreManuallyEdited?: boolean;
    } = { ...parsed.data };
    if (updatePayload.jerseySetId && this.jerseySets) {
      const jerseySet = await this.jerseySets.findById(
        updatePayload.jerseySetId
      );
      if (!jerseySet || jerseySet.clubId !== event.clubId) {
        throw DomainError.notFound("Ausgewählter Trikotsatz nicht gefunden.");
      }
      if (!updatePayload.jerseyColor) {
        updatePayload.jerseyColor = jerseySet.colors;
      }
    }

    const existingMd = event.matchDetails;
    const scoreKeysProvided =
      parsed.data.homeScoreFull !== undefined ||
      parsed.data.awayScoreFull !== undefined ||
      parsed.data.homeScoreHalf !== undefined ||
      parsed.data.awayScoreHalf !== undefined;

    if (scoreKeysProvided) {
      const nextHomeFull =
        parsed.data.homeScoreFull !== undefined
          ? parsed.data.homeScoreFull
          : (existingMd?.homeScoreFull ?? null);
      const nextAwayFull =
        parsed.data.awayScoreFull !== undefined
          ? parsed.data.awayScoreFull
          : (existingMd?.awayScoreFull ?? null);
      const nextHomeHalf =
        parsed.data.homeScoreHalf !== undefined
          ? parsed.data.homeScoreHalf
          : (existingMd?.homeScoreHalf ?? null);
      const nextAwayHalf =
        parsed.data.awayScoreHalf !== undefined
          ? parsed.data.awayScoreHalf
          : (existingMd?.awayScoreHalf ?? null);

      const scoreChanged =
        nextHomeFull !== (existingMd?.homeScoreFull ?? null) ||
        nextAwayFull !== (existingMd?.awayScoreFull ?? null) ||
        nextHomeHalf !== (existingMd?.homeScoreHalf ?? null) ||
        nextAwayHalf !== (existingMd?.awayScoreHalf ?? null);

      if (scoreChanged) {
        if (nextHomeFull === null && nextAwayFull === null) {
          // Endstand bewusst geleert -> Reset, nächster Sync darf wieder offiziell befüllen
          updatePayload.scoreManuallyEdited = false;
        } else {
          const officialHomeFull = existingMd?.officialHomeScoreFull ?? null;
          const officialAwayFull = existingMd?.officialAwayScoreFull ?? null;
          const officialHomeHalf = existingMd?.officialHomeScoreHalf ?? null;
          const officialAwayHalf = existingMd?.officialAwayScoreHalf ?? null;

          const hasOfficial =
            officialHomeFull !== null && officialAwayFull !== null;
          const matchesOfficialFull =
            hasOfficial &&
            nextHomeFull === officialHomeFull &&
            nextAwayFull === officialAwayFull;
          const matchesOfficialHalf =
            officialHomeHalf === null ||
            officialAwayHalf === null ||
            (nextHomeHalf === officialHomeHalf &&
              nextAwayHalf === officialAwayHalf);

          updatePayload.scoreManuallyEdited = !(
            matchesOfficialFull && matchesOfficialHalf
          );
        }
      }
    }

    return this.events.upsertMatchDetails(event.id, updatePayload);
  }

  async getAttendanceStats(
    viewer: ViewerContext,
    teamId: string,
    type?: EventType
  ): Promise<MemberAttendanceStatDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Kein Zugriff auf die Anwesenheitsstatistik dieser Mannschaft."
      );
    }

    const [roster, events] = await Promise.all([
      this.members.findByTeamId(teamId),
      this.events.findByTeamId(teamId, type ? { type } : undefined),
    ]);

    const activeEvents = events.filter((e) => !e.isCancelled);
    const players = roster.filter((m) => m.role === "PLAYER");

    return players.map((player) => {
      let accepted = 0;
      let declined = 0;
      let maybe = 0;
      let pending = 0;

      for (const ev of activeEvents) {
        const record = ev.attendances.find((a) => a.memberId === player.id);
        if (!record || record.status === "PENDING") pending += 1;
        else if (record.status === "ACCEPTED") accepted += 1;
        else if (record.status === "DECLINED") declined += 1;
        else if (record.status === "MAYBE") maybe += 1;
      }

      const totalEvents = activeEvents.length;
      const participationRate =
        totalEvents > 0 ? Math.round((accepted / totalEvents) * 100) : 0;

      return {
        memberId: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        jerseyNumber: player.jerseyNumber,
        primaryPosition: player.primaryPosition,
        totalEvents,
        accepted,
        declined,
        maybe,
        pending,
        participationRate,
      };
    });
  }
}
