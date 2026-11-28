import { LeagueCatalogRepository } from "../adapters/league-catalog-repository";
import { FEDERATION_CONFIG_BY_CODE } from "../data/federation-registry";
import { GERMAN_FEDERATION_BY_CODE } from "../data/german-leagues";
import { DomainError } from "../errors";
import {
  LeagueCatalogQuerySchema,
  LeagueCatalogResponseDTO,
  LeagueDTO,
  LeagueFederationSummaryDTO,
} from "../schemas/league-catalog";

export class LeagueCatalogService {
  constructor(private readonly repo: LeagueCatalogRepository) {}

  async listLeagues(rawQuery: unknown): Promise<LeagueCatalogResponseDTO> {
    const parsed = LeagueCatalogQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Filterparameter für den Liga-Katalog.",
        parsed.error.flatten().fieldErrors
      );
    }

    const query = parsed.data;
    const allForAgeAndGender = await this.repo.findMany({
      countryCode: query.countryCode,
      ageGroup: query.ageGroup,
      gender: query.gender,
    });

    // Verbands-Übersicht anhand der gewählten Altersklasse & Geschlecht aggregieren
    const fedCounts = new Map<
      string,
      { name: string; count: number }
    >();
    for (const league of allForAgeAndGender) {
      const existing = fedCounts.get(league.federationCode);
      if (existing) {
        existing.count += 1;
      } else {
        fedCounts.set(league.federationCode, {
          name: league.federationName,
          count: 1,
        });
      }
    }

    const federations: LeagueFederationSummaryDTO[] = Array.from(
      fedCounts.entries()
    )
      .map(([code, info]) => {
        const germanMeta = GERMAN_FEDERATION_BY_CODE.get(code);
        const registryMeta = FEDERATION_CONFIG_BY_CODE.get(code);
        return {
          code,
          name: germanMeta?.name ?? registryMeta?.name ?? info.name,
          regionLabel:
            germanMeta?.regionLabel ?? registryMeta?.regionLabel ?? info.name,
          isNational:
            germanMeta?.isNational ?? registryMeta?.isNational ?? code === "DHB",
          leagueCount: info.count,
          searchKeywords: germanMeta?.searchKeywords ?? [
            code.toLowerCase(),
            ...(registryMeta?.shortLabel
              ? [registryMeta.shortLabel.toLowerCase()]
              : []),
          ],
        };
      })
      .sort((a, b) => {
        if (a.isNational !== b.isNational) return a.isNational ? -1 : 1;
        return a.name.localeCompare(b.name, "de");
      });

    // Gefilterte Ligen (nach Verband & optionaler Suche)
    const normalizedQ = query.q?.toLowerCase().trim() ?? "";
    const leagues = allForAgeAndGender
      .filter((league) => {
        if (query.federationCode && league.federationCode !== query.federationCode) {
          return false;
        }
        if (normalizedQ) {
          const haystack = [
            league.name,
            league.shortName ?? "",
            league.displayName,
            league.federationName,
            league.federationCode,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedQ);
        }
        return true;
      })
      .sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.name.localeCompare(b.name, "de");
      });

    return {
      countryCode: query.countryCode,
      federations,
      leagues,
    };
  }

  async resolveLeagueById(leagueId: string): Promise<LeagueDTO> {
    const league = await this.repo.findById(leagueId);
    if (!league) {
      throw DomainError.validation(
        "Die ausgewählte Liga existiert nicht im Liga-Katalog.",
        { leagueId: ["Bitte wähle eine gültige Liga aus der Liste aus."] }
      );
    }
    return league;
  }
}
