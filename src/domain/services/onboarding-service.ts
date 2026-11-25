import { LeagueCatalogRepository } from "../adapters/league-catalog-repository";
import {
  ClubRepository,
  MemberRepository,
  TeamRepository,
} from "../adapters/repositories";
import { SeasonCatalogRepository } from "../adapters/season-catalog-repository";
import { OnboardingInput, OnboardingSchema } from "../schemas/club";
import { DomainError } from "../errors";
import { ViewerContext } from "../policies/rbac";

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
    private readonly seasonCatalog?: SeasonCatalogRepository
  ) {}

  /**
   * Schlanker Einzelteam-Start oder Vereins-Onboarding in einem Schritt:
   * Legt automatisch Verein (Club), aktive Saison, erste Mannschaft (Team)
   * und das eigene Kader-Profil (TeamMember) an.
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
    }

    const baseSlug = slugify(input.clubName) || "verein";
    const existing = await this.clubs.findBySlug(baseSlug);
    const slug = existing
      ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
      : baseSlug;

    const { club, season } = await this.clubs.createClubWithSeason({
      name: input.clubName,
      shortName: input.clubShortName ?? null,
      slug,
      city: input.city ?? null,
      seasonName: resolvedSeasonName,
      seasonStartDate: resolvedSeasonStartDate,
      seasonEndDate: resolvedSeasonEndDate,
    });

    const team = await this.teams.create({
      clubId: club.id,
      seasonId: season.id,
      name: input.teamName,
      category: input.category,
      gender: input.gender,
      leagueId: resolvedLeagueId,
      leagueName: resolvedLeagueName,
    });

    // Beim Einzelteam-Start erhält der Ersteller mindestens CLUB_ADMIN oder COACH
    // (wenn er als Trainer startet, braucht er dennoch Vereinsrechte für Hallen/Saisons -> CLUB_ADMIN falls gewählt, sonst COACH)
    const member = await this.members.create(club.id, team.id, {
      firstName: input.creatorFirstName,
      lastName: input.creatorLastName,
      role: input.creatorRole,
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

    return { club, season, team, member };
  }
}
