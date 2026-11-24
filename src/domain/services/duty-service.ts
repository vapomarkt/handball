import { DutyRepository } from "../adapters/m3-repositories";
import { MemberRepository, TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import {
  canManageEvents,
  canManageVenues,
  canSubmitRsvpForMember,
  canViewClub,
  canViewTeam,
  isClubAdmin,
  isTeamStaff,
  ViewerContext,
} from "../policies/rbac";
import {
  ClaimDutySchema,
  CreateMatchdaySchema,
  CreateWorkDutySchema,
  DutyScope,
  MatchdayDTO,
  SwapDutySchema,
  TeamWorkHoursSummaryDTO,
  WorkDutyAssignmentDTO,
  WorkDutyDTO,
} from "../schemas/duty";
import { computeTeamWorkHoursSummary } from "./work-hours";

export class DutyService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly members: MemberRepository,
    private readonly duties: DutyRepository
  ) {}

  async listMatchdays(
    viewer: ViewerContext,
    clubId: string
  ): Promise<MatchdayDTO[]> {
    if (!canViewClub(viewer, clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Verein.");
    }
    return this.duties.listMatchdaysByClub(clubId);
  }

  async createMatchday(
    viewer: ViewerContext,
    clubId: string,
    rawInput: unknown
  ): Promise<MatchdayDTO> {
    if (!canManageVenues(viewer, clubId)) {
      throw DomainError.forbidden(
        "Nur Vereins-Admins oder Trainer dürfen Heimspieltage anlegen."
      );
    }
    const parsed = CreateMatchdaySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Heimspieltag-Daten.",
        parsed.error.flatten().fieldErrors
      );
    }
    return this.duties.createMatchday(clubId, parsed.data);
  }

  async listDuties(
    viewer: ViewerContext,
    clubId: string,
    filter?: { teamId?: string; scope?: DutyScope; matchdayId?: string }
  ): Promise<WorkDutyDTO[]> {
    if (!canViewClub(viewer, clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf die Dienste dieses Vereins.");
    }
    return this.duties.listDutiesByClub(clubId, filter);
  }

  async createDuty(
    viewer: ViewerContext,
    clubId: string,
    rawInput: unknown
  ): Promise<WorkDutyDTO> {
    const parsed = CreateWorkDutySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Dienstdaten.",
        parsed.error.flatten().fieldErrors
      );
    }
    const data = parsed.data;

    if (data.scope === "CLUB_MATCHDAY") {
      if (!canManageVenues(viewer, clubId)) {
        throw DomainError.forbidden(
          "Nur Vereins-Admins oder Trainer dürfen Heimspieltag-Dienste anlegen."
        );
      }
    } else if (data.teamId) {
      if (!canManageEvents(viewer, data.teamId, clubId)) {
        throw DomainError.forbidden(
          "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Team-Dienste anlegen."
        );
      }
    } else if (!canManageVenues(viewer, clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Anlegen von Diensten.");
    }

    return this.duties.createDuty(clubId, data);
  }

  async deleteDuty(
    viewer: ViewerContext,
    clubId: string,
    dutyId: string
  ): Promise<void> {
    const duty = await this.duties.findDutyById(dutyId);
    if (!duty || duty.clubId !== clubId) {
      throw DomainError.notFound("Dienst nicht gefunden.");
    }
    const allowed = duty.teamId
      ? canManageEvents(viewer, duty.teamId, clubId)
      : canManageVenues(viewer, clubId);
    if (!allowed) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen dieses Dienstes.");
    }
    await this.duties.deleteDuty(dutyId);
  }

  async claimSlot(
    viewer: ViewerContext,
    clubId: string,
    dutyId: string,
    rawInput: unknown
  ): Promise<WorkDutyAssignmentDTO> {
    const duty = await this.duties.findDutyById(dutyId);
    if (!duty || duty.clubId !== clubId) {
      throw DomainError.notFound("Dienst nicht gefunden.");
    }
    if (!canViewClub(viewer, clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Verein.");
    }

    const parsed = ClaimDutySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Eingabe für Dienst-Übernahme.",
        parsed.error.flatten().fieldErrors
      );
    }

    const member = await this.members.findById(parsed.data.memberId);
    if (!member || member.clubId !== clubId) {
      throw DomainError.notFound("Mitgliedsprofil nicht gefunden.");
    }

    if (!canSubmitRsvpForMember(viewer, member) && !isClubAdmin(viewer, clubId)) {
      throw DomainError.forbidden(
        "Du kannst nur für dich selbst oder dein verknüpftes Kind einen Dienst übernehmen."
      );
    }

    // Team-Delegation prüfen: Wenn der Dienst an ein Team delegiert wurde (z. B. Herren 1),
    // darf nur ein Mitglied dieses Teams (oder ein Vereins-Admin) den Slot übernehmen.
    if (
      duty.assignedTeamId &&
      member.teamId !== duty.assignedTeamId &&
      !isClubAdmin(viewer, clubId)
    ) {
      throw DomainError.forbidden(
        `Dieser Dienst ist an das Team „${duty.assignedTeamName ?? "delegiertes Team"}“ vergeben.`
      );
    }

    const alreadyAssigned = duty.assignments.some(
      (a) => a.assignedMemberId === member.id && a.status !== "OPEN"
    );
    if (alreadyAssigned) {
      throw DomainError.conflict("Dieses Mitglied ist bereits für diesen Dienst eingetragen.");
    }

    if (duty.openSlots <= 0) {
      throw DomainError.conflict("Alle Plätze für diesen Dienst sind bereits besetzt.");
    }

    // Falls es einen OPEN-Placeholder gibt, aktualisieren, sonst neu anlegen
    const openPlaceholder = duty.assignments.find((a) => a.status === "OPEN");
    if (openPlaceholder) {
      return this.duties.updateAssignment(openPlaceholder.id, {
        assignedMemberId: member.id,
        status: "ASSIGNED",
        swapNote: null,
      });
    }

    return this.duties.createAssignment({
      dutyId: duty.id,
      assignedMemberId: member.id,
      status: "ASSIGNED",
    });
  }

  async handleSwap(
    viewer: ViewerContext,
    clubId: string,
    dutyId: string,
    assignmentId: string,
    rawInput: unknown
  ): Promise<WorkDutyAssignmentDTO> {
    const assignment = await this.duties.findAssignmentById(assignmentId);
    if (!assignment || assignment.dutyId !== dutyId || assignment.clubId !== clubId) {
      throw DomainError.notFound("Dienst-Zuweisung nicht gefunden.");
    }

    const parsed = SwapDutySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Tausch-Anfrage.",
        parsed.error.flatten().fieldErrors
      );
    }

    const isOwner =
      (assignment.assignedMemberUserId !== null &&
        assignment.assignedMemberUserId === viewer.userId) ||
      (assignment.assignedMemberId !== null &&
        viewer.linkedChildMemberIds.includes(assignment.assignedMemberId));
    const isStaff = assignment.teamId
      ? isTeamStaff(viewer, assignment.teamId, clubId)
      : canManageVenues(viewer, clubId);

    if (parsed.data.action === "REQUEST_SWAP") {
      if (!isOwner && !isStaff) {
        throw DomainError.forbidden(
          "Nur das eingetragene Mitglied oder Trainer dürfen einen Tausch anfragen."
        );
      }
      if (assignment.status === "COMPLETED") {
        throw DomainError.validation(
          "Ein bereits erledigter Dienst kann nicht mehr getauscht werden."
        );
      }
      return this.duties.updateAssignment(assignmentId, {
        status: "SWAP_REQUESTED",
        swapNote: parsed.data.swapNote ?? null,
      });
    }

    if (parsed.data.action === "CANCEL_SWAP") {
      if (!isOwner && !isStaff) {
        throw DomainError.forbidden("Keine Berechtigung.");
      }
      return this.duties.updateAssignment(assignmentId, {
        status: "ASSIGNED",
        swapNote: null,
      });
    }

    // ACCEPT_SWAP: anderes Mitglied übernimmt den Tausch-Slot!
    if (assignment.status !== "SWAP_REQUESTED") {
      throw DomainError.validation(
        "Dieser Dienst steht aktuell nicht in der Tauschbörse."
      );
    }
    if (!parsed.data.replacementMemberId) {
      throw DomainError.validation("Ersatz-Mitgliedsprofil erforderlich.");
    }

    const replacement = await this.members.findById(
      parsed.data.replacementMemberId
    );
    if (!replacement || replacement.clubId !== clubId) {
      throw DomainError.notFound("Ersatz-Mitglied nicht gefunden.");
    }
    if (
      !canSubmitRsvpForMember(viewer, replacement) &&
      !isClubAdmin(viewer, clubId)
    ) {
      throw DomainError.forbidden(
        "Du kannst nur für dich selbst oder dein verknüpftes Kind einen Tausch annehmen."
      );
    }
    if (
      assignment.assignedTeamId &&
      replacement.teamId !== assignment.assignedTeamId &&
      !isClubAdmin(viewer, clubId)
    ) {
      throw DomainError.forbidden(
        "Der Tauschpartner muss dem delegierten Team angehören."
      );
    }

    return this.duties.updateAssignment(assignmentId, {
      assignedMemberId: replacement.id,
      status: "ASSIGNED",
      swapNote: null,
    });
  }

  async completeAssignment(
    viewer: ViewerContext,
    clubId: string,
    dutyId: string,
    assignmentId: string
  ): Promise<WorkDutyAssignmentDTO> {
    const assignment = await this.duties.findAssignmentById(assignmentId);
    if (!assignment || assignment.dutyId !== dutyId || assignment.clubId !== clubId) {
      throw DomainError.notFound("Dienst-Zuweisung nicht gefunden.");
    }

    const allowed = assignment.teamId
      ? canManageEvents(viewer, assignment.teamId, clubId)
      : canManageVenues(viewer, clubId);
    if (!allowed) {
      throw DomainError.forbidden(
        "Nur Trainer oder Vereins-Admins dürfen Dienste als erledigt bestätigen."
      );
    }

    return this.duties.updateAssignment(assignmentId, {
      status: "COMPLETED",
      completedAt: new Date(),
      swapNote: null,
    });
  }

  async getTeamWorkHours(
    viewer: ViewerContext,
    teamId: string,
    annualTargetHours = 8
  ): Promise<TeamWorkHoursSummaryDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf dieses Arbeitsstunden-Konto.");
    }

    const [roster, assignments] = await Promise.all([
      this.members.findByTeamId(teamId),
      this.duties.listAssignmentsForTeamMembers(teamId),
    ]);

    return computeTeamWorkHoursSummary(
      teamId,
      roster.map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
      })),
      assignments,
      annualTargetHours
    );
  }
}
