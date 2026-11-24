import type { CashboxRepository } from "../adapters/m5-repositories";
import type { TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import {
  canManageEvents,
  canViewTeam,
  type ViewerContext,
} from "../policies/rbac";
import {
  type CashboxOverviewDTO,
  type CashboxSummaryDTO,
  type CashEntryStatus,
  CreateCashEntrySchema,
  CreateFineCatalogItemSchema,
  type FineCatalogItemDTO,
  type TeamCashEntryDTO,
  UpdateCashEntryStatusSchema,
} from "../schemas/community";

/**
 * Reine Berechnungsfunktion für den aktuellen Kassenstand (in Cent, ohne Rundungsfehler).
 * - Kassenstand = bezahlte Einzahlungen + bezahlte Strafen - bezahlte Ausgaben
 * - Offene Strafen werden separat ausgewiesen (gesamt & für den aktuellen Nutzer/Kinder).
 */
export function calculateCashboxSummary(
  entries: Pick<
    TeamCashEntryDTO,
    "type" | "status" | "amountCents" | "memberId"
  >[],
  viewerMemberIds: string[]
): CashboxSummaryDTO {
  const viewerSet = new Set(viewerMemberIds);
  let totalIncomeCents = 0;
  let totalPaidFinesCents = 0;
  let totalExpensesCents = 0;
  let openFinesTotalCents = 0;
  let openFinesCount = 0;
  let myOpenFinesCents = 0;
  let myOpenFinesCount = 0;

  for (const e of entries) {
    if (e.type === "INCOME" && e.status === "PAID") {
      totalIncomeCents += e.amountCents;
    } else if (e.type === "EXPENSE" && e.status === "PAID") {
      totalExpensesCents += e.amountCents;
    } else if (e.type === "FINE") {
      if (e.status === "PAID") {
        totalPaidFinesCents += e.amountCents;
      } else {
        openFinesTotalCents += e.amountCents;
        openFinesCount += 1;
        if (e.memberId && viewerSet.has(e.memberId)) {
          myOpenFinesCents += e.amountCents;
          myOpenFinesCount += 1;
        }
      }
    }
  }

  return {
    balanceCents: totalIncomeCents + totalPaidFinesCents - totalExpensesCents,
    totalIncomeCents,
    totalPaidFinesCents,
    totalExpensesCents,
    openFinesTotalCents,
    openFinesCount,
    myOpenFinesCents,
    myOpenFinesCount,
  };
}

export function formatCentsEur(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${euros},${rest} €`;
}

export class CashboxService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly cashbox: CashboxRepository
  ) {}

  private async canManageCashbox(
    viewer: ViewerContext,
    teamId: string,
    clubId: string
  ): Promise<boolean> {
    if (canManageEvents(viewer, teamId, clubId)) return true;
    return this.cashbox.isUserTreasurerInTeam(viewer.userId, teamId);
  }

  async getOverview(
    viewer: ViewerContext,
    teamId: string
  ): Promise<CashboxOverviewDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf die Mannschaftskasse.");
    }

    const [entries, catalog, canManage] = await Promise.all([
      this.cashbox.listEntriesByTeam(team.id),
      this.cashbox.listCatalogByTeam(team.id),
      this.canManageCashbox(viewer, team.id, team.clubId),
    ]);

    const viewerMemberIds = [
      ...viewer.memberships
        .filter((m) => m.teamId === team.id)
        .map((m) => m.memberId),
      ...viewer.linkedChildMemberIds,
    ];

    const summary = calculateCashboxSummary(entries, viewerMemberIds);
    return { summary, entries, catalog, canManage };
  }

  async createEntry(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<TeamCashEntryDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    const allowed = await this.canManageCashbox(viewer, team.id, team.clubId);
    if (!allowed) {
      throw DomainError.forbidden(
        "Nur Trainer, Vereins-Admins oder der Kassenwart dürfen Buchungen anlegen."
      );
    }

    const parsed = CreateCashEntrySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Kassenbuchung.",
        parsed.error.flatten().fieldErrors
      );
    }

    const defaultStatus: CashEntryStatus =
      parsed.data.status ?? (parsed.data.type === "FINE" ? "OPEN" : "PAID");

    return this.cashbox.createEntry(team.clubId, team.id, viewer.userId, {
      ...parsed.data,
      status: defaultStatus,
    });
  }

  async updateEntryStatus(
    viewer: ViewerContext,
    teamId: string,
    entryId: string,
    rawInput: unknown
  ): Promise<TeamCashEntryDTO> {
    const existing = await this.cashbox.findEntryById(entryId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Kassenbuchung nicht gefunden.");
    }
    const allowed = await this.canManageCashbox(
      viewer,
      existing.teamId,
      existing.clubId
    );
    if (!allowed) {
      throw DomainError.forbidden(
        "Nur Trainer, Vereins-Admins oder der Kassenwart dürfen den Zahlungsstatus ändern."
      );
    }

    const parsed = UpdateCashEntryStatusSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültiger Zahlungsstatus.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.cashbox.updateEntryStatus(entryId, parsed.data.status);
  }

  async deleteEntry(
    viewer: ViewerContext,
    teamId: string,
    entryId: string
  ): Promise<void> {
    const existing = await this.cashbox.findEntryById(entryId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Kassenbuchung nicht gefunden.");
    }
    const allowed = await this.canManageCashbox(
      viewer,
      existing.teamId,
      existing.clubId
    );
    if (!allowed) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.cashbox.deleteEntry(entryId);
  }

  async createCatalogItem(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<FineCatalogItemDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    const allowed = await this.canManageCashbox(viewer, team.id, team.clubId);
    if (!allowed) {
      throw DomainError.forbidden(
        "Nur Trainer, Vereins-Admins oder der Kassenwart dürfen den Strafenkatalog bearbeiten."
      );
    }

    const parsed = CreateFineCatalogItemSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültiger Strafenkatalog-Eintrag.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.cashbox.createCatalogItem(team.clubId, team.id, parsed.data);
  }

  async deleteCatalogItem(
    viewer: ViewerContext,
    teamId: string,
    itemId: string
  ): Promise<void> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    const allowed = await this.canManageCashbox(viewer, team.id, team.clubId);
    if (!allowed) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    const deleted = await this.cashbox.deleteCatalogItem(itemId, team.id);
    if (!deleted) {
      throw DomainError.notFound("Strafenkatalog-Eintrag nicht gefunden.");
    }
  }
}
