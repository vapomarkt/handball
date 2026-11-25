import {
  DutyRepository,
  TrainingRepository,
} from "@/domain/adapters/m3-repositories";
import {
  CreateMatchdayInput,
  CreateWorkDutyInput,
  DutyAssignmentStatus,
  DutyScope,
  MatchdayDTO,
  WorkDutyAssignmentDTO,
  WorkDutyDTO,
} from "@/domain/schemas/duty";
import {
  CreateDrillInput,
  CreateTrainingPlanInput,
  DrillDTO,
  TrainingPhaseItem,
  TrainingPhaseItemSchema,
  TrainingPlanDTO,
  UpdateTrainingPlanInput,
} from "@/domain/schemas/training";
import { prisma } from "../db/prisma";

const DUTY_INCLUDE = {
  team: { select: { name: true } },
  assignedTeam: { select: { name: true } },
  matchday: { select: { title: true } },
  jerseySet: {
    select: {
      id: true,
      name: true,
      colors: true,
      condition: true,
      conditionNote: true,
      careInstructions: true,
    },
  },
  assignments: {
    include: {
      assignedMember: {
        select: {
          firstName: true,
          lastName: true,
          userId: true,
          team: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

type PrismaDutyRow = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.workDuty.findUnique<{
        where: { id: string };
        include: typeof DUTY_INCLUDE;
      }>
    >
  >
>;

function mapAssignment(a: PrismaDutyRow["assignments"][number]): WorkDutyAssignmentDTO {
  return {
    id: a.id,
    dutyId: a.dutyId,
    assignedMemberId: a.assignedMemberId,
    assignedMemberFirstName: a.assignedMember?.firstName ?? null,
    assignedMemberLastName: a.assignedMember?.lastName ?? null,
    assignedMemberUserId: a.assignedMember?.userId ?? null,
    assignedMemberTeamName: a.assignedMember?.team.name ?? null,
    status: a.status,
    swapNote: a.swapNote,
    completedAt: a.completedAt ? a.completedAt.toISOString() : null,
  };
}

function mapDuty(d: PrismaDutyRow): WorkDutyDTO {
  const filledCount = d.assignments.filter(
    (a) => a.assignedMemberId !== null && a.status !== "OPEN"
  ).length;
  return {
    id: d.id,
    clubId: d.clubId,
    teamId: d.teamId,
    teamName: d.team?.name ?? null,
    matchdayId: d.matchdayId,
    matchdayTitle: d.matchday?.title ?? null,
    eventId: d.eventId,
    scope: d.scope,
    category: d.category,
    title: d.title,
    description: d.description,
    startAt: d.startAt ? d.startAt.toISOString() : null,
    endAt: d.endAt ? d.endAt.toISOString() : null,
    hoursCredit: d.hoursCredit,
    requiresLicense: d.requiresLicense,
    slotsNeeded: d.slotsNeeded,
    assignedTeamId: d.assignedTeamId,
    assignedTeamName: d.assignedTeam?.name ?? null,
    jerseySetId: d.jerseySetId,
    jerseySet: d.jerseySet
      ? {
          id: d.jerseySet.id,
          name: d.jerseySet.name,
          colors: d.jerseySet.colors,
          condition: d.jerseySet.condition,
          conditionNote: d.jerseySet.conditionNote,
          careInstructions: d.jerseySet.careInstructions,
        }
      : null,
    assignments: d.assignments.map(mapAssignment),
    openSlots: Math.max(0, d.slotsNeeded - filledCount),
  };
}

export class PrismaDutyRepository implements DutyRepository {
  async listMatchdaysByClub(clubId: string): Promise<MatchdayDTO[]> {
    const rows = await prisma.matchday.findMany({
      where: { clubId },
      include: {
        venue: { select: { name: true } },
        _count: { select: { duties: true } },
      },
      orderBy: { date: "asc" },
    });

    return rows.map((m) => ({
      id: m.id,
      clubId: m.clubId,
      seasonId: m.seasonId,
      venueId: m.venueId,
      venueName: m.venue?.name ?? null,
      title: m.title,
      date: m.date.toISOString(),
      notes: m.notes,
      dutyCount: m._count.duties,
    }));
  }

  async createMatchday(
    clubId: string,
    input: CreateMatchdayInput
  ): Promise<MatchdayDTO> {
    const m = await prisma.matchday.create({
      data: {
        clubId,
        title: input.title,
        date: new Date(input.date),
        venueId: input.venueId ?? null,
        seasonId: input.seasonId ?? null,
        notes: input.notes ?? null,
      },
      include: {
        venue: { select: { name: true } },
        _count: { select: { duties: true } },
      },
    });
    return {
      id: m.id,
      clubId: m.clubId,
      seasonId: m.seasonId,
      venueId: m.venueId,
      venueName: m.venue?.name ?? null,
      title: m.title,
      date: m.date.toISOString(),
      notes: m.notes,
      dutyCount: m._count.duties,
    };
  }

  async listDutiesByClub(
    clubId: string,
    filter?: { teamId?: string; scope?: DutyScope; matchdayId?: string }
  ): Promise<WorkDutyDTO[]> {
    const rows = await prisma.workDuty.findMany({
      where: {
        clubId,
        ...(filter?.scope ? { scope: filter.scope } : {}),
        ...(filter?.matchdayId ? { matchdayId: filter.matchdayId } : {}),
        ...(filter?.teamId
          ? {
              OR: [
                { scope: "CLUB_MATCHDAY" },
                { teamId: filter.teamId },
                { assignedTeamId: filter.teamId },
              ],
            }
          : {}),
      },
      include: DUTY_INCLUDE,
      orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(mapDuty);
  }

  async findDutyById(dutyId: string): Promise<WorkDutyDTO | null> {
    const row = await prisma.workDuty.findUnique({
      where: { id: dutyId },
      include: DUTY_INCLUDE,
    });
    return row ? mapDuty(row) : null;
  }

  async createDuty(
    clubId: string,
    input: CreateWorkDutyInput
  ): Promise<WorkDutyDTO> {
    const created = await prisma.workDuty.create({
      data: {
        clubId,
        scope: input.scope,
        teamId: input.teamId ?? null,
        matchdayId: input.matchdayId ?? null,
        eventId: input.eventId ?? null,
        category: input.category,
        title: input.title,
        description: input.description ?? null,
        startAt: input.startAt ? new Date(input.startAt) : null,
        endAt: input.endAt ? new Date(input.endAt) : null,
        hoursCredit: input.hoursCredit,
        requiresLicense: input.requiresLicense,
        slotsNeeded: input.slotsNeeded,
        assignedTeamId: input.assignedTeamId ?? null,
        jerseySetId: input.jerseySetId ?? null,
        ...(input.initialAssignedMemberId
          ? {
              assignments: {
                create: {
                  assignedMemberId: input.initialAssignedMemberId,
                  status: "ASSIGNED",
                },
              },
            }
          : {}),
      },
      include: DUTY_INCLUDE,
    });
    return mapDuty(created);
  }

  async deleteDuty(dutyId: string): Promise<void> {
    await prisma.workDuty.delete({ where: { id: dutyId } });
  }

  async findAssignmentById(assignmentId: string) {
    const row = await prisma.workDutyAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        assignedMember: { select: { userId: true } },
        duty: {
          select: {
            clubId: true,
            teamId: true,
            assignedTeamId: true,
            hoursCredit: true,
          },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      dutyId: row.dutyId,
      clubId: row.duty.clubId,
      teamId: row.duty.teamId,
      assignedTeamId: row.duty.assignedTeamId,
      assignedMemberId: row.assignedMemberId,
      assignedMemberUserId: row.assignedMember?.userId ?? null,
      status: row.status,
      hoursCredit: row.duty.hoursCredit,
    };
  }

  async createAssignment(input: {
    dutyId: string;
    assignedMemberId: string;
    status: DutyAssignmentStatus;
  }): Promise<WorkDutyAssignmentDTO> {
    const row = await prisma.workDutyAssignment.create({
      data: input,
      include: {
        assignedMember: {
          select: {
            firstName: true,
            lastName: true,
            userId: true,
            team: { select: { name: true } },
          },
        },
      },
    });
    return mapAssignment(row);
  }

  async updateAssignment(
    assignmentId: string,
    input: {
      assignedMemberId?: string | null;
      status?: DutyAssignmentStatus;
      swapNote?: string | null;
      completedAt?: Date | null;
    }
  ): Promise<WorkDutyAssignmentDTO> {
    const row = await prisma.workDutyAssignment.update({
      where: { id: assignmentId },
      data: input,
      include: {
        assignedMember: {
          select: {
            firstName: true,
            lastName: true,
            userId: true,
            team: { select: { name: true } },
          },
        },
      },
    });
    return mapAssignment(row);
  }

  async listAssignmentsForTeamMembers(teamId: string) {
    const rows = await prisma.workDutyAssignment.findMany({
      where: {
        assignedMemberId: { not: null },
        assignedMember: { teamId },
      },
      include: {
        duty: { select: { hoursCredit: true } },
      },
    });

    return rows
      .filter((r) => r.assignedMemberId !== null)
      .map((r) => ({
        memberId: r.assignedMemberId!,
        status: r.status,
        hoursCredit: r.duty.hoursCredit,
      }));
  }
}

function parsePhasesJson(raw: unknown): TrainingPhaseItem[] {
  if (!Array.isArray(raw)) return [];
  const parsed: TrainingPhaseItem[] = [];
  for (const item of raw) {
    const res = TrainingPhaseItemSchema.safeParse(item);
    if (res.success) parsed.push(res.data);
  }
  return parsed;
}

function mapTrainingPlan(p: {
  id: string;
  clubId: string;
  teamId: string;
  eventId: string | null;
  title: string;
  focus: string | null;
  targetDurationMinutes: number;
  phases: unknown;
  isSharedWithTeam: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TrainingPlanDTO {
  const phases = parsePhasesJson(p.phases);
  const totalPlannedMinutes = phases.reduce(
    (sum, ph) => sum + ph.durationMinutes,
    0
  );
  return {
    id: p.id,
    clubId: p.clubId,
    teamId: p.teamId,
    eventId: p.eventId,
    title: p.title,
    focus: p.focus,
    targetDurationMinutes: p.targetDurationMinutes,
    totalPlannedMinutes,
    phases,
    isSharedWithTeam: p.isSharedWithTeam,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export class PrismaTrainingRepository implements TrainingRepository {
  async listDrills(clubId: string, teamId: string): Promise<DrillDTO[]> {
    const rows = await prisma.drill.findMany({
      where: {
        clubId,
        OR: [{ teamId: null }, { teamId }],
      },
      orderBy: [{ phase: "asc" }, { title: "asc" }],
    });
    return rows.map((d) => ({
      id: d.id,
      clubId: d.clubId,
      teamId: d.teamId,
      title: d.title,
      description: d.description,
      phase: d.phase,
      durationMinutes: d.durationMinutes,
      tags: d.tags,
      equipment: d.equipment,
      tacticPlayId: d.tacticPlayId,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async findDrillById(drillId: string): Promise<DrillDTO | null> {
    const d = await prisma.drill.findUnique({ where: { id: drillId } });
    if (!d) return null;
    return {
      id: d.id,
      clubId: d.clubId,
      teamId: d.teamId,
      title: d.title,
      description: d.description,
      phase: d.phase,
      durationMinutes: d.durationMinutes,
      tags: d.tags,
      equipment: d.equipment,
      tacticPlayId: d.tacticPlayId,
      createdAt: d.createdAt.toISOString(),
    };
  }

  async createDrill(
    clubId: string,
    teamId: string | null,
    userId: string,
    input: CreateDrillInput
  ): Promise<DrillDTO> {
    const d = await prisma.drill.create({
      data: {
        clubId,
        teamId,
        createdByUserId: userId,
        title: input.title,
        description: input.description ?? null,
        phase: input.phase,
        durationMinutes: input.durationMinutes,
        tags: input.tags,
        equipment: input.equipment ?? null,
      },
    });
    return {
      id: d.id,
      clubId: d.clubId,
      teamId: d.teamId,
      title: d.title,
      description: d.description,
      phase: d.phase,
      durationMinutes: d.durationMinutes,
      tags: d.tags,
      equipment: d.equipment,
      tacticPlayId: d.tacticPlayId,
      createdAt: d.createdAt.toISOString(),
    };
  }

  async deleteDrill(drillId: string): Promise<void> {
    await prisma.drill.delete({ where: { id: drillId } });
  }

  async listTrainingPlansByTeam(
    teamId: string,
    onlyShared: boolean
  ): Promise<TrainingPlanDTO[]> {
    const rows = await prisma.trainingPlan.findMany({
      where: {
        teamId,
        ...(onlyShared ? { isSharedWithTeam: true } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapTrainingPlan);
  }

  async findTrainingPlanById(planId: string): Promise<TrainingPlanDTO | null> {
    const row = await prisma.trainingPlan.findUnique({ where: { id: planId } });
    return row ? mapTrainingPlan(row) : null;
  }

  async createTrainingPlan(
    clubId: string,
    teamId: string,
    userId: string,
    input: CreateTrainingPlanInput
  ): Promise<TrainingPlanDTO> {
    const row = await prisma.trainingPlan.create({
      data: {
        clubId,
        teamId,
        createdByUserId: userId,
        eventId: input.eventId ?? null,
        title: input.title,
        focus: input.focus ?? null,
        targetDurationMinutes: input.targetDurationMinutes,
        phases: input.phases,
        isSharedWithTeam: input.isSharedWithTeam,
      },
    });
    return mapTrainingPlan(row);
  }

  async updateTrainingPlan(
    planId: string,
    input: UpdateTrainingPlanInput
  ): Promise<TrainingPlanDTO> {
    const row = await prisma.trainingPlan.update({
      where: { id: planId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.focus !== undefined ? { focus: input.focus } : {}),
        ...(input.eventId !== undefined ? { eventId: input.eventId } : {}),
        ...(input.targetDurationMinutes !== undefined
          ? { targetDurationMinutes: input.targetDurationMinutes }
          : {}),
        ...(input.phases !== undefined ? { phases: input.phases } : {}),
        ...(input.isSharedWithTeam !== undefined
          ? { isSharedWithTeam: input.isSharedWithTeam }
          : {}),
      },
    });
    return mapTrainingPlan(row);
  }

  async deleteTrainingPlan(planId: string): Promise<void> {
    await prisma.trainingPlan.delete({ where: { id: planId } });
  }
}
