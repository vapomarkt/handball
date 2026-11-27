import { LeagueDirectoryRepository } from "../adapters/league-directory-repository";
import {
  FetchTextFn,
  LeagueSyncRepository,
} from "../adapters/league-provider";
import { MemberRepository, TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import { projectTeamMemberDTO } from "../policies/gdpr";
import {
  canDeleteMember,
  canManageRoster,
  canViewTeam,
  getMemberEditScope,
  isClubAdmin,
  ViewerContext,
} from "../policies/rbac";
import { LeagueAgeGroup } from "../schemas/league-catalog";
import {
  CreateTeamMemberSchema,
  NuligaRosterCandidateDTO,
  NuligaRosterImportResultDTO,
  NuligaRosterImportSchema,
  NuligaRosterPreviewResponseDTO,
  NuligaRosterPreviewSchema,
  SelfUpdateMemberSchema,
  TeamMemberEntity,
  TeamMemberResponseDTO,
  UpdateTeamMemberSchema,
} from "../schemas/member";
import {
  fetchNuligaTeamRoster,
  isAllowedNuligaUrl,
  normalizePlayerNameKey,
} from "./nuliga-opponent-players";

const YOUTH_AGE_GROUPS = new Set<LeagueAgeGroup>([
  "YOUTH_A",
  "YOUTH_B",
  "YOUTH_C",
  "YOUTH_D",
  "YOUTH_E",
  "YOUTH_F_MINI",
]);

function isYouthTeamAgeGroup(
  ageGroup: LeagueAgeGroup | null | undefined
): boolean {
  return Boolean(ageGroup && YOUTH_AGE_GROUPS.has(ageGroup));
}

export class RosterService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly members: MemberRepository,
    private readonly leagueDirectory?: LeagueDirectoryRepository,
    private readonly leagueSync?: LeagueSyncRepository,
    private readonly fetchText?: FetchTextFn
  ) {}

  async listRoster(
    viewer: ViewerContext,
    teamId: string
  ): Promise<TeamMemberResponseDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Kader.");
    }

    const roster = await this.members.findByTeamId(teamId);
    return roster.map((member) => projectTeamMemberDTO(viewer, member));
  }

  async getMember(
    viewer: ViewerContext,
    teamId: string,
    memberId: string
  ): Promise<TeamMemberResponseDTO> {
    const member = await this.members.findById(memberId);
    if (!member || member.teamId !== teamId) {
      throw DomainError.notFound("Kader-Mitglied nicht gefunden.");
    }
    if (!canViewTeam(viewer, member.teamId, member.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf dieses Profil.");
    }
    return projectTeamMemberDTO(viewer, member);
  }

  async addMember(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<TeamMemberResponseDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageRoster(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer, Betreuer oder Vereins-Admins dürfen Spieler anlegen."
      );
    }

    const parsed = CreateTeamMemberSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Spielerdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const created = await this.members.create(team.clubId, team.id, {
      ...parsed.data,
      userId: null, // Entkoppeltes Profil bis zum Claim-Flow
    });

    return projectTeamMemberDTO(viewer, created);
  }

  async previewNuligaRoster(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown = {}
  ): Promise<NuligaRosterPreviewResponseDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageRoster(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer, Betreuer oder Vereins-Admins dürfen Spielberichte aus nuLiga abrufen."
      );
    }
    if (!this.fetchText) {
      throw DomainError.conflict(
        "Der nuLiga-Abruf ist in dieser Umgebung nicht konfiguriert."
      );
    }

    const parsed = NuligaRosterPreviewSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige nuLiga-URL.",
        parsed.error.flatten().fieldErrors
      );
    }

    const manualUrl = parsed.data.sourceUrl ?? null;
    if (manualUrl && !isAllowedNuligaUrl(manualUrl)) {
      throw DomainError.validation(
        "Bitte eine gültige nuLiga-URL (https://...liga.nu/...) eingeben.",
        { sourceUrl: ["Es werden nur nuLiga-URLs (*.liga.nu) unterstützt."] }
      );
    }

    let directReportUrl: string | null = null;
    let teamUrl: string | null = null;
    let groupUrl: string | null = null;
    let officialTeamName: string | null = team.leagueOfficialTeamName ?? null;
    let clubName: string | null = team.clubName ?? null;

    const assignUrl = (url: string | null | undefined) => {
      if (!url || !isAllowedNuligaUrl(url)) return;
      if (url.includes("groupMeetingReport")) {
        if (!directReportUrl) directReportUrl = url;
      } else if (url.includes("teamPortrait")) {
        if (!teamUrl) teamUrl = url;
      } else if (!groupUrl) {
        groupUrl = url;
      }
    };

    assignUrl(manualUrl);

    if (team.leagueGroupTeamId && this.leagueDirectory) {
      const groupTeam = await this.leagueDirectory.findGroupTeamById(
        team.leagueGroupTeamId
      );
      if (groupTeam) {
        if (!officialTeamName) officialTeamName = groupTeam.name;
        if (!clubName) clubName = groupTeam.clubName;
        if (!manualUrl) {
          assignUrl(groupTeam.externalUrl);
          assignUrl(groupTeam.group.externalUrl);
        }
      }
    }

    if (!directReportUrl && !teamUrl && !groupUrl && this.leagueSync) {
      const sources = await this.leagueSync.listSourcesByTeam(teamId);
      for (const src of sources) {
        if (src.teamNameMatch && !officialTeamName) {
          officialTeamName = src.teamNameMatch;
        }
        assignUrl(src.sourceUrl);
      }
    }

    const fetched = await fetchNuligaTeamRoster(this.fetchText, {
      teamName: team.name,
      officialTeamName,
      clubName,
      groupUrl,
      teamUrl,
      directReportUrl,
      maxMatchReports: parsed.data.maxMatchReports,
    });

    const existingRoster = await this.members.findByTeamId(teamId);
    const existingByNameKey = new Map<string, TeamMemberEntity>();
    for (const m of existingRoster) {
      existingByNameKey.set(
        normalizePlayerNameKey(`${m.firstName} ${m.lastName}`),
        m
      );
    }

    const toCandidateDto = (
      candidate: (typeof fetched.players)[number]
    ): NuligaRosterCandidateDTO => {
      const match = existingByNameKey.get(
        normalizePlayerNameKey(`${candidate.firstName} ${candidate.lastName}`)
      );
      return {
        ...candidate,
        alreadyInRoster: Boolean(match),
        existingMemberId: match?.id ?? null,
        existingMemberJerseyNumber: match?.jerseyNumber ?? null,
      };
    };

    return {
      resolvedTeamUrl: fetched.resolvedTeamUrl,
      resolvedGroupUrl: fetched.resolvedGroupUrl,
      reportsAnalyzed: fetched.reportsAnalyzed,
      anonymizedDetected: fetched.anonymizedDetected,
      defaultIsMinor: isYouthTeamAgeGroup(team.ageGroup),
      warning: fetched.warning,
      players: fetched.players.map(toCandidateDto),
      officials: fetched.officials.map(toCandidateDto),
    };
  }

  async importNuligaRoster(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<NuligaRosterImportResultDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageRoster(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer, Betreuer oder Vereins-Admins dürfen Kader-Profile importieren."
      );
    }

    const parsed = NuligaRosterImportSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Import-Auswahl.",
        parsed.error.flatten().fieldErrors
      );
    }

    const viewerIsClubAdmin = isClubAdmin(viewer, team.clubId);
    for (const item of parsed.data.members) {
      if (item.role === "CLUB_ADMIN" && !viewerIsClubAdmin) {
        throw DomainError.forbidden(
          "Nur Vereins-Admins dürfen Mitglieder mit der Rolle Vereins-Admin anlegen."
        );
      }
    }

    const existingRoster = await this.members.findByTeamId(teamId);
    const existingByNameKey = new Map<string, TeamMemberEntity>();
    for (const m of existingRoster) {
      existingByNameKey.set(
        normalizePlayerNameKey(`${m.firstName} ${m.lastName}`),
        m
      );
    }

    const defaultIsMinor = isYouthTeamAgeGroup(team.ageGroup);
    const seenInBatch = new Set<string>();
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const saved: TeamMemberResponseDTO[] = [];

    for (const item of parsed.data.members) {
      const nameKey = normalizePlayerNameKey(
        `${item.firstName} ${item.lastName}`
      );
      if (!nameKey || seenInBatch.has(nameKey)) {
        skippedCount += 1;
        continue;
      }
      seenInBatch.add(nameKey);

      const existing = existingByNameKey.get(nameKey);
      if (existing) {
        if (
          parsed.data.updateExistingJerseyNumbers &&
          existing.jerseyNumber === null &&
          item.jerseyNumber !== null &&
          item.jerseyNumber !== undefined
        ) {
          const updated = await this.members.update(existing.id, {
            jerseyNumber: item.jerseyNumber,
            phone: undefined,
          });
          existingByNameKey.set(nameKey, updated);
          saved.push(projectTeamMemberDTO(viewer, updated));
          updatedCount += 1;
        } else {
          skippedCount += 1;
        }
        continue;
      }

      const isMinor =
        item.role === "PLAYER"
          ? (item.isMinor ?? defaultIsMinor)
          : false;

      const created = await this.members.create(team.clubId, team.id, {
        firstName: item.firstName,
        lastName: item.lastName,
        role: item.role,
        jerseyNumber: item.role === "PLAYER" ? (item.jerseyNumber ?? null) : null,
        primaryPosition: null,
        secondaryPosition: null,
        throwingHand: null,
        availabilityStatus: "FIT",
        teamRoles: [],
        isMinor,
        passNumber: null,
        injuryNote: null,
        emergencyContact: null,
        email: null,
        phone: null,
        userId: null,
      });

      existingByNameKey.set(nameKey, created);
      saved.push(projectTeamMemberDTO(viewer, created));
      createdCount += 1;
    }

    return {
      createdCount,
      updatedCount,
      skippedCount,
      members: saved,
    };
  }

  async updateMember(
    viewer: ViewerContext,
    teamId: string,
    memberId: string,
    rawInput: unknown
  ): Promise<TeamMemberResponseDTO> {
    const existing = await this.members.findById(memberId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Kader-Mitglied nicht gefunden.");
    }

    const scope = getMemberEditScope(viewer, existing);
    if (scope === "NONE") {
      throw DomainError.forbidden(
        "Keine Berechtigung zum Bearbeiten dieses Profils."
      );
    }

    if (scope === "FULL") {
      const parsed = UpdateTeamMemberSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw DomainError.validation(
          "Ungültige Profildaten.",
          parsed.error.flatten().fieldErrors
        );
      }
      const updated = await this.members.update(memberId, parsed.data);
      return projectTeamMemberDTO(viewer, updated);
    }

    // SELF_OR_GUARDIAN: nur erlaubte Profilfelder (Positionen nur bei Spielern)
    const parsed = SelfUpdateMemberSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Profildaten.",
        parsed.error.flatten().fieldErrors
      );
    }
    const sanitized =
      existing.role === "PLAYER"
        ? parsed.data
        : {
            ...parsed.data,
            primaryPosition: undefined,
            secondaryPosition: undefined,
          };
    const updated = await this.members.update(memberId, sanitized);
    return projectTeamMemberDTO(viewer, updated);
  }

  async deleteMember(
    viewer: ViewerContext,
    teamId: string,
    memberId: string
  ): Promise<void> {
    const existing = await this.members.findById(memberId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Kader-Mitglied nicht gefunden.");
    }
    if (!canDeleteMember(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden(
        "Nur Cheftrainer oder Vereins-Admins dürfen Kader-Profile entfernen."
      );
    }

    await this.members.delete(memberId);
  }
}
