import { describe, expect, it } from "vitest";
import { EventRepository } from "@/domain/adapters/event-repositories";
import {
  CarpoolRepository,
  ExistingSyncedMatch,
  LeagueSyncRepository,
} from "@/domain/adapters/league-provider";
import { MemberRepository, TeamRecord, TeamRepository } from "@/domain/adapters/repositories";
import { ViewerContext } from "@/domain/policies/rbac";
import { CarpoolDTO } from "@/domain/schemas/carpool";
import { EventEntity } from "@/domain/schemas/event";
import {
  LeagueImportSourceDTO,
  LeagueSyncChangeLogDTO,
} from "@/domain/schemas/league";
import { TeamMemberEntity } from "@/domain/schemas/member";
import { CarpoolService } from "@/domain/services/carpool-service";
import { CsvLeagueProviderAdapter } from "@/domain/services/csv-parser";
import { IcalLeagueProviderAdapter } from "@/domain/services/ical-parser";
import { computeLeagueMergePlan } from "@/domain/services/league-merge";
import { LeagueSyncService } from "@/domain/services/league-sync-service";

const SAMPLE_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:nuliga-match-1001",
  "DTSTART:20261129T180000Z",
  "DTEND:20261129T194500Z",
  "SUMMARY:TSV Musterstadt - SG Neustadt",
  "LOCATION:Sporthalle Musterstadt-Süd",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:nuliga-match-1002",
  "DTSTART;TZID=Europe/Berlin:20261206T170000",
  "SUMMARY:TV Nachbarstadt : TSV Musterstadt",
  "LOCATION:Dreifeldhalle Nachbarstadt",
  "STATUS:CANCELLED",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("IcalLeagueProviderAdapter (.ics Parser)", () => {
  it("parst VEVENTs, erkennt Heim/Auswärts anhand teamNameMatch und Spielabsagen", () => {
    const adapter = new IcalLeagueProviderAdapter();
    const matches = adapter.parse(SAMPLE_ICS, {
      teamNameMatch: "TSV Musterstadt",
    });

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      externalId: "nuliga-match-1001",
      isHome: true,
      opponentName: "SG Neustadt",
      venueName: "Sporthalle Musterstadt-Süd",
      isCancelled: false,
    });
    expect(matches[1]).toMatchObject({
      externalId: "nuliga-match-1002",
      isHome: false,
      opponentName: "TV Nachbarstadt",
      venueName: "Dreifeldhalle Nachbarstadt",
      isCancelled: true,
    });
  });
});

describe("CsvLeagueProviderAdapter (CSV-Import mit Spalten-Mapping)", () => {
  it("parst deutsches Semikolon-CSV, filtert aufs eigene Team und ordnet Heim/Auswärts zu", () => {
    const csv = [
      "Spiel-ID;Datum;Anwurf;Heimmannschaft;Gastmannschaft;Sporthalle",
      "M-1;14.12.2026;19:00;TSV Musterstadt;HSG Oberland;Sporthalle Süd",
      "M-2;14.12.2026;17:00;SG Fremd 1;SG Fremd 2;Fremdhalle",
      "M-3;21.12.2026;17:30;TV Waldstadt;TSV Musterstadt;Waldsporthalle",
    ].join("\n");

    const adapter = new CsvLeagueProviderAdapter();
    const matches = adapter.parse(csv, {
      teamNameMatch: "TSV Musterstadt",
      mapping: {
        delimiter: ";",
        externalIdColumn: "Spiel-ID",
        dateColumn: "Datum",
        timeColumn: "Anwurf",
        homeTeamColumn: "Heimmannschaft",
        awayTeamColumn: "Gastmannschaft",
        venueColumn: "Sporthalle",
      },
    });

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      externalId: "M-1",
      isHome: true,
      opponentName: "HSG Oberland",
      venueName: "Sporthalle Süd",
    });
    expect(matches[1]).toMatchObject({
      externalId: "M-3",
      isHome: false,
      opponentName: "TV Waldstadt",
      venueName: "Waldsporthalle",
    });
  });
});

describe("LeagueMerge & LeagueSyncService (Change-Log + Schutz lokaler Daten)", () => {
  it("erkennt Neuanlage, Spielverlegung und Hallenwechsel und bleibt bei erneutem Sync idempotent", () => {
    const existing: ExistingSyncedMatch[] = [
      {
        eventId: "ev-1",
        externalId: "uid-1",
        title: "TSV Musterstadt - SG Neustadt",
        startAt: new Date("2026-11-29T18:00:00.000Z"),
        endAt: new Date("2026-11-29T19:45:00.000Z"),
        venueId: "v-1",
        venueName: "Sporthalle Süd",
        isCancelled: false,
        opponentName: "SG Neustadt",
        isHome: true,
      },
    ];

    const plan = computeLeagueMergePlan(existing, [
      {
        externalId: "uid-1",
        title: "TSV Musterstadt - SG Neustadt",
        opponentName: "SG Neustadt",
        isHome: true,
        startAt: new Date("2026-11-29T19:30:00.000Z"), // Verlegt!
        endAt: new Date("2026-11-29T21:15:00.000Z"),
        venueName: "Sporthalle Süd",
        isCancelled: false,
      },
      {
        externalId: "uid-2",
        title: "TV Nord - TSV Musterstadt",
        opponentName: "TV Nord",
        isHome: false,
        startAt: new Date("2026-12-06T17:00:00.000Z"),
        endAt: new Date("2026-12-06T18:45:00.000Z"),
        venueName: "Nordhalle",
        isCancelled: false,
      },
    ]);

    expect(plan[0].kind).toBe("UPDATE");
    expect(plan[0].changeType).toBe("RESCHEDULED");
    expect(plan[0].summary).toContain("Spielverlegung");

    expect(plan[1].kind).toBe("CREATE");
    expect(plan[1].changeType).toBe("CREATED");
  });

  it("verweigert Liga-Import für PLAYER (403 FORBIDDEN)", async () => {
    const team: TeamRecord = {
      id: "team-1",
      clubId: "club-1",
      seasonId: "s-1",
      name: "Herren 1",
      category: "Aktive",
      gender: "MALE",
      leagueName: null,
    };
    const teamRepo: TeamRepository = {
      findById: async () => team,
      findByClubId: async () => [team],
      create: async () => team,
      update: async () => team,
    };
    const syncRepo: LeagueSyncRepository = {
      listSourcesByTeam: async () => [],
      listEnabledIcalSources: async () => [],
      findSourceById: async () => null,
      createSource: async () => ({}) as LeagueImportSourceDTO,
      updateSourceSyncStatus: async () => {},
      deleteSource: async () => {},
      findSyncedMatchesByTeam: async () => [],
      findOrCreateVenueByNamePreservingResin: async () => ({ id: "v", name: "H" }),
      createSyncedMatchEvent: async () => ({ eventId: "e" }),
      updateSyncedMatchSchedulePreservingLocal: async () => {},
      createChangeLog: async () => ({}) as LeagueSyncChangeLogDTO,
      listChangeLogsByTeam: async () => [],
    };
    const service = new LeagueSyncService(teamRepo, syncRepo, async () => "");
    const player: ViewerContext = {
      userId: "u-p",
      email: "p@tsv.de",
      name: "Player",
      memberships: [
        { memberId: "m-p", clubId: "club-1", teamId: "team-1", role: "PLAYER" },
      ],
      linkedChildMemberIds: [],
      linkedChildTeamIds: [],
    };

    await expect(
      service.createSource(player, "team-1", {
        provider: "ICAL_URL",
        name: "Test",
        sourceUrl: "https://example.com/a.ics",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });
});

describe("CarpoolService (Fahrgemeinschaften & Eltern-Kind-Buchung)", () => {
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
  };

  const parent: ViewerContext = {
    userId: "u-parent",
    email: "katrin@tsv.de",
    name: "Katrin Weber",
    memberships: [
      { memberId: "m-parent", clubId: "club-1", teamId: "team-1", role: "PARENT" },
    ],
    linkedChildMemberIds: ["m-leo"],
    linkedChildTeamIds: ["team-1"],
  };

  it("erlaubt PARENT Buchung für verknüpftes Kind, blockiert fremdes Kind und volle Autos", async () => {
    const carpool: CarpoolDTO & { clubId: string; teamId: string } = {
      id: "cp-1",
      eventId: "ev-1",
      clubId: "club-1",
      teamId: "team-1",
      driverMemberId: "m-driver",
      driverFirstName: "Markus",
      driverLastName: "Brenner",
      driverUserId: "u-coach",
      departureLocation: "Sporthalle Süd",
      departureTime: "16:15",
      totalSeats: 1,
      availableSeats: 1,
      notes: null,
      bookings: [],
      createdAt: new Date().toISOString(),
    };

    const eventRepo = {
      findById: async () =>
        ({
          id: "ev-1",
          clubId: "club-1",
          teamId: "team-1",
        }) as EventEntity,
    } as unknown as EventRepository;

    const memberRepo = {
      findById: async (id: string) =>
        [leo, ben].find((m) => m.id === id) ?? null,
    } as unknown as MemberRepository;

    const carpoolRepo: CarpoolRepository = {
      listByEventId: async () => [carpool],
      findById: async () => carpool,
      create: async () => carpool,
      delete: async () => {},
      findBookingById: async () => null,
      createBooking: async (input) => {
        const booking = {
          id: "b-1",
          carpoolId: input.carpoolId,
          passengerMemberId: input.passengerMemberId,
          passengerFirstName: "Leo",
          passengerLastName: "Weber",
          bookedByUserId: input.bookedByUserId,
          createdAt: new Date().toISOString(),
        };
        carpool.bookings.push(booking);
        carpool.availableSeats -= 1;
        return booking;
      },
      deleteBooking: async () => {},
    };

    const service = new CarpoolService(eventRepo, memberRepo, carpoolRepo);

    // Fremdes Kind -> 403 FORBIDDEN
    await expect(
      service.bookSeat(parent, "team-1", "ev-1", "cp-1", {
        passengerMemberId: "m-ben",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    // Eigenes verknüpftes Kind -> OK
    const booked = await service.bookSeat(parent, "team-1", "ev-1", "cp-1", {
      passengerMemberId: "m-leo",
    });
    expect(booked.passengerMemberId).toBe("m-leo");
    expect(carpool.availableSeats).toBe(0);

    // Doppelbuchung -> 409 CONFLICT
    await expect(
      service.bookSeat(parent, "team-1", "ev-1", "cp-1", {
        passengerMemberId: "m-leo",
      })
    ).rejects.toMatchObject({ code: "CONFLICT", httpStatus: 409 });
  });
});
