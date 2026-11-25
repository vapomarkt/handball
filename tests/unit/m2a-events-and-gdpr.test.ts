import { describe, expect, it } from "vitest";
import {
  EventRepository,
  VenueRepository,
} from "@/domain/adapters/event-repositories";
import { MemberRepository, TeamRecord, TeamRepository } from "@/domain/adapters/repositories";
import { projectEventAttendanceDTO } from "@/domain/policies/gdpr";
import { ViewerContext } from "@/domain/policies/rbac";
import {
  EventAttendanceEntity,
  EventEntity,
  VenueDTO,
} from "@/domain/schemas/event";
import { TeamMemberEntity } from "@/domain/schemas/member";
import { EventService } from "@/domain/services/event-service";
import { expandRecurrenceDates } from "@/domain/services/recurrence";
import { VenueService } from "@/domain/services/venue-service";

describe("Serientermin-Expansion (expandRecurrenceDates)", () => {
  it("erzeugt Di & Do Termine und überspringt Ferien-Ausnahmen exakt", () => {
    // 2026-10-05 ist Montag, 2026-10-06 Di, 2026-10-08 Do, 2026-10-13 Di, 2026-10-15 Do
    const occurrences = expandRecurrenceDates({
      daysOfWeek: [2, 4],
      startTime: "19:30",
      endTime: "21:00",
      startDate: "2026-10-05",
      endDate: "2026-10-16",
      excludedDates: ["2026-10-08"], // Ferien-Ausnahme am Donnerstag
      rsvpDeadlineHours: 4,
    });

    expect(occurrences.map((o) => o.dateIso)).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-15",
    ]);
    expect(occurrences[0].startAt.toISOString()).toBe(
      "2026-10-06T19:30:00.000Z"
    );
    expect(occurrences[0].endAt.toISOString()).toBe("2026-10-06T21:00:00.000Z");
    expect(occurrences[0].rsvpDeadlineAt?.toISOString()).toBe(
      "2026-10-06T15:30:00.000Z"
    );
  });

  it("lehnt ungültige Zeitbereiche (Ende <= Start) ab", () => {
    expect(() =>
      expandRecurrenceDates({
        daysOfWeek: [2],
        startTime: "21:00",
        endTime: "19:30",
        startDate: "2026-10-05",
        endDate: "2026-10-16",
        excludedDates: [],
      })
    ).toThrow(/Endzeit/);
  });
});

describe("DSGVO-Projektion für EventAttendance (Absagegründe)", () => {
  const attendance: EventAttendanceEntity = {
    id: "att-1",
    eventId: "ev-1",
    memberId: "m-jonas",
    clubId: "club-1",
    teamId: "team-1",
    memberUserId: "u-jonas",
    memberFirstName: "Jonas",
    memberLastName: "Keller",
    memberJerseyNumber: 7,
    memberPrimaryPosition: "LA",
    status: "DECLINED",
    declineReasonCategory: "INJURY",
    declineReason: "Bänderdehnung im Sprunggelenk",
    respondedAt: new Date("2026-10-01T12:00:00.000Z"),
  };

  const teammatePlayer: ViewerContext = {
    userId: "u-lukas",
    email: "lukas@tsv.de",
    name: "Lukas",
    memberships: [
      { memberId: "m-lukas", clubId: "club-1", teamId: "team-1", role: "PLAYER" },
    ],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  const coach: ViewerContext = {
    userId: "u-coach",
    email: "coach@tsv.de",
    name: "Markus",
    memberships: [
      { memberId: "m-coach", clubId: "club-1", teamId: "team-1", role: "COACH" },
    ],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  const selfJonas: ViewerContext = {
    userId: "u-jonas",
    email: "jonas@tsv.de",
    name: "Jonas",
    memberships: [
      { memberId: "m-jonas", clubId: "club-1", teamId: "team-1", role: "PLAYER" },
    ],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  it("entfernt declineReason und declineReasonCategory für Mitspieler (PLAYER) vollständig", () => {
    const dto = projectEventAttendanceDTO(teammatePlayer, attendance);
    expect(dto.canViewSensitive).toBe(false);
    expect(dto.status).toBe("DECLINED");
    expect("declineReason" in dto).toBe(false);
    expect("declineReasonCategory" in dto).toBe(false);
  });

  it("liefert declineReason und declineReasonCategory für Trainer und den Spieler selbst aus", () => {
    for (const viewer of [coach, selfJonas]) {
      const dto = projectEventAttendanceDTO(viewer, attendance);
      expect(dto.canViewSensitive).toBe(true);
      if (dto.canViewSensitive) {
        expect(dto.declineReasonCategory).toBe("INJURY");
        expect(dto.declineReason).toBe("Bänderdehnung im Sprunggelenk");
      }
    }
  });
});

describe("EventService & VenueService RBAC, RSVP-Regeln & Statistik", () => {
  const team: TeamRecord = {
    id: "team-1",
    clubId: "club-1",
    seasonId: "season-1",
    name: "mC-Jugend",
    category: "Jugend",
    gender: "MALE",
    leagueName: "BOL",
  };

  const leo: TeamMemberEntity = {
    id: "m-leo",
    clubId: "club-1",
    teamId: "team-1",
    userId: null,
    role: "PLAYER",
    firstName: "Leo",
    lastName: "Weber",
    email: null,
    phone: null,
    jerseyNumber: 14,
    primaryPosition: "RM",
    secondaryPosition: null,
    throwingHand: "RIGHT",
    availabilityStatus: "FIT",
    teamRoles: [],
    isMinor: true,
    passNumber: null,
    injuryNote: null,
    emergencyContact: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ben: TeamMemberEntity = {
    ...leo,
    id: "m-ben",
    firstName: "Ben",
    lastName: "Schulz",
    jerseyNumber: 1,
  };

  const baseEvent: EventEntity = {
    id: "ev-1",
    clubId: "club-1",
    teamId: "team-1",
    recurrenceId: null,
    venueId: null,
    venue: null,
    type: "TRAINING",
    title: "Jugendtraining",
    description: null,
    startAt: new Date("2026-11-28T17:30:00.000Z"),
    endAt: new Date("2026-11-28T19:00:00.000Z"),
    meetingAt: null,
    rsvpDeadlineAt: new Date("2026-11-28T14:00:00.000Z"),
    requireDeclineReason: true,
    isCancelled: false,
    matchDetails: null,
    attendances: [],
  };

  const parentViewer: ViewerContext = {
    userId: "u-parent",
    email: "katrin@tsv.de",
    name: "Katrin Weber",
    memberships: [
      { memberId: "m-parent", clubId: "club-1", teamId: "team-1", role: "PARENT" },
    ],
    linkedChildMemberIds: ["m-leo"],
    linkedChildTeamIds: ["team-1"],
  };

  const coachViewer: ViewerContext = {
    userId: "u-coach",
    email: "coach@tsv.de",
    name: "Markus",
    memberships: [
      { memberId: "m-coach", clubId: "club-1", teamId: "team-1", role: "COACH" },
    ],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  function makeServices() {
    const attendances: EventAttendanceEntity[] = [];
    const venues: VenueDTO[] = [];

    const teamRepo: TeamRepository = {
      findById: async (id) => (id === team.id ? team : null),
      findByClubId: async () => [team],
      create: async () => team,
      update: async () => team,
    };

    const memberRepo: MemberRepository = {
      findByTeamId: async () => [leo, ben],
      findById: async (id) => [leo, ben].find((m) => m.id === id) ?? null,
      findByTeamAndUser: async () => null,
      create: async () => leo,
      update: async () => leo,
      assignUser: async () => leo,
      delete: async () => {},
    };

    const venueRepo: VenueRepository = {
      findByClubId: async () => venues,
      findById: async (id) => venues.find((v) => v.id === id) ?? null,
      create: async (clubId, input) => {
        const v: VenueDTO = {
          id: `v-${venues.length + 1}`,
          clubId,
          name: input.name,
          address: input.address ?? null,
          mapsUrl: input.mapsUrl ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          resinPolicy: input.resinPolicy,
          notes: input.notes ?? null,
        };
        venues.push(v);
        return v;
      },
      update: async () => venues[0],
      delete: async () => {},
    };

    const eventRepo: EventRepository = {
      findByTeamId: async () => [{ ...baseEvent, attendances }],
      findById: async (id) =>
        id === baseEvent.id ? { ...baseEvent, attendances } : null,
      createSingle: async () => baseEvent,
      createRecurringSeries: async () => ({
        recurrenceId: "rec-1",
        events: [baseEvent],
      }),
      update: async () => baseEvent,
      delete: async () => {},
      upsertAttendance: async (input) => {
        const m = [leo, ben].find((x) => x.id === input.memberId)!;
        const entity: EventAttendanceEntity = {
          id: `att-${m.id}`,
          eventId: input.eventId,
          memberId: m.id,
          clubId: m.clubId,
          teamId: m.teamId,
          memberUserId: m.userId,
          memberFirstName: m.firstName,
          memberLastName: m.lastName,
          memberJerseyNumber: m.jerseyNumber,
          memberPrimaryPosition: m.primaryPosition,
          status: input.status,
          declineReasonCategory: input.declineReasonCategory,
          declineReason: input.declineReason,
          respondedAt: new Date(),
        };
        const idx = attendances.findIndex((a) => a.memberId === m.id);
        if (idx >= 0) attendances[idx] = entity;
        else attendances.push(entity);
        return entity;
      },
      upsertMatchDetails: async () => ({
        id: "md-1",
        eventId: baseEvent.id,
        opponentName: "SG Test",
        isHome: true,
        throwOffAt: null,
        jerseyColor: null,
        jerseySetId: null,
        jerseySet: null,
        refereeNote: null,
        nominatedMemberIds: [],
        homeScoreHalf: null,
        awayScoreHalf: null,
        homeScoreFull: null,
        awayScoreFull: null,
      }),
    };

    return {
      venueService: new VenueService(venueRepo),
      eventService: new EventService(teamRepo, memberRepo, venueRepo, eventRepo),
    };
  }

  it("erlaubt PARENT RSVP für verknüpftes Kind, blockiert aber fremdes Kind (403)", async () => {
    const { eventService } = makeServices();
    const beforeDeadline = new Date("2026-11-28T10:00:00.000Z");

    const ok = await eventService.submitRsvp(
      parentViewer,
      "team-1",
      "ev-1",
      { memberId: "m-leo", status: "ACCEPTED" },
      beforeDeadline
    );
    expect(ok.status).toBe("ACCEPTED");

    await expect(
      eventService.submitRsvp(
        parentViewer,
        "team-1",
        "ev-1",
        { memberId: "m-ben", status: "ACCEPTED" },
        beforeDeadline
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });

  it("erzwingt Pflicht-Absagegrund und prüft RSVP-Frist (Trainer darf Frist überschreiben)", async () => {
    const { eventService } = makeServices();
    const beforeDeadline = new Date("2026-11-28T10:00:00.000Z");
    const afterDeadline = new Date("2026-11-28T15:00:00.000Z");

    // Absage ohne Grund -> VALIDATION_ERROR
    await expect(
      eventService.submitRsvp(
        parentViewer,
        "team-1",
        "ev-1",
        { memberId: "m-leo", status: "DECLINED" },
        beforeDeadline
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", httpStatus: 400 });

    // Nach Fristablauf für PARENT blockiert
    await expect(
      eventService.submitRsvp(
        parentViewer,
        "team-1",
        "ev-1",
        { memberId: "m-leo", status: "ACCEPTED" },
        afterDeadline
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", httpStatus: 400 });

    // Trainer darf nach Fristablauf noch eintragen
    const byCoach = await eventService.submitRsvp(
      coachViewer,
      "team-1",
      "ev-1",
      {
        memberId: "m-leo",
        status: "DECLINED",
        declineReasonCategory: "SCHOOL_UNI",
        declineReason: "Klassenfahrt",
      },
      afterDeadline
    );
    expect(byCoach.status).toBe("DECLINED");
  });

  it("blockiert Hallen-Anlage für PARENT und erlaubt sie für COACH", async () => {
    const { venueService } = makeServices();

    await expect(
      venueService.createVenue(parentViewer, "club-1", {
        name: "Halle X",
        resinPolicy: "RESIN_FORBIDDEN",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    const created = await venueService.createVenue(coachViewer, "club-1", {
      name: "Halle X",
      resinPolicy: "RESIN_FORBIDDEN",
    });
    expect(created.resinPolicy).toBe("RESIN_FORBIDDEN");
  });

  it("berechnet Anwesenheitsstatistiken pro Spieler korrekt", async () => {
    const { eventService } = makeServices();
    await eventService.submitRsvp(
      coachViewer,
      "team-1",
      "ev-1",
      { memberId: "m-leo", status: "ACCEPTED" },
      new Date("2026-11-28T10:00:00.000Z")
    );

    const stats = await eventService.getAttendanceStats(coachViewer, "team-1");
    const leoStat = stats.find((s) => s.memberId === "m-leo");
    const benStat = stats.find((s) => s.memberId === "m-ben");
    expect(leoStat?.participationRate).toBe(100);
    expect(benStat?.participationRate).toBe(0);
    expect(benStat?.pending).toBe(1);
  });
});
