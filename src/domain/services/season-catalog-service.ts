import { SeasonCatalogRepository } from "../adapters/season-catalog-repository";
import { DomainError } from "../errors";
import { isAnyClubAdmin, ViewerContext } from "../policies/rbac";
import {
  CreateSeasonCatalogSchema,
  SeasonCatalogDTO,
  UpdateSeasonCatalogSchema,
} from "../schemas/season-catalog";

export class SeasonCatalogService {
  constructor(private readonly repo: SeasonCatalogRepository) {}

  /**
   * Öffentliche Liste aller aktiven Saisons für Auswahlfelder (z. B. Registrierung / Onboarding).
   */
  async listPublicSeasons(): Promise<SeasonCatalogDTO[]> {
    return this.repo.findAll({ activeOnly: true });
  }

  /**
   * Vollständige Liste (inkl. inaktiver Saisons) für die Hintergrund-Pflege.
   */
  async listAllSeasons(viewer: ViewerContext): Promise<SeasonCatalogDTO[]> {
    if (!isAnyClubAdmin(viewer)) {
      throw DomainError.forbidden(
        "Nur Vereins-Admins dürfen den Saison-Katalog verwalten."
      );
    }
    return this.repo.findAll({ activeOnly: false });
  }

  async createSeason(
    viewer: ViewerContext,
    rawInput: unknown
  ): Promise<SeasonCatalogDTO> {
    if (!isAnyClubAdmin(viewer)) {
      throw DomainError.forbidden(
        "Nur Vereins-Admins dürfen neue Saisons anlegen."
      );
    }

    const parsed = CreateSeasonCatalogSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Saisondaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const existing = await this.repo.findByName(parsed.data.name);
    if (existing) {
      throw DomainError.conflict(
        `Die Saison „${parsed.data.name}“ existiert bereits.`
      );
    }

    // Eine als Standard markierte Saison muss immer aktiv sein
    const isActive = parsed.data.isDefault ? true : parsed.data.isActive;

    return this.repo.create({
      name: parsed.data.name,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      sortOrder: parsed.data.sortOrder,
      isDefault: parsed.data.isDefault,
      isActive,
    });
  }

  async updateSeason(
    viewer: ViewerContext,
    seasonId: string,
    rawInput: unknown
  ): Promise<SeasonCatalogDTO> {
    if (!isAnyClubAdmin(viewer)) {
      throw DomainError.forbidden(
        "Nur Vereins-Admins dürfen Saisons bearbeiten."
      );
    }

    const existing = await this.repo.findById(seasonId);
    if (!existing) {
      throw DomainError.notFound("Saison nicht gefunden.");
    }

    const parsed = UpdateSeasonCatalogSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Saisondaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const data = parsed.data;

    if (data.name && data.name !== existing.name) {
      const conflict = await this.repo.findByName(data.name);
      if (conflict && conflict.id !== seasonId) {
        throw DomainError.conflict(
          `Die Saison „${data.name}“ existiert bereits.`
        );
      }
    }

    // Prüfe Zeitraum auch gegen bestehendes Start-/Enddatum
    const effectiveStart =
      data.startDate !== undefined ? data.startDate : existing.startDate;
    const effectiveEnd =
      data.endDate !== undefined ? data.endDate : existing.endDate;
    if (
      effectiveStart &&
      effectiveEnd &&
      Date.parse(effectiveEnd) < Date.parse(effectiveStart)
    ) {
      throw DomainError.validation(
        "Das Enddatum darf nicht vor dem Startdatum liegen.",
        { endDate: ["Das Enddatum darf nicht vor dem Startdatum liegen."] }
      );
    }

    const nextIsDefault = data.isDefault ?? existing.isDefault;
    const nextIsActive = nextIsDefault
      ? true
      : (data.isActive ?? existing.isActive);

    // Es muss immer mindestens eine aktive Saison für die Registrierung bleiben
    if (existing.isActive && !nextIsActive) {
      const activeSeasons = await this.repo.findAll({ activeOnly: true });
      if (activeSeasons.length <= 1) {
        throw DomainError.validation(
          "Mindestens eine Saison muss aktiv bleiben, damit neue Mannschaften registriert werden können."
        );
      }
    }

    return this.repo.update(seasonId, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.startDate !== undefined
        ? { startDate: data.startDate ? new Date(data.startDate) : null }
        : {}),
      ...(data.endDate !== undefined
        ? { endDate: data.endDate ? new Date(data.endDate) : null }
        : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      ...(nextIsActive !== existing.isActive ? { isActive: nextIsActive } : {}),
    });
  }

  async deleteSeason(viewer: ViewerContext, seasonId: string): Promise<void> {
    if (!isAnyClubAdmin(viewer)) {
      throw DomainError.forbidden(
        "Nur Vereins-Admins dürfen Saisons löschen."
      );
    }

    const existing = await this.repo.findById(seasonId);
    if (!existing) {
      throw DomainError.notFound("Saison nicht gefunden.");
    }

    if (existing.isActive) {
      const activeSeasons = await this.repo.findAll({ activeOnly: true });
      if (activeSeasons.length <= 1) {
        throw DomainError.validation(
          "Die letzte aktive Saison kann nicht gelöscht werden."
        );
      }
    }

    await this.repo.delete(seasonId);
  }
}
