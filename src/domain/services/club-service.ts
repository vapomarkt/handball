import {
  ClubRepository,
  TeamRepository,
} from "../adapters/repositories";
import { DomainError } from "../errors";
import {
  canCreateTeam,
  canManageClub,
  canViewClub,
  canViewTeam,
  isTeamStaff,
  ViewerContext,
} from "../policies/rbac";
import {
  CreateClubSchema,
  CreateSeasonSchema,
  CreateTeamSchema,
  UpdateTeamSchema,
} from "../schemas/club";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export class ClubService {
  constructor(
    private readonly clubs: ClubRepository,
    private readonly teams: TeamRepository
  ) {}

  async listClubsForUser(viewer: ViewerContext) {
    return this.clubs.findClubsForUser(viewer.userId);
  }

  async getClubDetails(viewer: ViewerContext, clubId: string) {
    if (!canViewClub(viewer, clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Verein.");
    }
    const details = await this.clubs.findByIdWithDetails(clubId);
    if (!details) {
      throw DomainError.notFound("Verein nicht gefunden.");
    }
    return details;
  }

  async createClub(rawInput: unknown) {
    const parsed = CreateClubSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Vereinsdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const baseSlug = slugify(parsed.data.name) || "verein";
    const existing = await this.clubs.findBySlug(baseSlug);
    const slug = existing
      ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
      : baseSlug;

    return this.clubs.createClubWithSeason({
      name: parsed.data.name,
      shortName: parsed.data.shortName ?? null,
      slug,
      city: parsed.data.city ?? null,
      seasonName: parsed.data.seasonName,
    });
  }

  async createSeason(viewer: ViewerContext, clubId: string, rawInput: unknown) {
    if (!canManageClub(viewer, clubId)) {
      throw DomainError.forbidden(
        "Nur Vereins-Admins dürfen neue Saisons anlegen."
      );
    }

    const parsed = CreateSeasonSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Saisondaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.clubs.createSeason({
      clubId,
      name: parsed.data.name,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      isActive: parsed.data.isActive,
    });
  }

  async listTeamsInClub(viewer: ViewerContext, clubId: string) {
    if (!canViewClub(viewer, clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Verein.");
    }
    const allTeams = await this.teams.findByClubId(clubId);
    // Vereins-Admins sehen alle Teams des Vereins, andere Mitglieder sehen ihre Teams
    if (canManageClub(viewer, clubId)) {
      return allTeams;
    }
    return allTeams.filter((team) => canViewTeam(viewer, team.id, clubId));
  }

  async createTeam(viewer: ViewerContext, clubId: string, rawInput: unknown) {
    if (!canCreateTeam(viewer, clubId)) {
      throw DomainError.forbidden(
        "Nur Vereins-Admins oder Trainer dürfen neue Mannschaften anlegen."
      );
    }

    const parsed = CreateTeamSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Mannschaftsdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.teams.create({
      clubId,
      seasonId: parsed.data.seasonId,
      name: parsed.data.name,
      category: parsed.data.category,
      gender: parsed.data.gender,
      leagueName: parsed.data.leagueName ?? null,
    });
  }

  async getTeam(viewer: ViewerContext, teamId: string) {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diese Mannschaft.");
    }
    return team;
  }

  async updateTeam(viewer: ViewerContext, teamId: string, rawInput: unknown) {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!isTeamStaff(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer oder Vereins-Admins dürfen Mannschaftsdaten ändern."
      );
    }

    const parsed = UpdateTeamSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Mannschaftsdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.teams.update(teamId, parsed.data);
  }
}
