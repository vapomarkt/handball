import { describe, expect, it, vi } from "vitest";
import type {
  CashboxRepository,
  CommunityRepository,
} from "@/domain/adapters/m5-repositories";
import type { TeamRecord, TeamRepository } from "@/domain/adapters/repositories";
import type { ViewerContext } from "@/domain/policies/rbac";
import {
  calculateCashboxSummary,
  CashboxService,
  formatCentsEur,
} from "@/domain/services/cashbox-service";
import { CommunityService } from "@/domain/services/community-service";

const TEAM: TeamRecord = {
  id: "team-h1",
  clubId: "club-1",
  seasonId: "season-1",
  name: "Herren 1",
  category: "Aktive",
  gender: "MALE",
  leagueName: "Verbandsliga",
};

const COACH_VIEWER: ViewerContext = {
  userId: "user-coach",
  email: "trainer@tsv-musterstadt.de",
  name: "Markus Brenner",
  memberships: [
    {
      memberId: "tm-coach",
      teamId: "team-h1",
      clubId: "club-1",
      role: "COACH",
    },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

const PLAYER_VIEWER: ViewerContext = {
  userId: "user-player",
  email: "spieler@tsv-musterstadt.de",
  name: "Lukas Hartmann",
  memberships: [
    {
      memberId: "tm-player",
      teamId: "team-h1",
      clubId: "club-1",
      role: "PLAYER",
    },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

function makeTeamRepo(): TeamRepository {
  return {
    findById: vi.fn().mockResolvedValue(TEAM),
    findByClubId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

describe("M5 Mannschaftskasse – Cent-Arithmetik & Kassenwart-RBAC", () => {
  it("berechnet Kassenstand, offene Strafen und eigene offene Strafen exakt in Cent", () => {
    const summary = calculateCashboxSummary(
      [
        { type: "INCOME", status: "PAID", amountCents: 18000, memberId: null },
        { type: "EXPENSE", status: "PAID", amountCents: 3500, memberId: null },
        {
          type: "FINE",
          status: "PAID",
          amountCents: 300,
          memberId: "tm-player",
        },
        {
          type: "FINE",
          status: "OPEN",
          amountCents: 500,
          memberId: "tm-player",
        },
        {
          type: "FINE",
          status: "OPEN",
          amountCents: 200,
          memberId: "tm-other",
        },
      ],
      ["tm-player"]
    );

    expect(summary.balanceCents).toBe(14800);
    expect(summary.openFinesTotalCents).toBe(700);
    expect(summary.openFinesCount).toBe(2);
    expect(summary.myOpenFinesCents).toBe(500);
    expect(summary.myOpenFinesCount).toBe(1);
    expect(formatCentsEur(summary.balanceCents)).toBe("148,00 €");
    expect(formatCentsEur(-250)).toBe("-2,50 €");
  });

  it("verweigert normalem PLAYER Schreibrechte, erlaubt aber Kassenwart (Team-Amt)", async () => {
    const createEntry = vi.fn().mockResolvedValue({
      id: "e1",
      clubId: "club-1",
      teamId: "team-h1",
      memberId: "tm-player",
      memberName: "Lukas Hartmann",
      type: "FINE",
      status: "OPEN",
      title: "Zu spät",
      amountCents: 200,
      notes: null,
      paidAt: null,
      createdAt: "2026-11-24T10:00:00.000Z",
    });

    const isUserTreasurerInTeam = vi.fn().mockResolvedValue(false);
    const cashRepo: CashboxRepository = {
      listEntriesByTeam: vi.fn().mockResolvedValue([]),
      findEntryById: vi.fn(),
      createEntry,
      updateEntryStatus: vi.fn(),
      deleteEntry: vi.fn(),
      listCatalogByTeam: vi.fn().mockResolvedValue([]),
      createCatalogItem: vi.fn(),
      deleteCatalogItem: vi.fn(),
      isUserTreasurerInTeam,
    };

    const service = new CashboxService(makeTeamRepo(), cashRepo);

    // Normaler Spieler: 403 FORBIDDEN
    await expect(
      service.createEntry(PLAYER_VIEWER, "team-h1", {
        type: "FINE",
        title: "Zu spät",
        amountCents: 200,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    // Derselbe Spieler mit Team-Amt "Kassenwart": erlaubt!
    isUserTreasurerInTeam.mockResolvedValueOnce(true);
    const created = await service.createEntry(PLAYER_VIEWER, "team-h1", {
      type: "FINE",
      title: "Zu spät",
      amountCents: 200,
    });
    expect(created.id).toBe("e1");
    expect(createEntry).toHaveBeenCalledTimes(1);
  });
});

describe("M5 CommunityService – Schwarzes Brett RBAC", () => {
  it("filtert STAFF_ONLY-Ankündigungen serverseitig für PLAYER aus", async () => {
    const listAnnouncementsByTeam = vi.fn().mockResolvedValue([]);
    const commRepo: CommunityRepository = {
      listAnnouncementsByTeam,
      findAnnouncementById: vi.fn(),
      createAnnouncement: vi.fn(),
      updateAnnouncement: vi.fn(),
      deleteAnnouncement: vi.fn(),
      listPollsByTeam: vi.fn().mockResolvedValue([]),
      findPollById: vi.fn(),
      createPoll: vi.fn(),
      toggleVote: vi.fn(),
      deletePoll: vi.fn(),
    };

    const service = new CommunityService(makeTeamRepo(), commRepo);

    await service.listAnnouncements(PLAYER_VIEWER, "team-h1");
    expect(listAnnouncementsByTeam).toHaveBeenLastCalledWith("team-h1", false);

    await service.listAnnouncements(COACH_VIEWER, "team-h1");
    expect(listAnnouncementsByTeam).toHaveBeenLastCalledWith("team-h1", true);

    await expect(
      service.createAnnouncement(PLAYER_VIEWER, "team-h1", {
        title: "Test",
        body: "Inhalt",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });
});
