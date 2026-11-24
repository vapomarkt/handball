import {
  CreateMatchdayInput,
  CreateWorkDutyInput,
  DutyAssignmentStatus,
  DutyScope,
  MatchdayDTO,
  WorkDutyAssignmentDTO,
  WorkDutyDTO,
} from "../schemas/duty";
import {
  CreateDrillInput,
  CreateTrainingPlanInput,
  DrillDTO,
  TrainingPlanDTO,
  UpdateTrainingPlanInput,
} from "../schemas/training";

export interface DutyRepository {
  listMatchdaysByClub(clubId: string): Promise<MatchdayDTO[]>;
  createMatchday(
    clubId: string,
    input: CreateMatchdayInput
  ): Promise<MatchdayDTO>;

  listDutiesByClub(
    clubId: string,
    filter?: { teamId?: string; scope?: DutyScope; matchdayId?: string }
  ): Promise<WorkDutyDTO[]>;
  findDutyById(dutyId: string): Promise<WorkDutyDTO | null>;
  createDuty(clubId: string, input: CreateWorkDutyInput): Promise<WorkDutyDTO>;
  deleteDuty(dutyId: string): Promise<void>;

  findAssignmentById(assignmentId: string): Promise<{
    id: string;
    dutyId: string;
    clubId: string;
    teamId: string | null;
    assignedTeamId: string | null;
    assignedMemberId: string | null;
    assignedMemberUserId: string | null;
    status: DutyAssignmentStatus;
    hoursCredit: number;
  } | null>;
  createAssignment(input: {
    dutyId: string;
    assignedMemberId: string;
    status: DutyAssignmentStatus;
  }): Promise<WorkDutyAssignmentDTO>;
  updateAssignment(
    assignmentId: string,
    input: {
      assignedMemberId?: string | null;
      status?: DutyAssignmentStatus;
      swapNote?: string | null;
      completedAt?: Date | null;
    }
  ): Promise<WorkDutyAssignmentDTO>;

  listAssignmentsForTeamMembers(teamId: string): Promise<
    Array<{
      memberId: string;
      status: DutyAssignmentStatus;
      hoursCredit: number;
    }>
  >;
}

export interface TrainingRepository {
  listDrills(clubId: string, teamId: string): Promise<DrillDTO[]>;
  findDrillById(drillId: string): Promise<DrillDTO | null>;
  createDrill(
    clubId: string,
    teamId: string | null,
    userId: string,
    input: CreateDrillInput
  ): Promise<DrillDTO>;
  deleteDrill(drillId: string): Promise<void>;

  listTrainingPlansByTeam(
    teamId: string,
    onlyShared: boolean
  ): Promise<TrainingPlanDTO[]>;
  findTrainingPlanById(planId: string): Promise<TrainingPlanDTO | null>;
  createTrainingPlan(
    clubId: string,
    teamId: string,
    userId: string,
    input: CreateTrainingPlanInput
  ): Promise<TrainingPlanDTO>;
  updateTrainingPlan(
    planId: string,
    input: UpdateTrainingPlanInput
  ): Promise<TrainingPlanDTO>;
  deleteTrainingPlan(planId: string): Promise<void>;
}
