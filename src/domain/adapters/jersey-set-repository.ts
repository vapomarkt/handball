import {
  CreateJerseySetInput,
  JerseySetDTO,
  UpdateJerseySetInput,
} from "../schemas/jersey-set";

export interface JerseySetRepository {
  findByClubId(
    clubId: string,
    filter?: { teamId?: string }
  ): Promise<JerseySetDTO[]>;
  findById(jerseySetId: string): Promise<JerseySetDTO | null>;
  create(clubId: string, input: CreateJerseySetInput): Promise<JerseySetDTO>;
  update(
    jerseySetId: string,
    input: UpdateJerseySetInput
  ): Promise<JerseySetDTO>;
  delete(jerseySetId: string): Promise<void>;
}
