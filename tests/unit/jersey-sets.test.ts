import { describe, expect, it } from "vitest";
import {
  CreateEventRecordInput,
  EventRepository,
  VenueRepository,
} from "@/domain/adapters/event-repositories";
import { JerseySetRepository } from "@/domain/adapters/jersey-set-repository";
import { DutyRepository } from "@/domain/adapters/m3-repositories";
import {
  MemberRepository,
  TeamRecord,
  TeamRepository,
} from "@/domain/adapters/repositories";
import { ViewerContext } from "@/domain/policies/rbac";
import { CreateWorkDutyInput, WorkDutyDTO } from "@/domain/schemas/duty";
import { EventEntity, MatchDetailsDTO } from "@/domain/schemas/event";
import {
  CreateJerseySetInput,
  JerseySetDTO,
  UpdateJerseySetInput,
} from "@/domain/schemas/jersey-set";
import { DutyService } from "@/domain/services/duty-service";
import { EventService } from "@/domain/services/event-service";
import { JerseySetService } from "@/domain/services/jersey-set-service";

const teamH1: TeamRecord = {
  id: "team-h1",
  clubId: "club-1",
  seasonId: "season-1",
  name: "Herren 1",
  category: "Aktive",
  ageGroup: "ADULT",
  gender: "MALE",
  usesResin: true,
  leagueId: null,
  leagueName: null,
  leagueGroupTeamId: null,
};

const coachViewer: ViewerContext = {
  userId: "u-coach",
  email: "coach@tsv.de",
  name: "Trainer Tom",
  memberships: [
    { memberId: "m-coach", clubId: "club-1", teamId: "team-h1", role: "COACH" },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

const playerViewer: ViewerContext = {
  userId: "u-player",
  email: "spieler@tsv.de",
  name: "Spieler Max",
  memberships: [
    {
      memberId: "m-player",
      clubId: "club-1",
      teamId: "team-h1",
      role: "PLAYER",
    },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

function createInMemoryJerseySetRepo(
  initial: JerseySetDTO[] = []
): JerseySetRepository {
  const store = [...initial];
  let seq = 1;

  return {
    async findByClubId(clubId, filter) {
      return store.filter(
        (j) =>
          j.clubId === clubId &&
          (!filter?.teamId || j.teamId === filter.teamId || j.teamId === null)
      );
    },
    async findById(id) {
      return store.find((j) => j.id === id) ?? null;
    },
    async create(clubId: string, input: CreateJerseySetInput) {
      const now = new Date().toISOString();
      const created: JerseySetDTO = {
        id: `js-${seq++}`,
        clubId,
        teamId: input.teamId ?? null,
        teamName: input.teamId === teamH1.id ? teamH1.name : null,
        name: input.name,
        colors: input.colors,
        sizes: input.sizes ?? null,
        jerseyCount: input.jerseyCount ?? null,
        condition: input.condition,
        conditionNote: input.conditionNote ?? null,
        careInstructions: input.careInstructions ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.push(created);
      return created;
    },
    async update(id: string, input: UpdateJerseySetInput) {
      const idx = store.findIndex((j) => j.id === id);
      const current = store[idx]!;
      const updated: JerseySetDTO = {
        ...current,
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.colors !== undefined ? { colors: input.colors } : {}),
        ...(input.sizes !== undefined ? { sizes: input.sizes ?? null } : {}),
        ...(input.jerseyCount !== undefined
          ? { jerseyCount: input.jerseyCount ?? null }
          : {}),
        ...(input.condition !== undefined
          ? { condition: input.condition }
          : {}),
        ...(input.conditionNote !== undefined
          ? { conditionNote: input.conditionNote ?? null }
          : {}),
        ...(input.careInstructions !== undefined
          ? { careInstructions: input.careInstructions ?? null }
          : {}),
        updatedAt: new Date().toISOString(),
      };
      store[idx] = updated;
      return updated;
    },
    async delete(id: string) {
      const idx = store.findIndex((j) => j.id === id);
      if (idx >= 0) store.splice(idx, 1);
    },
  };
}

describe("JerseySetService (Verwaltung, Zustand & Pflegehinweise)", () => {
  const teamRepo = {
    findById: async (id: string) => (id === teamH1.id ? teamH1 : null),
  } as unknown as TeamRepository;

  it("erlaubt Trainern das Anlegen, Zustands-Update und Hinterlegen von Pflegehinweisen", async () => {
    const repo = createInMemoryJerseySetRepo();
    const service = new JerseySetService(repo, teamRepo);

    const created = await service.createJerseySet(coachViewer, "club-1", {
      teamId: teamH1.id,
      name: "Heimtrikot 2026",
      colors: "Orange / Schwarz",
      jerseyCount: 16,
      sizes: "S–XXL + 2 TW",
      condition: "NEW",
      careInstructions: "Max. 30 °C auf links waschen, kein Weichspüler.",
    });

    expect(created.name).toBe("Heimtrikot 2026");
    expect(created.condition).toBe("NEW");
    expect(created.careInstructions).toContain("30 °C");

    const updated = await service.updateJerseySet(
      coachViewer,
      "club-1",
      created.id,
      {
        condition: "NEEDS_REPAIR",
        conditionNote: "Nr. 7 Naht am Kragen locker",
      }
    );

    expect(updated.condition).toBe("NEEDS_REPAIR");
    expect(updated.conditionNote).toBe("Nr. 7 Naht am Kragen locker");
    expect(updated.careInstructions).toContain("30 °C");
  });

  it("verhindert das Anlegen, Bearbeiten und Löschen durch Spieler, erlaubt aber Leserechte", async () => {
    const repo = createInMemoryJerseySetRepo();
    const service = new JerseySetService(repo, teamRepo);

    const created = await service.createJerseySet(coachViewer, "club-1", {
      teamId: teamH1.id,
      name: "Auswärtstrikot",
      colors: "Weiß / Blau",
      condition: "GOOD",
    });

    const visible = await service.listJerseySets(playerViewer, "club-1", {
      teamId: teamH1.id,
    });
    expect(visible).toHaveLength(1);
    expect(visible[0]?.name).toBe("Auswärtstrikot");

    await expect(
      service.createJerseySet(playerViewer, "club-1", {
        teamId: teamH1.id,
        name: "Unbefugt",
        colors: "Grün",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      service.updateJerseySet(playerViewer, "club-1", created.id, {
        condition: "WORN",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      service.deleteJerseySet(playerViewer, "club-1", created.id)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("übernimmt Trikotfarbe automatisch beim Verknüpfen eines Trikotsatzes im Spieltag", async () => {
    const jerseyRepo = createInMemoryJerseySetRepo();
    const jerseyService = new JerseySetService(jerseyRepo, teamRepo);
    const set = await jerseyService.createJerseySet(coachViewer, "club-1", {
      teamId: teamH1.id,
      name: "Heimsatz",
      colors: "Rot / Weiß",
      condition: "GOOD",
      careInstructions: "Nicht in den Trockner.",
    });

    let savedMatch: MatchDetailsDTO | null = null;
    const eventRepo = {
      findByTeamId: async () => [],
      findById: async () => null,
      createSingle: async (input: CreateEventRecordInput) => {
        savedMatch = {
          id: "md-1",
          eventId: "ev-1",
          opponentName: input.matchDetails!.opponentName,
          isHome: input.matchDetails!.isHome,
          throwOffAt: input.matchDetails!.throwOffAt?.toISOString() ?? null,
          jerseyColor: input.matchDetails!.jerseyColor ?? null,
          jerseySetId: input.matchDetails!.jerseySetId ?? null,
          jerseySet: {
            id: set.id,
            name: set.name,
            colors: set.colors,
            condition: set.condition,
            conditionNote: set.conditionNote,
            careInstructions: set.careInstructions,
          },
          refereeNote: null,
          nominatedMemberIds: [],
          homeScoreHalf: null,
          awayScoreHalf: null,
          homeScoreFull: null,
          awayScoreFull: null,
        };
        return {
          id: "ev-1",
          clubId: input.clubId,
          teamId: input.teamId,
          recurrenceId: null,
          venueId: null,
          venue: null,
          type: input.type,
          title: input.title,
          description: null,
          startAt: input.startAt,
          endAt: null,
          meetingAt: null,
          rsvpDeadlineAt: null,
          requireDeclineReason: false,
          isCancelled: false,
          matchDetails: savedMatch,
          attendances: [],
        } satisfies EventEntity;
      },
    } as unknown as EventRepository;

    const memberRepo = {
      findByTeamId: async () => [],
    } as unknown as MemberRepository;
    const venueRepo = {} as VenueRepository;

    const eventService = new EventService(
      teamRepo,
      memberRepo,
      venueRepo,
      eventRepo,
      jerseyRepo
    );

    const created = await eventService.createSingleEvent(
      coachViewer,
      teamH1.id,
      {
        type: "MATCH",
        title: "Punktspiel vs. SG Nord",
        startAt: new Date("2026-12-01T18:00:00.000Z").toISOString(),
        matchDetails: {
          opponentName: "SG Nord",
          isHome: true,
          jerseySetId: set.id,
        },
      }
    );

    expect(created.matchDetails?.jerseySetId).toBe(set.id);
    expect(created.matchDetails?.jerseyColor).toBe("Rot / Weiß");
  });

  it("verknüpft einen Trikotsatz inkl. Pflegehinweisen mit einem Trikotwäsche-Dienst", async () => {
    const jerseyRepo = createInMemoryJerseySetRepo();
    const jerseyService = new JerseySetService(jerseyRepo, teamRepo);
    const set = await jerseyService.createJerseySet(coachViewer, "club-1", {
      teamId: teamH1.id,
      name: "Auswärtssatz",
      colors: "Schwarz / Gold",
      condition: "WORN",
      conditionNote: "Nr. 3 leicht verblasst",
      careInstructions: "Auf links bei 30 °C, kein Weichspüler!",
    });

    const dutyRepo = {
      createDuty: async (
        clubId: string,
        input: CreateWorkDutyInput
      ): Promise<WorkDutyDTO> => ({
        id: "duty-wash-1",
        clubId,
        teamId: input.teamId ?? null,
        teamName: teamH1.name,
        matchdayId: null,
        matchdayTitle: null,
        eventId: null,
        scope: input.scope,
        category: input.category,
        title: input.title,
        description: input.description ?? null,
        startAt: null,
        endAt: null,
        hoursCredit: input.hoursCredit,
        requiresLicense: input.requiresLicense,
        slotsNeeded: input.slotsNeeded,
        assignedTeamId: null,
        assignedTeamName: null,
        jerseySetId: input.jerseySetId ?? null,
        jerseySet:
          input.jerseySetId === set.id
            ? {
                id: set.id,
                name: set.name,
                colors: set.colors,
                condition: set.condition,
                conditionNote: set.conditionNote,
                careInstructions: set.careInstructions,
              }
            : null,
        assignments: [],
        openSlots: input.slotsNeeded,
      }),
    } as unknown as DutyRepository;

    const dutyService = new DutyService(
      teamRepo,
      {} as MemberRepository,
      dutyRepo,
      jerseyRepo
    );

    const createdDuty = await dutyService.createDuty(coachViewer, "club-1", {
      scope: "TEAM",
      teamId: teamH1.id,
      category: "JERSEY_LAUNDRY",
      title: "Trikotwäsche – Auswärtssatz",
      hoursCredit: 1.5,
      slotsNeeded: 1,
      jerseySetId: set.id,
    });

    expect(createdDuty.jerseySetId).toBe(set.id);
    expect(createdDuty.jerseySet?.careInstructions).toBe(
      "Auf links bei 30 °C, kein Weichspüler!"
    );

    // Fremder / nicht existierender Trikotsatz wird abgelehnt
    await expect(
      dutyService.createDuty(coachViewer, "club-1", {
        scope: "TEAM",
        teamId: teamH1.id,
        category: "JERSEY_LAUNDRY",
        title: "Trikotwäsche Ungültig",
        hoursCredit: 1.5,
        slotsNeeded: 1,
        jerseySetId: "js-does-not-exist",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
