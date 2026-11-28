import { LeagueProviderRegistry } from "@/domain/adapters/league-data-provider";
import { CarpoolService } from "@/domain/services/carpool-service";
import { CashboxService } from "@/domain/services/cashbox-service";
import { ClubService } from "@/domain/services/club-service";
import { CommunityService } from "@/domain/services/community-service";
import { DutyService } from "@/domain/services/duty-service";
import { EventService } from "@/domain/services/event-service";
import { GuardianService } from "@/domain/services/guardian-service";
import { InviteService } from "@/domain/services/invite-service";
import { JerseySetService } from "@/domain/services/jersey-set-service";
import { LeagueCatalogService } from "@/domain/services/league-catalog-service";
import { LeagueDirectoryService } from "@/domain/services/league-directory-service";
import { LeagueSyncService } from "@/domain/services/league-sync-service";
import {
  createDefaultNuligaSessionFetch,
  NuligaClubLogoTarget,
  resolveNuligaClubLogo,
} from "@/domain/services/nuliga-club-logo";
import { NuligaProviderAdapter } from "@/domain/services/nuliga-provider-adapter";
import { OnboardingService } from "@/domain/services/onboarding-service";
import { RosterService } from "@/domain/services/roster-service";
import { ScoutingService } from "@/domain/services/scouting-service";
import { SeasonCatalogService } from "@/domain/services/season-catalog-service";
import { TacticService } from "@/domain/services/tactic-service";
import { TrainingService } from "@/domain/services/training-service";
import { VenueService } from "@/domain/services/venue-service";
import {
  PrismaEventRepository,
  PrismaVenueRepository,
} from "../repositories/prisma-event-repositories";
import { PrismaJerseySetRepository } from "../repositories/prisma-jersey-set-repository";
import { PrismaLeagueCatalogRepository } from "../repositories/prisma-league-catalog-repository";
import { PrismaLeagueDirectoryRepository } from "../repositories/prisma-league-directory-repository";
import {
  PrismaCarpoolRepository,
  PrismaLeagueSyncRepository,
} from "../repositories/prisma-league-repositories";
import {
  PrismaDutyRepository,
  PrismaTrainingRepository,
} from "../repositories/prisma-m3-repositories";
import {
  PrismaScoutingRepository,
  PrismaTacticRepository,
} from "../repositories/prisma-m4-repositories";
import {
  PrismaCashboxRepository,
  PrismaCommunityRepository,
} from "../repositories/prisma-m5-repositories";
import {
  PrismaClubRepository,
  PrismaGuardianRepository,
  PrismaInviteRepository,
  PrismaMemberRepository,
  PrismaTeamRepository,
  PrismaUserLookupRepository,
} from "../repositories/prisma-repositories";
import { PrismaSeasonCatalogRepository } from "../repositories/prisma-season-catalog-repository";

const clubRepo = new PrismaClubRepository();
const teamRepo = new PrismaTeamRepository();
const memberRepo = new PrismaMemberRepository();
const inviteRepo = new PrismaInviteRepository();
const guardianRepo = new PrismaGuardianRepository();
const userLookupRepo = new PrismaUserLookupRepository();
const venueRepo = new PrismaVenueRepository();
const jerseySetRepo = new PrismaJerseySetRepository();
const eventRepo = new PrismaEventRepository();
const leagueCatalogRepo = new PrismaLeagueCatalogRepository();
const seasonCatalogRepo = new PrismaSeasonCatalogRepository();
const leagueDirectoryRepo = new PrismaLeagueDirectoryRepository();
const leagueSyncRepo = new PrismaLeagueSyncRepository();
const carpoolRepo = new PrismaCarpoolRepository();
const dutyRepo = new PrismaDutyRepository();
const trainingRepo = new PrismaTrainingRepository();
const tacticRepo = new PrismaTacticRepository();
const scoutingRepo = new PrismaScoutingRepository();
const communityRepo = new PrismaCommunityRepository();
const cashboxRepo = new PrismaCashboxRepository();

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/calendar, text/plain, */*" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Abruf der Liga-Quelle fehlgeschlagen (HTTP ${res.status}).`);
  }
  return res.text();
}

const nuligaSessionFetch = createDefaultNuligaSessionFetch();
const fetchNuligaClubLogo = (target: NuligaClubLogoTarget) =>
  resolveNuligaClubLogo(nuligaSessionFetch, target);

const leagueProviderRegistry = new LeagueProviderRegistry();
leagueProviderRegistry.register(new NuligaProviderAdapter(fetchUrlText));

const leagueSyncService = new LeagueSyncService(
  teamRepo,
  leagueSyncRepo,
  fetchUrlText,
  leagueDirectoryRepo,
  leagueProviderRegistry
);

let clubServiceRef: ClubService | null = null;

const leagueDirectoryService = new LeagueDirectoryService(
  leagueDirectoryRepo,
  teamRepo,
  leagueSyncRepo,
  leagueSyncService,
  scoutingRepo,
  fetchUrlText,
  (clubId, hints) =>
    clubServiceRef
      ? clubServiceRef.tryAutoImportClubLogoInternal(clubId, hints)
      : Promise.resolve(null),
  leagueProviderRegistry
);

const clubService = new ClubService(
  clubRepo,
  teamRepo,
  leagueCatalogRepo,
  leagueDirectoryService,
  memberRepo,
  seasonCatalogRepo,
  fetchNuligaClubLogo
);
clubServiceRef = clubService;

export const services = {
  onboarding: new OnboardingService(
    clubRepo,
    teamRepo,
    memberRepo,
    leagueCatalogRepo,
    seasonCatalogRepo,
    leagueDirectoryService,
    fetchNuligaClubLogo
  ),
  club: clubService,
  leagueCatalog: new LeagueCatalogService(leagueCatalogRepo),
  seasonCatalog: new SeasonCatalogService(seasonCatalogRepo),
  leagueDirectory: leagueDirectoryService,
  roster: new RosterService(
    teamRepo,
    memberRepo,
    leagueDirectoryRepo,
    leagueSyncRepo,
    fetchUrlText
  ),
  invite: new InviteService(teamRepo, memberRepo, inviteRepo, guardianRepo),
  guardian: new GuardianService(
    teamRepo,
    memberRepo,
    guardianRepo,
    userLookupRepo
  ),
  venue: new VenueService(venueRepo),
  jerseySet: new JerseySetService(jerseySetRepo, teamRepo),
  event: new EventService(
    teamRepo,
    memberRepo,
    venueRepo,
    eventRepo,
    jerseySetRepo
  ),
  leagueSync: leagueSyncService,
  carpool: new CarpoolService(eventRepo, memberRepo, carpoolRepo),
  duty: new DutyService(teamRepo, memberRepo, dutyRepo, jerseySetRepo),
  training: new TrainingService(teamRepo, trainingRepo),
  tactics: new TacticService(teamRepo, tacticRepo),
  scouting: new ScoutingService(
    teamRepo,
    scoutingRepo,
    leagueDirectoryRepo,
    fetchUrlText
  ),
  community: new CommunityService(teamRepo, communityRepo),
  cashbox: new CashboxService(teamRepo, cashboxRepo),
};
