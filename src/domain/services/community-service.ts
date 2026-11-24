import type { CommunityRepository } from "../adapters/m5-repositories";
import type { TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import {
  canManageEvents,
  canViewTeam,
  isTeamStaff,
  type ViewerContext,
} from "../policies/rbac";
import {
  CreateAnnouncementSchema,
  CreatePollSchema,
  type TeamAnnouncementDTO,
  type TeamPollDTO,
  UpdateAnnouncementSchema,
  VotePollSchema,
} from "../schemas/community";

export class CommunityService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly community: CommunityRepository
  ) {}

  async listAnnouncements(
    viewer: ViewerContext,
    teamId: string
  ): Promise<TeamAnnouncementDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf Ankündigungen.");
    }

    const staff = isTeamStaff(viewer, team.id, team.clubId);
    return this.community.listAnnouncementsByTeam(team.id, staff);
  }

  async createAnnouncement(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<TeamAnnouncementDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Ankündigungen veröffentlichen."
      );
    }

    const parsed = CreateAnnouncementSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Ankündigung.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.community.createAnnouncement(
      team.clubId,
      team.id,
      viewer.userId,
      viewer.name,
      parsed.data
    );
  }

  async updateAnnouncement(
    viewer: ViewerContext,
    teamId: string,
    announcementId: string,
    rawInput: unknown
  ): Promise<TeamAnnouncementDTO> {
    const existing = await this.community.findAnnouncementById(announcementId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Ankündigung nicht gefunden.");
    }
    if (!canManageEvents(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Bearbeiten.");
    }

    const parsed = UpdateAnnouncementSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Ankündigung.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.community.updateAnnouncement(announcementId, parsed.data);
  }

  async deleteAnnouncement(
    viewer: ViewerContext,
    teamId: string,
    announcementId: string
  ): Promise<void> {
    const existing = await this.community.findAnnouncementById(announcementId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Ankündigung nicht gefunden.");
    }
    if (!canManageEvents(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.community.deleteAnnouncement(announcementId);
  }

  async listPolls(
    viewer: ViewerContext,
    teamId: string
  ): Promise<TeamPollDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf Umfragen.");
    }
    return this.community.listPollsByTeam(team.id, viewer.userId);
  }

  async createPoll(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<TeamPollDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Umfragen erstellen."
      );
    }

    const parsed = CreatePollSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Umfrage.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.community.createPoll(
      team.clubId,
      team.id,
      viewer.userId,
      viewer.name,
      parsed.data
    );
  }

  async votePoll(
    viewer: ViewerContext,
    teamId: string,
    pollId: string,
    rawInput: unknown
  ): Promise<TeamPollDTO> {
    const poll = await this.community.findPollById(pollId, viewer.userId);
    if (!poll || poll.teamId !== teamId) {
      throw DomainError.notFound("Umfrage nicht gefunden.");
    }
    if (!canViewTeam(viewer, poll.teamId, poll.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diese Umfrage.");
    }
    if (poll.isClosed) {
      throw DomainError.conflict("Diese Umfrage ist bereits geschlossen.");
    }

    const parsed = VotePollSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Stimmabgabe.",
        parsed.error.flatten().fieldErrors
      );
    }

    const hasOption = poll.options.some((o) => o.id === parsed.data.optionId);
    if (!hasOption) {
      throw DomainError.notFound("Antwortoption nicht gefunden.");
    }

    return this.community.toggleVote(
      poll.id,
      parsed.data.optionId,
      viewer.userId,
      viewer.name,
      poll.allowMultiple
    );
  }

  async deletePoll(
    viewer: ViewerContext,
    teamId: string,
    pollId: string
  ): Promise<void> {
    const poll = await this.community.findPollById(pollId, viewer.userId);
    if (!poll || poll.teamId !== teamId) {
      throw DomainError.notFound("Umfrage nicht gefunden.");
    }
    if (!canManageEvents(viewer, poll.teamId, poll.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.community.deletePoll(pollId);
  }
}
