import type {
  CashEntryStatus,
  CreateAnnouncementInput,
  CreateCashEntryInput,
  CreateFineCatalogItemInput,
  CreatePollInput,
  FineCatalogItemDTO,
  TeamAnnouncementDTO,
  TeamCashEntryDTO,
  TeamPollDTO,
  UpdateAnnouncementInput,
} from "../schemas/community";

export interface CommunityRepository {
  listAnnouncementsByTeam(
    teamId: string,
    includeStaffOnly: boolean
  ): Promise<TeamAnnouncementDTO[]>;
  findAnnouncementById(id: string): Promise<TeamAnnouncementDTO | null>;
  createAnnouncement(
    clubId: string,
    teamId: string,
    authorUserId: string,
    authorName: string,
    input: CreateAnnouncementInput
  ): Promise<TeamAnnouncementDTO>;
  updateAnnouncement(
    id: string,
    input: UpdateAnnouncementInput
  ): Promise<TeamAnnouncementDTO>;
  deleteAnnouncement(id: string): Promise<void>;

  listPollsByTeam(teamId: string, viewerUserId: string): Promise<TeamPollDTO[]>;
  findPollById(id: string, viewerUserId: string): Promise<TeamPollDTO | null>;
  createPoll(
    clubId: string,
    teamId: string,
    createdByUserId: string,
    createdByName: string,
    input: CreatePollInput
  ): Promise<TeamPollDTO>;
  toggleVote(
    pollId: string,
    optionId: string,
    userId: string,
    voterName: string,
    allowMultiple: boolean
  ): Promise<TeamPollDTO>;
  deletePoll(id: string): Promise<void>;
}

export interface CashboxRepository {
  listEntriesByTeam(teamId: string): Promise<TeamCashEntryDTO[]>;
  findEntryById(id: string): Promise<TeamCashEntryDTO | null>;
  createEntry(
    clubId: string,
    teamId: string,
    createdByUserId: string,
    input: CreateCashEntryInput & { status: CashEntryStatus }
  ): Promise<TeamCashEntryDTO>;
  updateEntryStatus(
    id: string,
    status: CashEntryStatus
  ): Promise<TeamCashEntryDTO>;
  deleteEntry(id: string): Promise<void>;

  listCatalogByTeam(teamId: string): Promise<FineCatalogItemDTO[]>;
  createCatalogItem(
    clubId: string,
    teamId: string,
    input: CreateFineCatalogItemInput
  ): Promise<FineCatalogItemDTO>;
  deleteCatalogItem(id: string, teamId: string): Promise<boolean>;

  isUserTreasurerInTeam(userId: string, teamId: string): Promise<boolean>;
}
