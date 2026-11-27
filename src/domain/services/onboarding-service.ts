import { LeagueCatalogRepository } from "../adapters/league-catalog-repository";
import {
  ClubRepository,
  MemberRepository,
  TeamRepository,
} from "../adapters/repositories";
import { SeasonCatalogRepository } from "../adapters/season-catalog-repository";
import { DomainError } from "../errors";
import { ViewerContext } from "../policies/rbac";
import { OnboardingInput, OnboardingSchema } from "../schemas/club";
import { TeamLeagueLinkResultDTO } from "../schemas/league-directory";
import { resolveTeamUsesResin } from "../data/german-leagues";
import { LeagueDirectoryService } from "./league-directory-service";
import { buildClubLogoUrl } from "./club-service";
import { NuligaClubLogoFetcher } from "./nuliga-club-logo";

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

export class OnboardingService {
  constructor(
    private readonly clubs: ClubRepository,
    private readonly teams: TeamRepository,
    private readonly members: MemberRepository,
    private readonly leagueCatalog?: LeagueCatalogRepository,
    private readonly seasonCatalog?: SeasonCatalogRepository,
    private readonly leagueDirectory?: LeagueDirectoryService,
    private readonly fetchClubLogo?: NuligaClubLogoFetcher
  ) {}

  /**
   * Schlanker Einzelteam-Start oder Vereins-Onboarding in einem Schritt:
   * Legt automatisch Verein (Club), aktive Saison, erste Mannschaft (Team)
   * und das eigene Kader-Profil (TeamMember) an.
   * Wenn eine HVNB-Verzeichnismannschaft (`leagueGroupTeamId`) gewählt wurde,
   * werden automatisch Liga-Verknüpfung, Spielplan-Import & Staffel-Gegner eingerichtet.
   */
  async completeOnboarding(viewer: ViewerContext, rawInput: unknown) {
    const parsed = OnboardingSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Onboarding-Daten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const input: OnboardingInput = parsed.data;

    let resolvedSeasonName = input.seasonName;
    let resolvedSeasonStartDate: Date | null = null;
    let resolvedSeasonEndDate: Date | null = null;

    if (this.seasonCatalog) {
      if (input.seasonId) {
        const catalogSeason = await this.seasonCatalog.findById(input.seasonId);
        if (!catalogSeason || !catalogSeason.isActive) {
          throw DomainError.validation(
            "Die ausgewählte Saison existiert nicht oder ist nicht mehr aktiv.",
            { seasonId: ["Bitte wähle eine gültige Saison aus der Liste aus."] }
          );
        }
        resolvedSeasonName = catalogSeason.name;
        resolvedSeasonStartDate = catalogSeason.startDate
          ? new Date(catalogSeason.startDate)
          : null;
        resolvedSeasonEndDate = catalogSeason.endDate
          ? new Date(catalogSeason.endDate)
          : null;
      } else {
        const catalogSeason = await this.seasonCatalog.findByName(
          input.seasonName
        );
        if (!catalogSeason || !catalogSeason.isActive) {
          throw DomainError.validation(
            "Die ausgewählte Saison ist nicht im Saison-Katalog hinterlegt.",
            {
              seasonId: [
                "Bitte wähle eine gültige Saison aus der Auswahl-Liste.",
              ],
            }
          );
        }
        resolvedSeasonName = catalogSeason.name;
        resolvedSeasonStartDate = catalogSeason.startDate
          ? new Date(catalogSeason.startDate)
          : null;
        resolvedSeasonEndDate = catalogSeason.endDate
          ? new Date(catalogSeason.endDate)
          : null;
      }
    }

    let resolvedLeagueId: string | null = input.leagueId ?? null;
    let resolvedLeagueName: string | null = input.leagueName ?? null;
    let resolvedAgeGroup = input.ageGroup ?? null;

    if (input.leagueId && this.leagueCatalog) {
      const league = await this.leagueCatalog.findById(input.leagueId);
      if (!league) {
        throw DomainError.validation(
          "Die ausgewählte Liga existiert nicht im Liga-Katalog.",
          { leagueId: ["Bitte wähle eine gültige Liga aus der Liste aus."] }
        );
      }
      resolvedLeagueId = league.id;
      resolvedLeagueName = league.displayName;
      if (!resolvedAgeGroup) {
        resolvedAgeGroup = league.ageGroup;
      }
    }

    const resolvedUsesResin = resolveTeamUsesResin({
      usesResin: input.usesResin,
      ageGroup: resolvedAgeGroup,
      category: input.category,
      teamName: input.teamName,
    });

    const baseSlug = slugify(input.clubName) || "verein";
    const existing = await this.clubs.findBySlug(baseSlug);
    const slug = existing
      ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
      : baseSlug;

    const { club: createdClub, season } =
      await this.clubs.createClubWithSeason({
        name: input.clubName,
        shortName: input.clubShortName ?? null,
        slug,
        city: input.city ?? null,
        seasonName: resolvedSeasonName,
        seasonStartDate: resolvedSeasonStartDate,
        seasonEndDate: resolvedSeasonEndDate,
      });
    let club = createdClub;

    const team = await this.teams.create({
      clubId: club.id,
      seasonId: season.id,
      name: input.teamName,
      category: input.category,
      ageGroup: resolvedAgeGroup,
      gender: input.gender,
      usesResin: resolvedUsesResin,
      leagueId: resolvedLeagueId,
      leagueName: resolvedLeagueName,
    });

    // Personalunion möglich: Trainer (COACH) kann zusätzlich Vereins-Admin (isClubAdmin) sein
    const creatorIsClubAdmin =
      input.creatorRole === "CLUB_ADMIN" || Boolean(input.creatorIsClubAdmin);

    const member = await this.members.create(club.id, team.id, {
      firstName: input.creatorFirstName,
      lastName: input.creatorLastName,
      role: input.creatorRole,
      isClubAdmin: creatorIsClubAdmin,
      availabilityStatus: "FIT",
      teamRoles: [],
      isMinor: false,
      email: viewer.email,
      userId: viewer.userId,
      jerseyNumber: null,
      primaryPosition: null,
      secondaryPosition: null,
      throwingHand: null,
      passNumber: null,
      injuryNote: null,
      emergencyContact: null,
      phone: null,
    });

    let leagueLink: TeamLeagueLinkResultDTO | null = null;
    if (input.leagueGroupTeamId && this.leagueDirectory) {
      leagueLink = await this.leagueDirectory.linkTeamInternal(club.id, team.id, {
        leagueGroupTeamId: input.leagueGroupTeamId,
        autoImportSchedule: input.autoImportSchedule ?? true,
        seedGroupOpponents: input.seedGroupOpponents ?? true,
      });
    }

    // Best-Effort: Vereinslogo automatisch aus nuLiga laden, falls noch keins vorhanden
    if (!club.logoUrl && this.fetchClubLogo && this.clubs.updateLogo) {
      try {
        const refreshed = await this.clubs.findByIdWithDetails(club.id);
        if (refreshed?.club.logoUrl) {
          club = refreshed.club;
        } else {
          const resolvedLogo = await this.fetchClubLogo({
            clubName: input.clubName,
          });
          if (resolvedLogo) {
            club = await this.clubs.updateLogo(club.id, {
              data: resolvedLogo.data,
              mimeType: resolvedLogo.mimeType,
              logoUrl: buildClubLogoUrl(club.id),
            });
          }
        }
      } catch {
        // Best effort: Onboarding niemals wegen Logo-Abruf abbrechen
      }
    }

    return { club, season, team, member, leagueLink };
  }
}
