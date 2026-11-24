import { CarpoolService } from "@/domain/services/carpool-service";
import { CashboxService } from "@/domain/services/cashbox-service";
import { ClubService } from "@/domain/services/club-service";
import { CommunityService } from "@/domain/services/community-service";
import { DutyService } from "@/domain/services/duty-service";
import { EventService } from "@/domain/services/event-service";
import { GuardianService } from "@/domain/services/guardian-service";
import { InviteService } from "@/domain/services/invite-service";
import { LeagueSyncService } from "@/domain/services/league-sync-service";
import { OnboardingService } from "@/domain/services/onboarding-service";
import { RosterService } from "@/domain/services/roster-service";
import { ScoutingService } from "@/domain/services/scouting-service";
import { TacticService } from "@/domain/services/tactic-service";
import { TrainingService } from "@/domain/services/training-service";
import { VenueService } from "@/domain/services/venue-service";
import {
  PrismaEventRepository,
  PrismaVenueRepository,
} from "../repositories/prisma-event-repositories";
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

const clubRepo = new PrismaClubRepository();
const teamRepo = new PrismaTeamRepository();
const memberRepo = new PrismaMemberRepository();
const inviteRepo = new PrismaInviteRepository();
const guardianRepo = new PrismaGuardianRepository();
const userLookupRepo = new PrismaUserLookupRepository();
const venueRepo = new PrismaVenueRepository();
const eventRepo = new PrismaEventRepository();
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

export const services = {
  onboarding: new OnboardingService(clubRepo, teamRepo, memberRepo),
  club: new ClubService(clubRepo, teamRepo),
  roster: new RosterService(teamRepo, memberRepo),
  invite: new InviteService(teamRepo, memberRepo, inviteRepo, guardianRepo),
  guardian: new GuardianService(
    teamRepo,
    memberRepo,
    guardianRepo,
    userLookupRepo
  ),
  venue: new VenueService(venueRepo),
  event: new EventService(teamRepo, memberRepo, venueRepo, eventRepo),
  leagueSync: new LeagueSyncService(teamRepo, leagueSyncRepo, fetchUrlText),
  carpool: new CarpoolService(eventRepo, memberRepo, carpoolRepo),
  duty: new DutyService(teamRepo, memberRepo, dutyRepo),
  training: new TrainingService(teamRepo, trainingRepo),
  tactics: new TacticService(teamRepo, tacticRepo),
  scouting: new ScoutingService(teamRepo, scoutingRepo),
  community: new CommunityService(teamRepo, communityRepo),
  cashbox: new CashboxService(teamRepo, cashboxRepo),
};
