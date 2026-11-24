import {
  ScoutingRepository,
  TacticRepository,
} from "@/domain/adapters/m4-repositories";
import {
  CreateOpponentInput,
  CreateOpponentPlayerInput,
  CreateScoutingNoteInput,
  DEFAULT_SHOT_ZONES,
  OpponentDTO,
  OpponentPlayerDTO,
  ScoutingNoteDTO,
  ShotZonesSchema,
  UpdateOpponentInput,
  UpdateScoutingNoteInput,
} from "@/domain/schemas/scouting";
import {
  CreateTacticPlayInput,
  TacticBoardDataSchema,
  TacticPlayDTO,
  UpdateTacticPlayInput,
} from "@/domain/schemas/tactic";
import { createFormationPreset } from "@/domain/services/tactic-presets";
import { prisma } from "../db/prisma";

function mapTacticPlay(row: {
  id: string;
  clubId: string;
  teamId: string;
  title: string;
  description: string | null;
  category: TacticPlayDTO["category"];
  courtMode: TacticPlayDTO["courtMode"];
  boardData: unknown;
  tags: string[];
  isSharedWithTeam: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TacticPlayDTO {
  const parsed = TacticBoardDataSchema.safeParse(row.boardData);
  const boardData = parsed.success
    ? parsed.data
    : createFormationPreset("6_0").boardData;

  return {
    id: row.id,
    clubId: row.clubId,
    teamId: row.teamId,
    title: row.title,
    description: row.description,
    category: row.category,
    courtMode: row.courtMode,
    boardData,
    tags: row.tags,
    isSharedWithTeam: row.isSharedWithTeam,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaTacticRepository implements TacticRepository {
  async listByTeam(
    teamId: string,
    onlyShared: boolean
  ): Promise<TacticPlayDTO[]> {
    const rows = await prisma.tacticPlay.findMany({
      where: {
        teamId,
        ...(onlyShared ? { isSharedWithTeam: true } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapTacticPlay);
  }

  async findById(playId: string): Promise<TacticPlayDTO | null> {
    const row = await prisma.tacticPlay.findUnique({ where: { id: playId } });
    return row ? mapTacticPlay(row) : null;
  }

  async create(
    clubId: string,
    teamId: string,
    userId: string,
    input: CreateTacticPlayInput
  ): Promise<TacticPlayDTO> {
    const row = await prisma.tacticPlay.create({
      data: {
        clubId,
        teamId,
        createdByUserId: userId,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        courtMode: input.courtMode,
        boardData: input.boardData,
        tags: input.tags,
        isSharedWithTeam: input.isSharedWithTeam,
      },
    });
    return mapTacticPlay(row);
  }

  async update(
    playId: string,
    input: UpdateTacticPlayInput
  ): Promise<TacticPlayDTO> {
    const row = await prisma.tacticPlay.update({
      where: { id: playId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.courtMode !== undefined ? { courtMode: input.courtMode } : {}),
        ...(input.boardData !== undefined ? { boardData: input.boardData } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.isSharedWithTeam !== undefined
          ? { isSharedWithTeam: input.isSharedWithTeam }
          : {}),
      },
    });
    return mapTacticPlay(row);
  }

  async delete(playId: string): Promise<void> {
    await prisma.tacticPlay.delete({ where: { id: playId } });
  }
}

function mapOpponentPlayer(p: {
  id: string;
  opponentId: string;
  name: string;
  jerseyNumber: number | null;
  position: OpponentPlayerDTO["position"];
  throwingHand: OpponentPlayerDTO["throwingHand"];
  shotZones: unknown;
  feintPreference: string | null;
  isSevenMeterShooter: boolean;
  threatLevel: OpponentPlayerDTO["threatLevel"];
  notes: string | null;
}): OpponentPlayerDTO {
  const parsedZones = ShotZonesSchema.safeParse(p.shotZones);
  return {
    id: p.id,
    opponentId: p.opponentId,
    name: p.name,
    jerseyNumber: p.jerseyNumber,
    position: p.position,
    throwingHand: p.throwingHand,
    shotZones: parsedZones.success ? parsedZones.data : DEFAULT_SHOT_ZONES,
    feintPreference: p.feintPreference,
    isSevenMeterShooter: p.isSevenMeterShooter,
    threatLevel: p.threatLevel,
    notes: p.notes,
  };
}

function mapNote(n: {
  id: string;
  clubId: string;
  teamId: string;
  opponentId: string;
  opponent?: { name: string };
  eventId: string | null;
  event?: { title: string } | null;
  tacticPlayId: string | null;
  tacticPlay?: { title: string } | null;
  title: string;
  content: string;
  videoUrl: string | null;
  isSharedWithTeam: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ScoutingNoteDTO {
  return {
    id: n.id,
    clubId: n.clubId,
    teamId: n.teamId,
    opponentId: n.opponentId,
    opponentName: n.opponent?.name,
    eventId: n.eventId,
    eventTitle: n.event?.title ?? null,
    tacticPlayId: n.tacticPlayId,
    tacticPlayTitle: n.tacticPlay?.title ?? null,
    title: n.title,
    content: n.content,
    videoUrl: n.videoUrl,
    isSharedWithTeam: n.isSharedWithTeam,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export class PrismaScoutingRepository implements ScoutingRepository {
  async listOpponentsByTeam(
    teamId: string,
    onlySharedNotes: boolean
  ): Promise<OpponentDTO[]> {
    const rows = await prisma.opponent.findMany({
      where: { teamId },
      include: {
        keyPlayers: { orderBy: [{ threatLevel: "asc" }, { jerseyNumber: "asc" }] },
        scoutingNotes: {
          where: onlySharedNotes ? { isSharedWithTeam: true } : undefined,
          include: {
            opponent: { select: { name: true } },
            event: { select: { title: true } },
            tacticPlay: { select: { title: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return rows.map((o) => ({
      id: o.id,
      clubId: o.clubId,
      teamId: o.teamId,
      name: o.name,
      leagueName: o.leagueName,
      defenseSystems: o.defenseSystems,
      attackSystems: o.attackSystems,
      transitionNotes: o.transitionNotes,
      strengths: o.strengths,
      weaknesses: o.weaknesses,
      generalNotes: o.generalNotes,
      keyPlayers: o.keyPlayers.map(mapOpponentPlayer),
      scoutingNotes: o.scoutingNotes.map(mapNote),
      updatedAt: o.updatedAt.toISOString(),
    }));
  }

  async findOpponentById(
    opponentId: string,
    onlySharedNotes: boolean
  ): Promise<OpponentDTO | null> {
    const o = await prisma.opponent.findUnique({
      where: { id: opponentId },
      include: {
        keyPlayers: { orderBy: [{ threatLevel: "asc" }, { jerseyNumber: "asc" }] },
        scoutingNotes: {
          where: onlySharedNotes ? { isSharedWithTeam: true } : undefined,
          include: {
            opponent: { select: { name: true } },
            event: { select: { title: true } },
            tacticPlay: { select: { title: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!o) return null;
    return {
      id: o.id,
      clubId: o.clubId,
      teamId: o.teamId,
      name: o.name,
      leagueName: o.leagueName,
      defenseSystems: o.defenseSystems,
      attackSystems: o.attackSystems,
      transitionNotes: o.transitionNotes,
      strengths: o.strengths,
      weaknesses: o.weaknesses,
      generalNotes: o.generalNotes,
      keyPlayers: o.keyPlayers.map(mapOpponentPlayer),
      scoutingNotes: o.scoutingNotes.map(mapNote),
      updatedAt: o.updatedAt.toISOString(),
    };
  }

  async createOpponent(
    clubId: string,
    teamId: string,
    input: CreateOpponentInput
  ): Promise<OpponentDTO> {
    const o = await prisma.opponent.create({
      data: {
        clubId,
        teamId,
        name: input.name,
        leagueName: input.leagueName ?? null,
        defenseSystems: input.defenseSystems,
        attackSystems: input.attackSystems,
        transitionNotes: input.transitionNotes ?? null,
        strengths: input.strengths ?? null,
        weaknesses: input.weaknesses ?? null,
        generalNotes: input.generalNotes ?? null,
      },
    });
    return {
      id: o.id,
      clubId: o.clubId,
      teamId: o.teamId,
      name: o.name,
      leagueName: o.leagueName,
      defenseSystems: o.defenseSystems,
      attackSystems: o.attackSystems,
      transitionNotes: o.transitionNotes,
      strengths: o.strengths,
      weaknesses: o.weaknesses,
      generalNotes: o.generalNotes,
      keyPlayers: [],
      scoutingNotes: [],
      updatedAt: o.updatedAt.toISOString(),
    };
  }

  async updateOpponent(
    opponentId: string,
    input: UpdateOpponentInput
  ): Promise<OpponentDTO> {
    await prisma.opponent.update({
      where: { id: opponentId },
      data: input,
    });
    const refreshed = await this.findOpponentById(opponentId, false);
    return refreshed!;
  }

  async deleteOpponent(opponentId: string): Promise<void> {
    await prisma.opponent.delete({ where: { id: opponentId } });
  }

  async addOpponentPlayer(
    opponentId: string,
    input: CreateOpponentPlayerInput
  ): Promise<OpponentPlayerDTO> {
    const p = await prisma.opponentPlayer.create({
      data: {
        opponentId,
        name: input.name,
        jerseyNumber: input.jerseyNumber ?? null,
        position: input.position ?? null,
        throwingHand: input.throwingHand ?? null,
        shotZones: input.shotZones,
        feintPreference: input.feintPreference ?? null,
        isSevenMeterShooter: input.isSevenMeterShooter,
        threatLevel: input.threatLevel,
        notes: input.notes ?? null,
      },
    });
    return mapOpponentPlayer(p);
  }

  async deleteOpponentPlayer(playerId: string): Promise<void> {
    await prisma.opponentPlayer.delete({ where: { id: playerId } });
  }

  async findOpponentPlayerById(playerId: string) {
    const p = await prisma.opponentPlayer.findUnique({
      where: { id: playerId },
      include: { opponent: { select: { teamId: true, clubId: true } } },
    });
    if (!p) return null;
    return {
      id: p.id,
      opponentId: p.opponentId,
      teamId: p.opponent.teamId,
      clubId: p.opponent.clubId,
    };
  }

  async listNotesByTeam(
    teamId: string,
    onlyShared: boolean,
    eventId?: string
  ): Promise<ScoutingNoteDTO[]> {
    const rows = await prisma.scoutingNote.findMany({
      where: {
        teamId,
        ...(onlyShared ? { isSharedWithTeam: true } : {}),
        ...(eventId ? { eventId } : {}),
      },
      include: {
        opponent: { select: { name: true } },
        event: { select: { title: true } },
        tacticPlay: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapNote);
  }

  async findNoteById(noteId: string): Promise<ScoutingNoteDTO | null> {
    const row = await prisma.scoutingNote.findUnique({
      where: { id: noteId },
      include: {
        opponent: { select: { name: true } },
        event: { select: { title: true } },
        tacticPlay: { select: { title: true } },
      },
    });
    return row ? mapNote(row) : null;
  }

  async createNote(
    clubId: string,
    teamId: string,
    userId: string,
    input: CreateScoutingNoteInput
  ): Promise<ScoutingNoteDTO> {
    const row = await prisma.scoutingNote.create({
      data: {
        clubId,
        teamId,
        opponentId: input.opponentId,
        eventId: input.eventId ?? null,
        tacticPlayId: input.tacticPlayId ?? null,
        createdByUserId: userId,
        title: input.title,
        content: input.content,
        videoUrl: input.videoUrl ?? null,
        isSharedWithTeam: input.isSharedWithTeam,
      },
      include: {
        opponent: { select: { name: true } },
        event: { select: { title: true } },
        tacticPlay: { select: { title: true } },
      },
    });
    return mapNote(row);
  }

  async updateNote(
    noteId: string,
    input: UpdateScoutingNoteInput
  ): Promise<ScoutingNoteDTO> {
    const row = await prisma.scoutingNote.update({
      where: { id: noteId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl } : {}),
        ...(input.eventId !== undefined ? { eventId: input.eventId } : {}),
        ...(input.tacticPlayId !== undefined
          ? { tacticPlayId: input.tacticPlayId }
          : {}),
        ...(input.isSharedWithTeam !== undefined
          ? { isSharedWithTeam: input.isSharedWithTeam }
          : {}),
      },
      include: {
        opponent: { select: { name: true } },
        event: { select: { title: true } },
        tacticPlay: { select: { title: true } },
      },
    });
    return mapNote(row);
  }

  async deleteNote(noteId: string): Promise<void> {
    await prisma.scoutingNote.delete({ where: { id: noteId } });
  }
}
