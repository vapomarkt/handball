import { LeagueDirectoryRepository } from "../adapters/league-directory-repository";
import {
  FetchTextFn,
  LeagueSyncRepository,
} from "../adapters/league-provider";
import { ScoutingRepository } from "../adapters/m4-repositories";
import { TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import { canManageEvents, ViewerContext } from "../policies/rbac";
import {
  LeagueDirectoryMatchSuggestionDTO,
  LeagueDirectorySearchQuerySchema,
  LeagueDirectorySearchResponseDTO,
  LeagueGroupDTO,
  LinkTeamToDirectorySchema,
  TeamLeagueLinkResultDTO,
} from "../schemas/league-directory";
import { LeagueSyncService } from "./league-sync-service";
import { resolveNuligaTeamFeed } from "./nuliga-feed-resolver";

const NOISE_WORDS = new Set([
  "tus",
  "tsv",
  "vfl",
  "sv",
  "tv",
  "sg",
  "hsg",
  "jsg",
  "mjsg",
  "wjsg",
  "hl",
  "hv",
  "atsv",
  "mtv",
  "ev",
  "e.v.",
  "handball",
  "sc",
  "fc",
]);

export function normalizeClubText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeClubMatchScore(
  queryClubName: string,
  candidateTeamName: string,
  candidateClubName: string
): { score: number; reason: string } {
  const qNorm = normalizeClubText(queryClubName);
  if (qNorm.length < 2) return { score: 0, reason: "" };

  const teamNorm = normalizeClubText(candidateTeamName);
  const clubNorm = normalizeClubText(candidateClubName);

  if (qNorm === teamNorm || qNorm === clubNorm) {
    return { score: 100, reason: "Exakter Vereinsname" };
  }
  if (
    teamNorm.includes(qNorm) ||
    clubNorm.includes(qNorm) ||
    qNorm.includes(clubNorm)
  ) {
    return { score: 85, reason: "Vereinsname stimmt überein" };
  }

  const qTokens = qNorm
    .split(" ")
    .filter((t) => t.length >= 3 && !NOISE_WORDS.has(t));
  const cTokens = new Set(
    `${teamNorm} ${clubNorm}`
      .split(" ")
      .filter((t) => t.length >= 3 && !NOISE_WORDS.has(t))
  );

  if (qTokens.length === 0 || cTokens.size === 0) {
    return { score: 0, reason: "" };
  }

  let matched = 0;
  for (const token of qTokens) {
    for (const cToken of cTokens) {
      if (cToken === token || cToken.startsWith(token) || token.startsWith(cToken)) {
        matched += 1;
        break;
      }
    }
  }

  if (matched === 0) return { score: 0, reason: "" };
  const ratio = matched / qTokens.length;
  const score = Math.round(45 + ratio * 35);
  return {
    score,
    reason:
      matched === qTokens.length
        ? "Alle Stichwörter stimmen überein"
        : "Ähnlicher Vereinsname",
  };
}

export class LeagueDirectoryService {
  constructor(
    private readonly directory: LeagueDirectoryRepository,
    private readonly teams: TeamRepository,
    private readonly leagueSyncRepo: LeagueSyncRepository,
    private readonly leagueSyncService: LeagueSyncService,
    private readonly scouting?: ScoutingRepository,
    private readonly fetchText?: FetchTextFn
  ) {}

  async search(rawQuery: unknown): Promise<LeagueDirectorySearchResponseDTO> {
    const parsed = LeagueDirectorySearchQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Suchparameter für das Liga-Verzeichnis.",
        parsed.error.flatten().fieldErrors
      );
    }

    const query = parsed.data;
    const allGroups = await this.directory.findGroupsWithTeams({
      federationCode: query.federationCode,
      seasonName: query.seasonName,
      ageGroup: query.ageGroup,
      gender: query.gender,
      leagueId: query.leagueId,
    });

    // Regionen aggregieren (vor regionCode- und q-Filter, damit alle Regionen wählbar bleiben)
    const regionMap = new Map<string, { name: string; count: number }>();
    for (const g of allGroups) {
      const existing = regionMap.get(g.regionCode);
      if (existing) {
        existing.count += 1;
      } else {
        regionMap.set(g.regionCode, { name: g.regionName, count: 1 });
      }
    }
    const regions = Array.from(regionMap.entries())
      .map(([code, info]) => ({
        code,
        name: info.name,
        groupCount: info.count,
      }))
      .sort((a, b) => {
        if (a.code === "HVNB") return -1;
        if (b.code === "HVNB") return 1;
        return a.name.localeCompare(b.name, "de");
      });

    // Auto-Suggest anhand des Vereinsnamens über alle passenden Gruppen
    const suggestions: LeagueDirectoryMatchSuggestionDTO[] = [];
    if (query.clubName && query.clubName.trim().length >= 2) {
      for (const group of allGroups) {
        const { teams: groupTeams, ...groupMeta } = group;
        for (const team of groupTeams) {
          const { score, reason } = computeClubMatchScore(
            query.clubName,
            team.name,
            team.clubName
          );
          if (score >= 55) {
            suggestions.push({
              team,
              group: groupMeta,
              opponentCount: Math.max(0, groupTeams.length - 1),
              score: score + (team.hasIcalFeed ? 5 : 0),
              matchReason: reason,
            });
          }
        }
      }
      suggestions.sort((a, b) => b.score - a.score);
    }

    // Gruppen nach Region & Suchbegriff filtern
    const normalizedQ = normalizeClubText(query.q ?? "");
    const groups: LeagueGroupDTO[] = allGroups
      .filter((group) => {
        if (query.regionCode && group.regionCode !== query.regionCode) {
          return false;
        }
        if (!normalizedQ) return true;

        const groupHaystack = normalizeClubText(
          `${group.name} ${group.shortName ?? ""} ${group.regionName} ${group.regionCode}`
        );
        if (groupHaystack.includes(normalizedQ)) return true;

        return group.teams.some((t) =>
          normalizeClubText(`${t.name} ${t.clubName} ${t.shortName ?? ""}`).includes(
            normalizedQ
          )
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    return {
      federationCode: query.federationCode,
      regions,
      suggestions: suggestions.slice(0, 6),
      groups,
    };
  }

  async linkTeamToDirectoryTeam(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<TeamLeagueLinkResultDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Mannschaften mit einer Liga-Staffel verknüpfen."
      );
    }

    const parsed = LinkTeamToDirectorySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Verknüpfungsdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.linkTeamInternal(team.clubId, team.id, parsed.data);
  }

  /**
   * Interne Verknüpfung für Onboarding & ClubService (wenn der Ersteller bereits autorisiert ist).
   */
  async linkTeamInternal(
    clubId: string,
    teamId: string,
    input: {
      leagueGroupTeamId: string;
      autoImportSchedule: boolean;
      seedGroupOpponents: boolean;
    }
  ): Promise<TeamLeagueLinkResultDTO> {
    const groupTeam = await this.directory.findGroupTeamById(
      input.leagueGroupTeamId
    );
    if (!groupTeam) {
      throw DomainError.notFound(
        "Die ausgewählte HVNB-Mannschaft wurde im Verzeichnis nicht gefunden."
      );
    }

    const displayLeagueName = `${groupTeam.group.name} (${groupTeam.group.federationCode})`;

    // Verzeichnis enthält nicht für jede Mannschaft eine Feed-URL: live bei nuLiga auflösen.
    let feedUrl = groupTeam.icalUrl;
    if (!feedUrl && this.fetchText) {
      try {
        feedUrl = await resolveNuligaTeamFeed(this.fetchText, {
          clubName: groupTeam.clubName,
          teamName: groupTeam.name,
          groupName: groupTeam.group.name,
          groupUrl: groupTeam.group.externalUrl,
          teamUrl: groupTeam.externalUrl,
        });
        if (feedUrl) {
          await this.directory.updateGroupTeamIcalUrl(groupTeam.id, feedUrl);
        }
      } catch {
        // Auflösung ist best effort – die Verknüpfung soll trotzdem bestehen.
      }
    }

    await this.teams.update(teamId, {
      leagueId: groupTeam.group.leagueId ?? undefined,
      leagueName: displayLeagueName,
      leagueGroupTeamId: groupTeam.id,
    });

    // Bestehende HVNB-Quelle für dieses Team aktualisieren oder neu anlegen
    const existingSources = await this.leagueSyncRepo.listSourcesByTeam(teamId);
    const existingHvnbSource = existingSources.find(
      (s) => s.provider === "HVNB_NULIGA" || s.leagueGroupTeamId !== null
    );

    if (existingHvnbSource) {
      await this.leagueSyncRepo.deleteSource(existingHvnbSource.id);
    }

    const createdSource = await this.leagueSyncRepo.createSource(clubId, teamId, {
      provider: "HVNB_NULIGA",
      leagueGroupTeamId: groupTeam.id,
      name: `${groupTeam.group.name} (${groupTeam.group.federationCode})`,
      sourceUrl: feedUrl ?? null,
      teamNameMatch: groupTeam.name,
      isEnabled: Boolean(feedUrl),
      syncIntervalMinutes: 60,
    });
    const sourceId = createdSource.id;

    let syncSummary = null;
    let syncWarning: string | null = null;

    if (input.autoImportSchedule) {
      if (!feedUrl) {
        syncWarning =
          "Die Mannschaft ist verknüpft, aber für diese Staffel ist noch kein automatischer iCal-Feed hinterlegt. Du kannst unter Termine → Liga-Sync jederzeit eine Feed-URL oder CSV ergänzen.";
      } else {
        try {
          syncSummary = await this.leagueSyncService.syncSourceById(sourceId);
        } catch (err) {
          syncWarning =
            err instanceof Error
              ? `Verknüpfung gespeichert, aber der erste Spielplan-Abruf ist fehlgeschlagen (${err.message}). Der automatische Sync versucht es stündlich erneut.`
              : "Verknüpfung gespeichert, aber der erste Spielplan-Abruf ist fehlgeschlagen.";
        }
      }
    }

    let seededOpponentsCount = 0;
    if (input.seedGroupOpponents && this.scouting) {
      const existingOpponents = await this.scouting.listOpponentsByTeam(
        teamId,
        false
      );
      const existingNames = new Set(
        existingOpponents.map((o) => normalizeClubText(o.name))
      );

      for (const sibling of groupTeam.siblingTeams) {
        if (sibling.id === groupTeam.id) continue;
        if (existingNames.has(normalizeClubText(sibling.name))) continue;
        try {
          await this.scouting.createOpponent(clubId, teamId, {
            name: sibling.name,
            leagueName: groupTeam.group.name,
            externalUrl: sibling.externalUrl ?? null,
            defenseSystems: [],
            attackSystems: [],
            transitionNotes: null,
            strengths: null,
            weaknesses: null,
            generalNotes: `Automatisch aus ${groupTeam.group.federationCode}-Staffel „${groupTeam.group.name}“ übernommen.`,
          });
          existingNames.add(normalizeClubText(sibling.name));
          seededOpponentsCount += 1;
        } catch {
          // Idempotenz-Schutz bei Parallelität (Unique Constraint [teamId, name])
        }
      }
    }

    return {
      teamId,
      leagueId: groupTeam.group.leagueId,
      leagueName: displayLeagueName,
      leagueGroupTeamId: groupTeam.id,
      officialTeamName: groupTeam.name,
      groupName: groupTeam.group.name,
      regionName: groupTeam.group.regionName,
      sourceId,
      hasIcalFeed: Boolean(feedUrl),
      syncSummary,
      syncWarning,
      seededOpponentsCount,
    };
  }

  async unlinkTeamFromDirectory(
    viewer: ViewerContext,
    teamId: string
  ): Promise<void> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen die Liga-Verknüpfung lösen."
      );
    }

    await this.teams.update(teamId, { leagueGroupTeamId: null });

    const sources = await this.leagueSyncRepo.listSourcesByTeam(teamId);
    for (const src of sources) {
      if (src.provider === "HVNB_NULIGA" || src.leagueGroupTeamId) {
        await this.leagueSyncRepo.deleteSource(src.id);
      }
    }
  }
}
