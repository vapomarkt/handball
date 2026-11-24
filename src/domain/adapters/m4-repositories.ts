import {
  CreateOpponentInput,
  CreateOpponentPlayerInput,
  CreateScoutingNoteInput,
  OpponentDTO,
  OpponentPlayerDTO,
  ScoutingNoteDTO,
  UpdateOpponentInput,
  UpdateScoutingNoteInput,
} from "../schemas/scouting";
import {
  CreateTacticPlayInput,
  TacticPlayDTO,
  UpdateTacticPlayInput,
} from "../schemas/tactic";

export interface TacticRepository {
  listByTeam(teamId: string, onlyShared: boolean): Promise<TacticPlayDTO[]>;
  findById(playId: string): Promise<TacticPlayDTO | null>;
  create(
    clubId: string,
    teamId: string,
    userId: string,
    input: CreateTacticPlayInput
  ): Promise<TacticPlayDTO>;
  update(playId: string, input: UpdateTacticPlayInput): Promise<TacticPlayDTO>;
  delete(playId: string): Promise<void>;
}

export interface ScoutingRepository {
  listOpponentsByTeam(
    teamId: string,
    onlySharedNotes: boolean
  ): Promise<OpponentDTO[]>;
  findOpponentById(
    opponentId: string,
    onlySharedNotes: boolean
  ): Promise<OpponentDTO | null>;
  createOpponent(
    clubId: string,
    teamId: string,
    input: CreateOpponentInput
  ): Promise<OpponentDTO>;
  updateOpponent(
    opponentId: string,
    input: UpdateOpponentInput
  ): Promise<OpponentDTO>;
  deleteOpponent(opponentId: string): Promise<void>;

  addOpponentPlayer(
    opponentId: string,
    input: CreateOpponentPlayerInput
  ): Promise<OpponentPlayerDTO>;
  deleteOpponentPlayer(playerId: string): Promise<void>;
  findOpponentPlayerById(playerId: string): Promise<{
    id: string;
    opponentId: string;
    teamId: string;
    clubId: string;
  } | null>;

  listNotesByTeam(
    teamId: string,
    onlyShared: boolean,
    eventId?: string
  ): Promise<ScoutingNoteDTO[]>;
  findNoteById(noteId: string): Promise<ScoutingNoteDTO | null>;
  createNote(
    clubId: string,
    teamId: string,
    userId: string,
    input: CreateScoutingNoteInput
  ): Promise<ScoutingNoteDTO>;
  updateNote(
    noteId: string,
    input: UpdateScoutingNoteInput
  ): Promise<ScoutingNoteDTO>;
  deleteNote(noteId: string): Promise<void>;
}
