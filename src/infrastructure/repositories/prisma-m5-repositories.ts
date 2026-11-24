import type {
  CashboxRepository,
  CommunityRepository,
} from "@/domain/adapters/m5-repositories";
import type {
  AnnouncementAudience,
  CashEntryStatus,
  CashEntryType,
  CreateAnnouncementInput,
  CreateCashEntryInput,
  CreateFineCatalogItemInput,
  CreatePollInput,
  FineCatalogItemDTO,
  TeamAnnouncementDTO,
  TeamCashEntryDTO,
  TeamPollDTO,
  UpdateAnnouncementInput,
} from "@/domain/schemas/community";
import { prisma } from "../db/prisma";

function mapAnnouncement(row: {
  id: string;
  clubId: string;
  teamId: string;
  authorUserId: string;
  authorName: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TeamAnnouncementDTO {
  return {
    id: row.id,
    clubId: row.clubId,
    teamId: row.teamId,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    title: row.title,
    body: row.body,
    audience: row.audience,
    isPinned: row.isPinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapPoll(
  row: {
    id: string;
    clubId: string;
    teamId: string;
    createdByName: string;
    question: string;
    allowMultiple: boolean;
    isClosed: boolean;
    createdAt: Date;
    options: Array<{
      id: string;
      label: string;
      sortOrder: number;
      votes: Array<{ userId: string }>;
    }>;
  },
  viewerUserId: string
): TeamPollDTO {
  const options = row.options
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({
      id: o.id,
      label: o.label,
      sortOrder: o.sortOrder,
      voteCount: o.votes.length,
      votedByMe: o.votes.some((v) => v.userId === viewerUserId),
    }));
  const totalVotes = options.reduce((acc, o) => acc + o.voteCount, 0);
  return {
    id: row.id,
    clubId: row.clubId,
    teamId: row.teamId,
    createdByName: row.createdByName,
    question: row.question,
    allowMultiple: row.allowMultiple,
    isClosed: row.isClosed,
    totalVotes,
    options,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaCommunityRepository implements CommunityRepository {
  async listAnnouncementsByTeam(
    teamId: string,
    includeStaffOnly: boolean
  ): Promise<TeamAnnouncementDTO[]> {
    const rows = await prisma.teamAnnouncement.findMany({
      where: {
        teamId,
        ...(includeStaffOnly ? {} : { audience: "ALL" }),
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(mapAnnouncement);
  }

  async findAnnouncementById(id: string): Promise<TeamAnnouncementDTO | null> {
    const row = await prisma.teamAnnouncement.findUnique({ where: { id } });
    return row ? mapAnnouncement(row) : null;
  }

  async createAnnouncement(
    clubId: string,
    teamId: string,
    authorUserId: string,
    authorName: string,
    input: CreateAnnouncementInput
  ): Promise<TeamAnnouncementDTO> {
    const row = await prisma.teamAnnouncement.create({
      data: {
        clubId,
        teamId,
        authorUserId,
        authorName,
        title: input.title,
        body: input.body,
        audience: input.audience,
        isPinned: input.isPinned,
      },
    });
    return mapAnnouncement(row);
  }

  async updateAnnouncement(
    id: string,
    input: UpdateAnnouncementInput
  ): Promise<TeamAnnouncementDTO> {
    const row = await prisma.teamAnnouncement.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.audience !== undefined ? { audience: input.audience } : {}),
        ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      },
    });
    return mapAnnouncement(row);
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await prisma.teamAnnouncement.delete({ where: { id } });
  }

  async listPollsByTeam(
    teamId: string,
    viewerUserId: string
  ): Promise<TeamPollDTO[]> {
    const rows = await prisma.teamPoll.findMany({
      where: { teamId },
      include: {
        options: {
          include: { votes: { select: { userId: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => mapPoll(r, viewerUserId));
  }

  async findPollById(
    id: string,
    viewerUserId: string
  ): Promise<TeamPollDTO | null> {
    const row = await prisma.teamPoll.findUnique({
      where: { id },
      include: {
        options: {
          include: { votes: { select: { userId: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    return row ? mapPoll(row, viewerUserId) : null;
  }

  async createPoll(
    clubId: string,
    teamId: string,
    createdByUserId: string,
    createdByName: string,
    input: CreatePollInput
  ): Promise<TeamPollDTO> {
    const row = await prisma.teamPoll.create({
      data: {
        clubId,
        teamId,
        createdByUserId,
        createdByName,
        question: input.question,
        allowMultiple: input.allowMultiple,
        options: {
          create: input.options.map((label, idx) => ({
            label,
            sortOrder: idx,
          })),
        },
      },
      include: {
        options: {
          include: { votes: { select: { userId: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    return mapPoll(row, createdByUserId);
  }

  async toggleVote(
    pollId: string,
    optionId: string,
    userId: string,
    voterName: string,
    allowMultiple: boolean
  ): Promise<TeamPollDTO> {
    const existing = await prisma.teamPollVote.findUnique({
      where: { optionId_userId: { optionId, userId } },
    });

    if (existing) {
      await prisma.teamPollVote.delete({ where: { id: existing.id } });
    } else {
      if (!allowMultiple) {
        // Bei Einzelauswahl vorherige Stimmen in dieser Umfrage entfernen
        await prisma.teamPollVote.deleteMany({
          where: {
            userId,
            option: { pollId },
          },
        });
      }
      await prisma.teamPollVote.create({
        data: { optionId, userId, voterName },
      });
    }

    const updated = await this.findPollById(pollId, userId);
    if (!updated) throw new Error("Umfrage nicht mehr vorhanden.");
    return updated;
  }

  async deletePoll(id: string): Promise<void> {
    await prisma.teamPoll.delete({ where: { id } });
  }
}

function mapCashEntry(row: {
  id: string;
  clubId: string;
  teamId: string;
  memberId: string | null;
  member: { firstName: string; lastName: string } | null;
  type: CashEntryType;
  status: CashEntryStatus;
  title: string;
  amountCents: number;
  notes: string | null;
  paidAt: Date | null;
  createdAt: Date;
}): TeamCashEntryDTO {
  return {
    id: row.id,
    clubId: row.clubId,
    teamId: row.teamId,
    memberId: row.memberId,
    memberName: row.member
      ? `${row.member.firstName} ${row.member.lastName}`
      : null,
    type: row.type,
    status: row.status,
    title: row.title,
    amountCents: row.amountCents,
    notes: row.notes,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaCashboxRepository implements CashboxRepository {
  async listEntriesByTeam(teamId: string): Promise<TeamCashEntryDTO[]> {
    const rows = await prisma.teamCashEntry.findMany({
      where: { teamId },
      include: {
        member: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(mapCashEntry);
  }

  async findEntryById(id: string): Promise<TeamCashEntryDTO | null> {
    const row = await prisma.teamCashEntry.findUnique({
      where: { id },
      include: {
        member: { select: { firstName: true, lastName: true } },
      },
    });
    return row ? mapCashEntry(row) : null;
  }

  async createEntry(
    clubId: string,
    teamId: string,
    createdByUserId: string,
    input: CreateCashEntryInput & { status: CashEntryStatus }
  ): Promise<TeamCashEntryDTO> {
    const row = await prisma.teamCashEntry.create({
      data: {
        clubId,
        teamId,
        memberId: input.memberId ?? null,
        type: input.type,
        status: input.status,
        title: input.title,
        amountCents: input.amountCents,
        notes: input.notes ?? null,
        createdByUserId,
        paidAt: input.status === "PAID" ? new Date() : null,
      },
      include: {
        member: { select: { firstName: true, lastName: true } },
      },
    });
    return mapCashEntry(row);
  }

  async updateEntryStatus(
    id: string,
    status: CashEntryStatus
  ): Promise<TeamCashEntryDTO> {
    const row = await prisma.teamCashEntry.update({
      where: { id },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : null,
      },
      include: {
        member: { select: { firstName: true, lastName: true } },
      },
    });
    return mapCashEntry(row);
  }

  async deleteEntry(id: string): Promise<void> {
    await prisma.teamCashEntry.delete({ where: { id } });
  }

  async listCatalogByTeam(teamId: string): Promise<FineCatalogItemDTO[]> {
    const rows = await prisma.fineCatalogItem.findMany({
      where: { teamId },
      orderBy: [{ category: "asc" }, { amountCents: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      clubId: r.clubId,
      teamId: r.teamId,
      title: r.title,
      amountCents: r.amountCents,
      category: r.category,
    }));
  }

  async createCatalogItem(
    clubId: string,
    teamId: string,
    input: CreateFineCatalogItemInput
  ): Promise<FineCatalogItemDTO> {
    const row = await prisma.fineCatalogItem.create({
      data: {
        clubId,
        teamId,
        title: input.title,
        amountCents: input.amountCents,
        category: input.category,
      },
    });
    return {
      id: row.id,
      clubId: row.clubId,
      teamId: row.teamId,
      title: row.title,
      amountCents: row.amountCents,
      category: row.category,
    };
  }

  async deleteCatalogItem(id: string, teamId: string): Promise<boolean> {
    const res = await prisma.fineCatalogItem.deleteMany({
      where: { id, teamId },
    });
    return res.count > 0;
  }

  async isUserTreasurerInTeam(
    userId: string,
    teamId: string
  ): Promise<boolean> {
    const member = await prisma.teamMember.findFirst({
      where: { userId, teamId },
      select: { teamRoles: true },
    });
    if (!member) return false;
    return member.teamRoles.some(
      (r) => r.trim().toLowerCase() === "kassenwart"
    );
  }
}
