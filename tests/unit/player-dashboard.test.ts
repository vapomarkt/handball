import { describe, expect, it } from "vitest";
import type {
  TeamAnnouncementDTO,
  TeamPollDTO,
} from "@/domain/schemas/community";
import type { WorkDutyDTO } from "@/domain/schemas/duty";
import type { EventDTO } from "@/domain/schemas/event";
import {
  applyOptimisticRsvpToEvents,
  buildVenueMapsHref,
  getDashboardAnnouncements,
  getMemberRsvpStatus,
  getOpenUnvotedPolls,
  getPersonalUpcomingDuties,
  getUpcomingEvents,
  isAnyMemberNominated,
  isEventRsvpLocked,
} from "@/domain/services/player-dashboard";

const BASE_NOW = new Date("2026-11-28T12:00:00.000Z").getTime();

function makeEvent(overrides: Partial<EventDTO> = {}): EventDTO {
  return {
    id: "ev-1",
    clubId: "club-1",
    teamId: "team-1",
    recurrenceId: null,
    venueId: "venue-1",
    venue: {
      id: "venue-1",
      clubId: "club-1",
      name: "Sporthalle West",
      address: "Jahnstraße 10, 30165 Hannover",
      mapsUrl: null,
      latitude: null,
      longitude: null,
      resinPolicy: "RESIN_ALLOWED",
      notes: null,
    },
    type: "TRAINING",
    title: "Mannschaftstraining",
    description: null,
    startAt: "2026-11-29T18:00:00.000Z",
    endAt: "2026-11-29T19:30:00.000Z",
    meetingAt: null,
    rsvpDeadlineAt: null,
    requireDeclineReason: false,
    isCancelled: false,
    matchDetails: null,
    attendances: [],
    summary: {
      accepted: 5,
      declined: 1,
      maybe: 0,
      pending: 4,
    },
    ...overrides,
  };
}

function makeDuty(overrides: Partial<WorkDutyDTO> = {}): WorkDutyDTO {
  return {
    id: "duty-1",
    clubId: "club-1",
    teamId: "team-1",
    teamName: "1. Herren",
    matchdayId: null,
    matchdayTitle: null,
    eventId: null,
    scope: "TEAM",
    category: "TIMEKEEPER",
    title: "Zeitnehmer 1. Herren",
    description: null,
    startAt: "2026-12-01T17:00:00.000Z",
    endAt: "2026-12-01T19:00:00.000Z",
    hoursCredit: 2,
    requiresLicense: false,
    slotsNeeded: 1,
    assignedTeamId: "team-1",
    assignedTeamName: "1. Herren",
    jerseySetId: null,
    jerseySet: null,
    assignments: [],
    openSlots: 0,
    ...overrides,
  };
}

describe("player-dashboard domain helpers", () => {
  it("filtert abgesagte und alte Termine heraus und sortiert anstehende aufsteigend", () => {
    const events = [
      makeEvent({
        id: "ev-later",
        startAt: "2026-12-03T18:00:00.000Z",
      }),
      makeEvent({
        id: "ev-cancelled",
        startAt: "2026-11-28T16:00:00.000Z",
        isCancelled: true,
      }),
      makeEvent({
        id: "ev-past",
        startAt: "2026-11-28T09:00:00.000Z", // > 2h vor BASE_NOW
      }),
      makeEvent({
        id: "ev-ongoing",
        startAt: "2026-11-28T11:00:00.000Z", // innerhalb 2h Cutoff
      }),
    ];

    const upcoming = getUpcomingEvents(events, BASE_NOW);
    expect(upcoming.map((e) => e.id)).toEqual(["ev-ongoing", "ev-later"]);
  });

  it("prüft RSVP-Sperre anhand Rückmeldefrist und Staff-Override korrekt", () => {
    const expired = makeEvent({
      rsvpDeadlineAt: "2026-11-28T10:00:00.000Z",
    });
    const open = makeEvent({
      rsvpDeadlineAt: "2026-11-28T16:00:00.000Z",
    });

    expect(isEventRsvpLocked(expired, false, BASE_NOW)).toBe(true);
    expect(isEventRsvpLocked(expired, true, BASE_NOW)).toBe(false);
    expect(isEventRsvpLocked(open, false, BASE_NOW)).toBe(false);
    expect(isEventRsvpLocked(makeEvent({ isCancelled: true }), true, BASE_NOW)).toBe(
      true
    );
  });

  it("aktualisiert attendances und summary optimistisch ohne negative Zähler", () => {
    const initial = [
      makeEvent({
        id: "ev-1",
        attendances: [],
        summary: { accepted: 5, declined: 1, maybe: 0, pending: 4 },
      }),
    ];

    // PENDING -> ACCEPTED
    const afterAccept = applyOptimisticRsvpToEvents(initial, {
      eventId: "ev-1",
      memberId: "m-1",
      status: "ACCEPTED",
    });
    expect(getMemberRsvpStatus(afterAccept[0], "m-1")).toBe("ACCEPTED");
    expect(afterAccept[0].summary).toEqual({
      accepted: 6,
      declined: 1,
      maybe: 0,
      pending: 3,
    });

    // ACCEPTED -> DECLINED
    const afterDecline = applyOptimisticRsvpToEvents(afterAccept, {
      eventId: "ev-1",
      memberId: "m-1",
      status: "DECLINED",
    });
    expect(getMemberRsvpStatus(afterDecline[0], "m-1")).toBe("DECLINED");
    expect(afterDecline[0].summary).toEqual({
      accepted: 5,
      declined: 2,
      maybe: 0,
      pending: 3,
    });

    // DECLINED -> MAYBE
    const afterMaybe = applyOptimisticRsvpToEvents(afterDecline, {
      eventId: "ev-1",
      memberId: "m-1",
      status: "MAYBE",
    });
    expect(getMemberRsvpStatus(afterMaybe[0], "m-1")).toBe("MAYBE");
    expect(afterMaybe[0].summary).toEqual({
      accepted: 5,
      declined: 1,
      maybe: 1,
      pending: 3,
    });
  });

  it("erkennt Nominierung im Spieltagskader für eigene oder Kinder-Mitglieds-IDs", () => {
    const match = makeEvent({
      type: "MATCH",
      matchDetails: {
        id: "md-1",
        eventId: "ev-1",
        opponentName: "MTV Beispiel",
        isHome: true,
        throwOffAt: "2026-11-29T18:00:00.000Z",
        jerseyColor: "Rot",
        jerseySetId: null,
        jerseySet: null,
        refereeNote: null,
        nominatedMemberIds: ["m-child-1", "m-other"],
        homeScoreHalf: null,
        awayScoreHalf: null,
        homeScoreFull: null,
        awayScoreFull: null,
        scoreManuallyEdited: false,
        officialHomeScoreHalf: null,
        officialAwayScoreHalf: null,
        officialHomeScoreFull: null,
        officialAwayScoreFull: null,
      },
    });

    expect(isAnyMemberNominated(match, ["m-self"])).toBe(false);
    expect(isAnyMemberNominated(match, ["m-self", "m-child-1"])).toBe(true);
  });

  it("liefert alle eigenen und Kinder-Dienste aller Kategorien chronologisch und schließt erledigte/alte aus", () => {
    const duties: WorkDutyDTO[] = [
      makeDuty({
        id: "duty-laundry",
        category: "JERSEY_LAUNDRY",
        title: "Trikotwäsche",
        startAt: "2026-12-04T18:00:00.000Z",
        endAt: null,
        assignments: [
          {
            id: "a-1",
            dutyId: "duty-laundry",
            assignedMemberId: "m-self",
            assignedMemberFirstName: "Max",
            assignedMemberLastName: "Muster",
            assignedMemberUserId: "u-1",
            assignedMemberTeamName: "1. Herren",
            status: "ASSIGNED",
            swapNote: null,
            completedAt: null,
          },
        ],
      }),
      makeDuty({
        id: "duty-timekeeper",
        category: "TIMEKEEPER",
        title: "Zeitnehmer Heimspiel",
        startAt: "2026-11-30T15:00:00.000Z",
        endAt: "2026-11-30T17:00:00.000Z",
        assignments: [
          {
            id: "a-2",
            dutyId: "duty-timekeeper",
            assignedMemberId: "m-child",
            assignedMemberFirstName: "Leo",
            assignedMemberLastName: "Muster",
            assignedMemberUserId: null,
            assignedMemberTeamName: "mC-Jugend",
            status: "SWAP_REQUESTED",
            swapNote: "Urlaub",
            completedAt: null,
          },
        ],
      }),
      makeDuty({
        id: "duty-completed",
        category: "KIOSK",
        title: "Kiosk erledigt",
        startAt: "2026-12-01T15:00:00.000Z",
        assignments: [
          {
            id: "a-3",
            dutyId: "duty-completed",
            assignedMemberId: "m-self",
            assignedMemberFirstName: "Max",
            assignedMemberLastName: "Muster",
            assignedMemberUserId: "u-1",
            assignedMemberTeamName: "1. Herren",
            status: "COMPLETED",
            swapNote: null,
            completedAt: "2026-11-28T10:00:00.000Z",
          },
        ],
      }),
      makeDuty({
        id: "duty-past",
        category: "HALL_SETUP",
        title: "Vergangener Aufbau",
        startAt: "2026-11-27T10:00:00.000Z",
        endAt: "2026-11-27T12:00:00.000Z",
        assignments: [
          {
            id: "a-4",
            dutyId: "duty-past",
            assignedMemberId: "m-self",
            assignedMemberFirstName: "Max",
            assignedMemberLastName: "Muster",
            assignedMemberUserId: "u-1",
            assignedMemberTeamName: "1. Herren",
            status: "ASSIGNED",
            swapNote: null,
            completedAt: null,
          },
        ],
      }),
    ];

    const personal = getPersonalUpcomingDuties(duties, {
      userId: "u-1",
      memberId: "m-self",
      linkedChildIds: new Set(["m-child"]),
      nowMs: BASE_NOW,
    });

    expect(personal.map((p) => p.duty.id)).toEqual([
      "duty-timekeeper",
      "duty-laundry",
    ]);
    expect(personal[0].isSwapRequested).toBe(true);
    expect(personal[0].isLaundry).toBe(false);
    expect(personal[1].isLaundry).toBe(true);
  });

  it("filtert offene, noch nicht beantwortete Umfragen und sortiert angepinnte News zuerst", () => {
    const polls: TeamPollDTO[] = [
      {
        id: "p-voted",
        clubId: "c-1",
        teamId: "t-1",
        createdByName: "Coach",
        question: "Weihnachtsfeier?",
        allowMultiple: false,
        isClosed: false,
        totalVotes: 2,
        createdAt: "2026-11-27T10:00:00.000Z",
        options: [
          { id: "o-1", label: "Ja", sortOrder: 0, voteCount: 2, votedByMe: true },
        ],
      },
      {
        id: "p-closed",
        clubId: "c-1",
        teamId: "t-1",
        createdByName: "Coach",
        question: "Alt",
        allowMultiple: false,
        isClosed: true,
        totalVotes: 0,
        createdAt: "2026-11-26T10:00:00.000Z",
        options: [
          { id: "o-2", label: "A", sortOrder: 0, voteCount: 0, votedByMe: false },
        ],
      },
      {
        id: "p-open",
        clubId: "c-1",
        teamId: "t-1",
        createdByName: "Coach",
        question: "Neues Trainingsshirt?",
        allowMultiple: false,
        isClosed: false,
        totalVotes: 1,
        createdAt: "2026-11-28T09:00:00.000Z",
        options: [
          { id: "o-3", label: "Blau", sortOrder: 0, voteCount: 1, votedByMe: false },
        ],
      },
    ];

    expect(getOpenUnvotedPolls(polls).map((p) => p.id)).toEqual(["p-open"]);

    const announcements: TeamAnnouncementDTO[] = [
      {
        id: "a-old",
        clubId: "c-1",
        teamId: "t-1",
        authorUserId: "u-1",
        authorName: "Coach",
        title: "Älter",
        body: "Text",
        audience: "ALL",
        isPinned: false,
        createdAt: "2026-11-20T10:00:00.000Z",
        updatedAt: "2026-11-20T10:00:00.000Z",
      },
      {
        id: "a-new",
        clubId: "c-1",
        teamId: "t-1",
        authorUserId: "u-1",
        authorName: "Coach",
        title: "Neu",
        body: "Text",
        audience: "ALL",
        isPinned: false,
        createdAt: "2026-11-28T10:00:00.000Z",
        updatedAt: "2026-11-28T10:00:00.000Z",
      },
      {
        id: "a-pinned",
        clubId: "c-1",
        teamId: "t-1",
        authorUserId: "u-1",
        authorName: "Coach",
        title: "Wichtig",
        body: "Text",
        audience: "ALL",
        isPinned: true,
        createdAt: "2026-11-10T10:00:00.000Z",
        updatedAt: "2026-11-10T10:00:00.000Z",
      },
    ];

    expect(getDashboardAnnouncements(announcements, 2).map((a) => a.id)).toEqual([
      "a-pinned",
      "a-new",
    ]);
  });

  it("erzeugt sichere Maps-Links aus mapsUrl oder Adress-Fallback", () => {
    expect(
      buildVenueMapsHref({
        name: "Halle A",
        address: "Musterweg 1",
        mapsUrl: "https://maps.google.com/?q=123",
      })
    ).toBe("https://maps.google.com/?q=123");

    expect(
      buildVenueMapsHref({
        name: "Halle A",
        address: "Musterweg 1, Berlin",
        mapsUrl: null,
      })
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=Halle%20A%2C%20Musterweg%201%2C%20Berlin"
    );

    expect(
      buildVenueMapsHref({
        name: "Halle A",
        address: null,
        mapsUrl: "javascript:alert(1)",
      })
    ).toBeNull();

    expect(buildVenueMapsHref(null)).toBeNull();
  });
});
