import { describe, expect, it, vi } from "vitest";
import type {
  ScoutingRepository,
  TacticRepository,
} from "@/domain/adapters/m4-repositories";
import type { TeamRecord, TeamRepository } from "@/domain/adapters/repositories";
import type { ViewerContext } from "@/domain/policies/rbac";
import type { OpponentDTO, ScoutingNoteDTO } from "@/domain/schemas/scouting";
import type { TacticKeyframe, TacticPlayDTO } from "@/domain/schemas/tactic";
import { ScoutingService } from "@/domain/services/scouting-service";
import {
  createFormationPreset,
  interpolateKeyframeTokens,
} from "@/domain/services/tactic-presets";
import { TacticService } from "@/domain/services/tactic-service";

const TEAM: TeamRecord = {
  id: "team-h1",
  clubId: "club-1",
  seasonId: "season-1",
  name: "Herren 1",
  category: "Erwachsene",
  gender: "MALE",
  leagueName: "Bezirksoberliga",
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

function makePlay(overrides: Partial<TacticPlayDTO> = {}): TacticPlayDTO {
  const preset = createFormationPreset("6_0");
  return {
    id: "play-1",
    clubId: "club-1",
    teamId: "team-h1",
    title: "Kreuzung Mitte-Links",
    description: "Standard-Auslösehandlung",
    category: "TRIGGER_PLAY",
    courtMode: preset.courtMode,
    boardData: preset.boardData,
    tags: ["6:0-Auflösung"],
    isSharedWithTeam: true,
    createdAt: "2026-11-24T10:00:00.000Z",
    updatedAt: "2026-11-24T10:00:00.000Z",
    ...overrides,
  };
}

function makeTeamRepo(): TeamRepository {
  return {
    findById: vi.fn().mockResolvedValue(TEAM),
    findByClubId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

describe("M4 Taktik-Presets & Keyframe-Interpolation", () => {
  it("erzeugt valide Handball-Formationen für 6:0, 5:1, 3:2:1, 7-gegen-6 und 1. Welle", () => {
    const p60 = createFormationPreset("6_0");
    expect(p60.courtMode).toBe("HALF_COURT");
    expect(p60.boardData.keyframes).toHaveLength(1);
    expect(
      p60.boardData.keyframes[0].tokens.filter((t) => t.kind === "DEFENDER")
    ).toHaveLength(6);

    const p51 = createFormationPreset("5_1");
    expect(
      p51.boardData.keyframes[0].tokens.some(
        (t) => t.kind === "DEFENDER" && t.label === "V"
      )
    ).toBe(true);

    const p321 = createFormationPreset("3_2_1");
    expect(
      p321.boardData.keyframes[0].tokens.some(
        (t) => t.kind === "DEFENDER" && t.label === "HM"
      )
    ).toBe(true);

    const p76 = createFormationPreset("7_6");
    expect(
      p76.boardData.keyframes[0].tokens.filter((t) => t.kind === "ATTACKER")
    ).toHaveLength(7);

    const pFast = createFormationPreset("FAST_BREAK");
    expect(pFast.courtMode).toBe("FULL_COURT");
    expect(pFast.boardData.keyframes[0].drawings.length).toBeGreaterThanOrEqual(
      2
    );
  });

  it("interpoliert Token-Koordinaten sanft bei t=0, t=0.5 und t=1.0", () => {
    const fromFrame: TacticKeyframe = {
      id: "kf-1",
      label: "Start",
      notes: "",
      durationMs: 1000,
      tokens: [
        { id: "rm", kind: "ATTACKER", label: "RM", x: 100, y: 200 },
        { id: "ball", kind: "BALL", label: "", x: 100, y: 200 },
      ],
      drawings: [],
    };
    const toFrame: TacticKeyframe = {
      id: "kf-2",
      label: "Ziel",
      notes: "",
      durationMs: 1000,
      tokens: [
        { id: "rm", kind: "ATTACKER", label: "RM", x: 500, y: 600 },
        { id: "ball", kind: "BALL", label: "", x: 300, y: 400 },
      ],
      drawings: [],
    };

    const atStart = interpolateKeyframeTokens(fromFrame, toFrame, 0);
    expect(atStart[0]).toMatchObject({ id: "rm", x: 100, y: 200 });

    const atMid = interpolateKeyframeTokens(fromFrame, toFrame, 0.5);
    expect(atMid[0]).toMatchObject({ id: "rm", x: 300, y: 400 });
    expect(atMid[1]).toMatchObject({ id: "ball", x: 200, y: 300 });

    const atEnd = interpolateKeyframeTokens(fromFrame, toFrame, 1);
    expect(atEnd[0]).toMatchObject({ id: "rm", x: 500, y: 600 });
    expect(atEnd[1]).toMatchObject({ id: "ball", x: 300, y: 400 });
  });
});

describe("M4 TacticService – RBAC & Team-Freigabe", () => {
  it("filtert für PLAYER auf isSharedWithTeam=true und erlaubt COACH alle Entwürfe", async () => {
    const listByTeam = vi.fn().mockResolvedValue([makePlay()]);
    const tacticRepo: TacticRepository = {
      listByTeam,
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const service = new TacticService(makeTeamRepo(), tacticRepo);

    await service.listPlays(PLAYER_VIEWER, "team-h1");
    expect(listByTeam).toHaveBeenLastCalledWith("team-h1", true);

    await service.listPlays(COACH_VIEWER, "team-h1");
    expect(listByTeam).toHaveBeenLastCalledWith("team-h1", false);
  });

  it("verweigert PLAYER den Direktzugriff auf nicht freigegebene Trainer-Entwürfe (403)", async () => {
    const draftPlay = makePlay({ id: "play-draft", isSharedWithTeam: false });
    const tacticRepo: TacticRepository = {
      listByTeam: vi.fn(),
      findById: vi.fn().mockResolvedValue(draftPlay),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const service = new TacticService(makeTeamRepo(), tacticRepo);

    await expect(
      service.getPlay(PLAYER_VIEWER, "team-h1", "play-draft")
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      httpStatus: 403,
    });

    const coachView = await service.getPlay(
      COACH_VIEWER,
      "team-h1",
      "play-draft"
    );
    expect(coachView.id).toBe("play-draft");
  });

  it("verweigert PLAYER Schreiboperationen auf dem Playbook (403)", async () => {
    const play = makePlay();
    const tacticRepo: TacticRepository = {
      listByTeam: vi.fn(),
      findById: vi.fn().mockResolvedValue(play),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const service = new TacticService(makeTeamRepo(), tacticRepo);

    await expect(
      service.createPlay(PLAYER_VIEWER, "team-h1", {
        title: "Test",
        category: "ATTACK",
        courtMode: "HALF_COURT",
        boardData: play.boardData,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    await expect(
      service.updatePlay(PLAYER_VIEWER, "team-h1", "play-1", {
        title: "Neu",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    await expect(
      service.deletePlay(PLAYER_VIEWER, "team-h1", "play-1")
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });
});

describe("M4 ScoutingService – RBAC & Notiz-Sichtbarkeit", () => {
  it("filtert Gegner-Dossiers und Scouting-Notizen für PLAYER auf freigegebene Notizen", async () => {
    const opp: OpponentDTO = {
      id: "opp-1",
      clubId: "club-1",
      teamId: "team-h1",
      name: "SG Neustadt",
      leagueName: "Bezirksoberliga",
      defenseSystems: ["6:0 kompakt"],
      attackSystems: ["Kreuzung"],
      strengths: "Stark im Gegenstoß",
      weaknesses: "Lücken auf Halb-Links",
      transitionNotes: null,
      generalNotes: null,
      keyPlayers: [],
      scoutingNotes: [],
      updatedAt: "2026-11-24T10:00:00.000Z",
    };
    const note: ScoutingNoteDTO = {
      id: "note-1",
      clubId: "club-1",
      teamId: "team-h1",
      opponentId: "opp-1",
      opponentName: "SG Neustadt",
      eventId: null,
      eventTitle: null,
      tacticPlayId: null,
      tacticPlayTitle: null,
      title: "Matchplan",
      content: "Kompakt stehen",
      videoUrl: null,
      isSharedWithTeam: true,
      createdAt: "2026-11-24T10:00:00.000Z",
      updatedAt: "2026-11-24T10:00:00.000Z",
    };

    const listOpponentsByTeam = vi.fn().mockResolvedValue([opp]);
    const listNotesByTeam = vi.fn().mockResolvedValue([note]);
    const scoutingRepo: ScoutingRepository = {
      listOpponentsByTeam,
      findOpponentById: vi.fn().mockResolvedValue(opp),
      createOpponent: vi.fn(),
      updateOpponent: vi.fn(),
      deleteOpponent: vi.fn(),
      addOpponentPlayer: vi.fn(),
      findOpponentPlayerById: vi.fn(),
      deleteOpponentPlayer: vi.fn(),
      listNotesByTeam,
      findNoteById: vi.fn().mockResolvedValue(note),
      createNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
    };

    const service = new ScoutingService(makeTeamRepo(), scoutingRepo);

    await service.listOpponents(PLAYER_VIEWER, "team-h1");
    expect(listOpponentsByTeam).toHaveBeenLastCalledWith("team-h1", true);

    await service.listOpponents(COACH_VIEWER, "team-h1");
    expect(listOpponentsByTeam).toHaveBeenLastCalledWith("team-h1", false);

    await service.listScoutingNotes(PLAYER_VIEWER, "team-h1");
    expect(listNotesByTeam).toHaveBeenLastCalledWith("team-h1", true, undefined);

    await service.listScoutingNotes(COACH_VIEWER, "team-h1");
    expect(listNotesByTeam).toHaveBeenLastCalledWith(
      "team-h1",
      false,
      undefined
    );

    // PLAYER darf keine Gegner, Schlüsselspieler oder Scouting-Notizen anlegen
    await expect(
      service.createOpponent(PLAYER_VIEWER, "team-h1", { name: "TV Test" })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    await expect(
      service.addKeyPlayer(PLAYER_VIEWER, "team-h1", "opp-1", {
        name: "Max",
        threatLevel: "HIGH",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    await expect(
      service.createScoutingNote(PLAYER_VIEWER, "team-h1", {
        opponentId: "opp-1",
        title: "Notiz",
        content: "Inhalt",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });
});
