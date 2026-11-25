import { describe, expect, it } from "vitest";
import {
  DutyRepository,
  TrainingRepository,
} from "@/domain/adapters/m3-repositories";
import { MemberRepository, TeamRecord, TeamRepository } from "@/domain/adapters/repositories";
import { ViewerContext } from "@/domain/policies/rbac";
import { WorkDutyAssignmentDTO, WorkDutyDTO } from "@/domain/schemas/duty";
import { TeamMemberEntity } from "@/domain/schemas/member";
import { DrillDTO, TrainingPlanDTO } from "@/domain/schemas/training";
import { DutyService } from "@/domain/services/duty-service";
import { TrainingService } from "@/domain/services/training-service";
import { computeTeamWorkHoursSummary } from "@/domain/services/work-hours";

describe("Arbeitsstunden-Rechner (computeTeamWorkHoursSummary)", () => {
  it("berechnet geleistete, geplante und verbleibende Stunden gegen das Jahres-Soll korrekt", () => {
    const summary = computeTeamWorkHoursSummary(
      "team-h1",
      [
        { id: "m-1", firstName: "Lukas", lastName: "Hartmann", role: "PLAYER" },
        { id: "m-2", firstName: "Tim", lastName: "Schneider", role: "PLAYER" },
      ],
      [
        { memberId: "m-1", status: "COMPLETED", hoursCredit: 2.5 },
        { memberId: "m-1", status: "COMPLETED", hoursCredit: 1.5 },
        { memberId: "m-1", status: "ASSIGNED", hoursCredit: 2.0 },
        { memberId: "m-2", status: "SWAP_REQUESTED", hoursCredit: 2.0 },
      ],
      8
    );

    expect(summary.totalCompletedHours).toBe(4);
    expect(summary.totalPlannedHours).toBe(4);

    const lukas = summary.members.find((m) => m.memberId === "m-1")!;
    expect(lukas.completedHours).toBe(4);
    expect(lukas.plannedHours).toBe(2);
    expect(lukas.remainingHours).toBe(4);
    expect(lukas.fulfillmentPercent).toBe(50);

    const tim = summary.members.find((m) => m.memberId === "m-2")!;
    expect(tim.completedHours).toBe(0);
    expect(tim.plannedHours).toBe(2);
    expect(tim.remainingHours).toBe(8);
  });
});

describe("DutyService (Team-Delegation, Tauschbörse & RBAC)", () => {
  const lukas: TeamMemberEntity = {
    id: "m-lukas",
    clubId: "club-1",
    teamId: "team-h1",
    userId: "u-lukas",
    role: "PLAYER",
    firstName: "Lukas",
    lastName: "Hartmann",
    email: null,
    phone: null,
    jerseyNumber: 10,
    primaryPosition: "RM",
    secondaryPosition: null,
    throwingHand: "RIGHT",
    availabilityStatus: "FIT",
    teamRoles: [],
    isMinor: false,
    passNumber: null,
    injuryNote: null,
    emergencyContact: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const hannah: TeamMemberEntity = {
    ...lukas,
    id: "m-hannah",
    teamId: "team-d1",
    userId: "u-hannah",
    firstName: "Hannah",
    lastName: "Berger",
  };

  const lukasViewer: ViewerContext = {
    userId: "u-lukas",
    email: "lukas@tsv.de",
    name: "Lukas Hartmann",
    memberships: [
      { memberId: "m-lukas", clubId: "club-1", teamId: "team-h1", role: "PLAYER" },
    ],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  const hannahViewer: ViewerContext = {
    userId: "u-hannah",
    email: "hannah@tsv.de",
    name: "Hannah Berger",
    memberships: [
      { memberId: "m-hannah", clubId: "club-1", teamId: "team-d1", role: "PLAYER" },
    ],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  it("setzt Team-Delegation (Herren 1 stellt Kampfgericht für Damen 1) durch", async () => {
    const delegatedDuty: WorkDutyDTO = {
      id: "duty-1",
      clubId: "club-1",
      teamId: null,
      teamName: null,
      matchdayId: "md-1",
      matchdayTitle: "Heimspieltag",
      eventId: null,
      scope: "CLUB_MATCHDAY",
      category: "TIMEKEEPER",
      title: "Kampfgericht Damen 1",
      description: null,
      startAt: null,
      endAt: null,
      hoursCredit: 2.5,
      requiresLicense: true,
      slotsNeeded: 1,
      assignedTeamId: "team-h1",
      assignedTeamName: "Herren 1",
      jerseySetId: null,
      jerseySet: null,
      assignments: [],
      openSlots: 1,
    };

    const teamRepo = {} as TeamRepository;
    const memberRepo = {
      findById: async (id: string) =>
        [lukas, hannah].find((m) => m.id === id) ?? null,
    } as unknown as MemberRepository;

    const dutyRepo: DutyRepository = {
      listMatchdaysByClub: async () => [],
      createMatchday: async () => ({}) as never,
      listDutiesByClub: async () => [delegatedDuty],
      findDutyById: async () => delegatedDuty,
      createDuty: async () => delegatedDuty,
      deleteDuty: async () => {},
      findAssignmentById: async () => null,
      createAssignment: async (input) => {
        const created: WorkDutyAssignmentDTO = {
          id: "a-1",
          dutyId: input.dutyId,
          assignedMemberId: input.assignedMemberId,
          assignedMemberFirstName: "Lukas",
          assignedMemberLastName: "Hartmann",
          assignedMemberUserId: "u-lukas",
          assignedMemberTeamName: "Herren 1",
          status: input.status,
          swapNote: null,
          completedAt: null,
        };
        delegatedDuty.assignments.push(created);
        delegatedDuty.openSlots = 0;
        return created;
      },
      updateAssignment: async () => ({}) as WorkDutyAssignmentDTO,
      listAssignmentsForTeamMembers: async () => [],
    };

    const service = new DutyService(teamRepo, memberRepo, dutyRepo);

    // Hannah (Damen 1) darf keinen an Herren 1 delegierten Dienst übernehmen -> 403
    await expect(
      service.claimSlot(hannahViewer, "club-1", "duty-1", {
        memberId: "m-hannah",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    // Lukas (Herren 1) darf den Slot übernehmen -> OK
    const claimed = await service.claimSlot(lukasViewer, "club-1", "duty-1", {
      memberId: "m-lukas",
    });
    expect(claimed.assignedMemberId).toBe("m-lukas");
    expect(claimed.status).toBe("ASSIGNED");
  });
});

describe("TrainingService RBAC (Freigabe & Übungsbibliothek)", () => {
  const team: TeamRecord = {
    id: "team-h1",
    clubId: "club-1",
    seasonId: "s-1",
    name: "Herren 1",
    category: "Aktive",
    gender: "MALE",
    leagueName: null,
  };

  const playerViewer: ViewerContext = {
    userId: "u-p",
    email: "p@tsv.de",
    name: "Player",
    memberships: [
      { memberId: "m-p", clubId: "club-1", teamId: "team-h1", role: "PLAYER" },
    ],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  it("filtert nicht freigegebene Trainingspläne für PLAYER und blockiert Schreibzugriff", async () => {
    let lastOnlyShared: boolean | null = null;
    const teamRepo = {
      findById: async () => team,
    } as unknown as TeamRepository;
    const trainingRepo: TrainingRepository = {
      listDrills: async () => [],
      findDrillById: async () => null,
      createDrill: async () => ({}) as DrillDTO,
      deleteDrill: async () => {},
      listTrainingPlansByTeam: async (_teamId, onlyShared) => {
        lastOnlyShared = onlyShared;
        return [] as TrainingPlanDTO[];
      },
      findTrainingPlanById: async () => null,
      createTrainingPlan: async () => ({}) as TrainingPlanDTO,
      updateTrainingPlan: async () => ({}) as TrainingPlanDTO,
      deleteTrainingPlan: async () => {},
    };

    const service = new TrainingService(teamRepo, trainingRepo);
    await service.listTrainingPlans(playerViewer, "team-h1");
    expect(lastOnlyShared).toBe(true);

    await expect(
      service.createDrill(playerViewer, "team-h1", {
        title: "Verbotene Übung",
        phase: "WARMUP",
        durationMinutes: 10,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });
});
