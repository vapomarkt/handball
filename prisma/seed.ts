import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AvailabilityStatus,
  CourtMode,
  DeclineReasonCategory,
  DutyAssignmentStatus,
  DutyCategory,
  DutyScope,
  EventType,
  HandballPosition,
  InviteType,
  JerseyCondition,
  LeagueAgeGroup,
  LeagueProviderType,
  MemberRole,
  PrismaClient,
  ResinPolicy,
  RsvpStatus,
  SyncChangeType,
  SyncStatus,
  TacticCategory,
  TeamGender,
  ThreatLevel,
  ThrowingHand,
  TrainingPhaseType,
} from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { Pool } from "pg";
import { importHvnbDirectory } from "./import-hvnb-directory";
import { importGermanLeagues } from "./import-leagues-de";
import { importDefaultSeasons } from "./import-seasons";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error(
    "Keine Datenbank-URL gefunden (DATABASE_URL / POSTGRES_PRISMA_URL / POSTGRES_URL)."
  );
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "ThrowOff2026!";

const NULIGA_MJD_ICAL_URL =
  "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/getTeamMeetingsWebcal?teamid=1762852&token=SqIaa%2F8DKoU%3D";

async function upsertDemoUser(params: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}) {
  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: { name: params.name },
    create: {
      id: params.id,
      email: params.email,
      name: params.name,
      emailVerified: true,
    },
  });

  const existingAccount = await prisma.account.findFirst({
    where: {
      userId: user.id,
      providerId: "credential",
    },
  });

  if (!existingAccount) {
    await prisma.account.create({
      data: {
        id: `acc-${params.id}`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: params.passwordHash,
      },
    });
  }

  // Demo-Konten haben Tour/Onboarding bereits abgeschlossen, damit E2E-Flows nicht unterbrochen werden
  await prisma.userOnboardingState.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      tourDisabled: true,
      profilePromptDismissed: true,
      passkeyPromptDismissed: true,
      onboardingCompletedAt: new Date(),
    },
  });

  return user;
}

async function upsertTeamMember(params: {
  id: string;
  clubId: string;
  teamId: string;
  userId?: string | null;
  role: MemberRole;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  jerseyNumber?: number | null;
  primaryPosition?: HandballPosition | null;
  secondaryPosition?: HandballPosition | null;
  throwingHand?: ThrowingHand | null;
  availabilityStatus?: AvailabilityStatus;
  teamRoles?: string[];
  isMinor?: boolean;
  passNumber?: string | null;
  injuryNote?: string | null;
  emergencyContact?: string | null;
}) {
  return prisma.teamMember.upsert({
    where: { id: params.id },
    update: {
      userId: params.userId ?? null,
      role: params.role,
      firstName: params.firstName,
      lastName: params.lastName,
      jerseyNumber: params.jerseyNumber ?? null,
      primaryPosition: params.primaryPosition ?? null,
      secondaryPosition: params.secondaryPosition ?? null,
      throwingHand: params.throwingHand ?? null,
      availabilityStatus: params.availabilityStatus ?? "FIT",
      teamRoles: params.teamRoles ?? [],
      isMinor: params.isMinor ?? false,
      passNumber: params.passNumber ?? null,
      injuryNote: params.injuryNote ?? null,
      emergencyContact: params.emergencyContact ?? null,
      email: params.email ?? null,
      phone: params.phone ?? null,
    },
    create: {
      id: params.id,
      clubId: params.clubId,
      teamId: params.teamId,
      userId: params.userId ?? null,
      role: params.role,
      firstName: params.firstName,
      lastName: params.lastName,
      jerseyNumber: params.jerseyNumber ?? null,
      primaryPosition: params.primaryPosition ?? null,
      secondaryPosition: params.secondaryPosition ?? null,
      throwingHand: params.throwingHand ?? null,
      availabilityStatus: params.availabilityStatus ?? "FIT",
      teamRoles: params.teamRoles ?? [],
      isMinor: params.isMinor ?? false,
      passNumber: params.passNumber ?? null,
      injuryNote: params.injuryNote ?? null,
      emergencyContact: params.emergencyContact ?? null,
      email: params.email ?? null,
      phone: params.phone ?? null,
    },
  });
}

async function main() {
  console.log(
    "Starte idempotentes Seeding für TuS Jahn Hollenstedt (männliche D-Jugend, nuLiga-Kader)..."
  );

  // 0. Deutschen Liga-Katalog (DHB & alle Landesverbände) und Saison-Katalog synchronisieren
  const leagueImportResult = await importGermanLeagues(prisma);
  console.log(
    `Liga-Katalog Deutschland synchronisiert: ${leagueImportResult.total} Ligen (${leagueImportResult.federationCount} Verbände).`
  );
  const seasonImportResult = await importDefaultSeasons(prisma);
  console.log(
    `Saison-Katalog synchronisiert: ${seasonImportResult.created} neu angelegt (${seasonImportResult.total} Standardsaisons geprüft).`
  );

  // 0b. HVNB-Staffel- und Mannschaftsverzeichnis (Niedersachsen/Bremen) synchronisieren
  const hvnbDirResult = await importHvnbDirectory(prisma);
  console.log(
    `HVNB-Verzeichnis synchronisiert: ${hvnbDirResult.groupsUpserted} Staffeln, ${hvnbDirResult.teamsUpserted} Mannschaften.`
  );

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // 1. Demo-Benutzerkonten (TuS Jahn Hollenstedt – basierend auf nuLiga-Offiziellen & Kader)
  const adminUser = await upsertDemoUser({
    id: "user-tjh-admin",
    email: "admin@tus-jahn-hollenstedt.de",
    name: "Kay Kröpfl",
    passwordHash,
  });

  const coachUser = await upsertDemoUser({
    id: "user-tjh-coach",
    email: "trainer@tus-jahn-hollenstedt.de",
    name: "Hans-Peter Lehmann",
    passwordHash,
  });

  const playerUser = await upsertDemoUser({
    id: "user-tjh-player",
    email: "spieler@tus-jahn-hollenstedt.de",
    name: "Jarle Hofmann",
    passwordHash,
  });

  const parentUser = await upsertDemoUser({
    id: "user-tjh-parent",
    email: "eltern@tus-jahn-hollenstedt.de",
    name: "Familie Hofmann",
    passwordHash,
  });

  const managerUser = await upsertDemoUser({
    id: "user-tjh-manager",
    email: "betreuer@tus-jahn-hollenstedt.de",
    name: "Petra Brandt",
    passwordHash,
  });

  // 2. Verein: TuS Jahn Hollenstedt (inkl. Vereinswappen)
  const club = await prisma.club.upsert({
    where: { slug: "tus-jahn-hollenstedt" },
    update: {
      name: "TuS Jahn Hollenstedt",
      shortName: "TuS Jahn",
      city: "Hollenstedt",
      logoUrl: "/clubs/tus-jahn-hollenstedt.png",
    },
    create: {
      id: "club-tus-jahn-hollenstedt",
      name: "TuS Jahn Hollenstedt",
      shortName: "TuS Jahn",
      slug: "tus-jahn-hollenstedt",
      city: "Hollenstedt",
      logoUrl: "/clubs/tus-jahn-hollenstedt.png",
    },
  });

  // 3. Saison 2026/27
  const season = await prisma.season.upsert({
    where: {
      clubId_name: {
        clubId: club.id,
        name: "2026/27",
      },
    },
    update: { isActive: true },
    create: {
      id: "season-tjh-2026-27",
      clubId: club.id,
      name: "2026/27",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2027-06-30T23:59:59.000Z"),
      isActive: true,
    },
  });

  // 4. Mannschaften: männliche D-Jugend (Haupt-Demo-Team), 1. Herren, 1. Damen
  const mjdTeam = await prisma.team.upsert({
    where: {
      clubId_seasonId_name: {
        clubId: club.id,
        seasonId: season.id,
        name: "männliche D-Jugend",
      },
    },
    update: {
      category: "Jugend",
      ageGroup: LeagueAgeGroup.YOUTH_D,
      gender: TeamGender.MALE,
      usesResin: false,
      leagueName: "Regionsoberliga MJD Nord",
    },
    create: {
      id: "team-tjh-mjd",
      clubId: club.id,
      seasonId: season.id,
      name: "männliche D-Jugend",
      category: "Jugend",
      ageGroup: LeagueAgeGroup.YOUTH_D,
      gender: TeamGender.MALE,
      usesResin: false,
      leagueName: "Regionsoberliga MJD Nord",
    },
  });

  await prisma.team.upsert({
    where: {
      clubId_seasonId_name: {
        clubId: club.id,
        seasonId: season.id,
        name: "1. Herren",
      },
    },
    update: {
      category: "Aktive",
      ageGroup: LeagueAgeGroup.ADULT,
      gender: TeamGender.MALE,
      usesResin: true,
      leagueName: "Landesliga Männer",
    },
    create: {
      id: "team-tjh-herren-1",
      clubId: club.id,
      seasonId: season.id,
      name: "1. Herren",
      category: "Aktive",
      ageGroup: LeagueAgeGroup.ADULT,
      gender: TeamGender.MALE,
      usesResin: true,
      leagueName: "Landesliga Männer",
    },
  });

  await prisma.team.upsert({
    where: {
      clubId_seasonId_name: {
        clubId: club.id,
        seasonId: season.id,
        name: "1. Damen",
      },
    },
    update: {
      category: "Aktive",
      ageGroup: LeagueAgeGroup.ADULT,
      gender: TeamGender.FEMALE,
      usesResin: true,
      leagueName: "Regionalliga Nord",
    },
    create: {
      id: "team-tjh-damen-1",
      clubId: club.id,
      seasonId: season.id,
      name: "1. Damen",
      category: "Aktive",
      ageGroup: LeagueAgeGroup.ADULT,
      gender: TeamGender.FEMALE,
      usesResin: true,
      leagueName: "Regionalliga Nord",
    },
  });

  // Alte fiktive Platzhalter-Profile bereinigen, falls vorheriger Seed bereits lief
  await prisma.teamMember.deleteMany({
    where: {
      id: {
        in: [
          "member-mjd-lukas",
          "member-mjd-leo",
          "member-mjd-tim",
          "member-mjd-jonas",
          "member-mjd-finn",
          "member-mjd-max",
          "member-mjd-nico",
          "member-mjd-ben",
        ],
      },
    },
  });

  // 5. Trainerteam & Offizielle (aus den nuLiga-Spielberichten der Regionsoberliga MJD Nord)
  await upsertTeamMember({
    id: "member-mjd-admin",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: adminUser.id,
    role: MemberRole.CLUB_ADMIN,
    firstName: "Kay",
    lastName: "Kröpfl",
    email: adminUser.email,
    teamRoles: ["Offizieller B", "Vereins-Admin"],
  });

  await upsertTeamMember({
    id: "member-mjd-coach",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: coachUser.id,
    role: MemberRole.COACH,
    firstName: "Hans-Peter",
    lastName: "Lehmann",
    email: coachUser.email,
    teamRoles: ["Cheftrainer (MV)", "Offizieller A"],
  });

  await upsertTeamMember({
    id: "member-mjd-co-tjard",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.ASSISTANT_COACH,
    firstName: "Tjard",
    lastName: "Svejka",
    teamRoles: ["Co-Trainer", "Offizieller B"],
  });

  await upsertTeamMember({
    id: "member-mjd-co-samuel",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.ASSISTANT_COACH,
    firstName: "Samuel",
    lastName: "Franz",
    teamRoles: ["Co-Trainer", "Offizieller C"],
  });

  await upsertTeamMember({
    id: "member-mjd-manager",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: managerUser.id,
    role: MemberRole.TEAM_MANAGER,
    firstName: "Petra",
    lastName: "Brandt",
    email: managerUser.email,
    phone: "+49 170 5550199",
    teamRoles: ["Mannschaftsbetreuerin", "Kassenwart"],
  });

  await upsertTeamMember({
    id: "member-mjd-parent",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: parentUser.id,
    role: MemberRole.PARENT,
    firstName: "Familie",
    lastName: "Hofmann",
    email: parentUser.email,
    teamRoles: ["Elternvertretung"],
  });

  // Falls vorheriger Seed user-tjh-player einem anderen Spieler zugeordnet hatte, zuerst lösen
  await prisma.teamMember.updateMany({
    where: {
      teamId: mjdTeam.id,
      userId: playerUser.id,
      id: { not: "member-mjd-jarle-hofmann" },
    },
    data: { userId: null, email: null },
  });

  // 6. Echter Spielerkader männliche D-Jugend (aus den nuLiga-Spielberichten #4, #6 & #15)
  const fieteRuser = await upsertTeamMember({
    id: "member-mjd-fiete-ruser",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Fiete",
    lastName: "Ruser",
    jerseyNumber: 1,
    primaryPosition: HandballPosition.TW,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  await upsertTeamMember({
    id: "member-mjd-jonas-homann",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Jonas",
    lastName: "Homann",
    jerseyNumber: 2,
    primaryPosition: HandballPosition.LA,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  const tomAckermann = await upsertTeamMember({
    id: "member-mjd-tom-ackermann",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Tom",
    lastName: "Ackermann",
    jerseyNumber: 4,
    primaryPosition: HandballPosition.RM,
    secondaryPosition: HandballPosition.RL,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    teamRoles: ["7m-Schütze"],
    isMinor: true,
  });

  await upsertTeamMember({
    id: "member-mjd-erik-bruhn",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Erik",
    lastName: "Bruhn",
    jerseyNumber: 5,
    primaryPosition: HandballPosition.RL,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  await upsertTeamMember({
    id: "member-mjd-henri-berkowitz",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Henri",
    lastName: "Berkowitz",
    jerseyNumber: 6,
    primaryPosition: HandballPosition.RR,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  await upsertTeamMember({
    id: "member-mjd-hannes-kroepfl",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Hannes",
    lastName: "Kröpfl",
    jerseyNumber: 7,
    primaryPosition: HandballPosition.LA,
    secondaryPosition: HandballPosition.RM,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  await upsertTeamMember({
    id: "member-mjd-menuas-demirel",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Menuas",
    lastName: "Demirel",
    jerseyNumber: 8,
    primaryPosition: HandballPosition.KM,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  const jarleHofmann = await upsertTeamMember({
    id: "member-mjd-jarle-hofmann",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: playerUser.id,
    role: MemberRole.PLAYER,
    firstName: "Jarle",
    lastName: "Hofmann",
    email: playerUser.email,
    jerseyNumber: 9,
    primaryPosition: HandballPosition.RA,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  await upsertTeamMember({
    id: "member-mjd-tobias-barkow",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Tobias",
    lastName: "Barkow",
    jerseyNumber: 10,
    primaryPosition: HandballPosition.RM,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  const pietRuser = await upsertTeamMember({
    id: "member-mjd-piet-ruser",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Piet",
    lastName: "Ruser",
    jerseyNumber: 12,
    primaryPosition: HandballPosition.RL,
    secondaryPosition: HandballPosition.RM,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    teamRoles: ["7m-Schütze"],
    isMinor: true,
  });

  await upsertTeamMember({
    id: "member-mjd-matti-borgmann",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Matti",
    lastName: "Borgmann",
    jerseyNumber: 14,
    primaryPosition: HandballPosition.RM,
    secondaryPosition: HandballPosition.RR,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    teamRoles: ["Mannschaftskapitän"],
    isMinor: true,
  });

  await upsertTeamMember({
    id: "member-mjd-jonas-mayer",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Jonas",
    lastName: "Mayer",
    jerseyNumber: 16,
    primaryPosition: HandballPosition.KM,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  await upsertTeamMember({
    id: "member-mjd-liron-alpermann",
    clubId: club.id,
    teamId: mjdTeam.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Liron",
    lastName: "Alpermann",
    jerseyNumber: 17,
    primaryPosition: HandballPosition.RA,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
  });

  // 7. Eltern-Kind-Verknüpfung (Familie Hofmann -> Jarle Hofmann #9)
  await prisma.guardianLink.deleteMany({
    where: {
      id: { in: ["guardian-tjh-ruser-fiete", "guardian-tjh-ruser-piet"] },
    },
  });

  await prisma.guardianLink.upsert({
    where: {
      guardianUserId_childMemberId: {
        guardianUserId: parentUser.id,
        childMemberId: jarleHofmann.id,
      },
    },
    update: { relationship: "Elternteil" },
    create: {
      id: "guardian-tjh-hofmann-jarle",
      guardianUserId: parentUser.id,
      childMemberId: jarleHofmann.id,
      relationship: "Elternteil",
    },
  });

  // 8. Demo-Einladungslinks (Team-Beitritt & persönlicher Claim-Link für Tester)
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  await prisma.teamInvite.upsert({
    where: { token: "demo-mjd-join" },
    update: { expiresAt, revokedAt: null },
    create: {
      id: "invite-demo-mjd",
      clubId: club.id,
      teamId: mjdTeam.id,
      token: "demo-mjd-join",
      type: InviteType.TEAM_JOIN,
      role: MemberRole.PLAYER,
      createdByUserId: coachUser.id,
      maxUses: 50,
      expiresAt,
    },
  });

  await prisma.teamInvite.upsert({
    where: { token: "demo-claim-tom-ackermann" },
    update: { expiresAt, revokedAt: null },
    create: {
      id: "invite-demo-claim-tom-mjd",
      clubId: club.id,
      teamId: mjdTeam.id,
      token: "demo-claim-tom-ackermann",
      type: InviteType.PROFILE_CLAIM,
      role: MemberRole.PLAYER,
      targetMemberId: tomAckermann.id,
      createdByUserId: coachUser.id,
      maxUses: 1,
      expiresAt,
    },
  });

  // 9. Reale Hallen der Regionsoberliga MJD Nord (nuLiga HVNB)
  const upsertVenue = async (v: {
    id: string;
    name: string;
    address: string;
    mapsUrl: string;
    resinPolicy: ResinPolicy;
    notes: string;
  }) =>
    prisma.venue.upsert({
      where: { id: v.id },
      update: {
        name: v.name,
        address: v.address,
        mapsUrl: v.mapsUrl,
        resinPolicy: v.resinPolicy,
        notes: v.notes,
      },
      create: {
        id: v.id,
        clubId: club.id,
        name: v.name,
        address: v.address,
        mapsUrl: v.mapsUrl,
        resinPolicy: v.resinPolicy,
        notes: v.notes,
      },
    });

  const halleHollenstedt1 = await upsertVenue({
    id: "venue-tjh-603110",
    name: "Hollenstedt, Max-Schmeling-Hallen (Halle 1) (603110)",
    address: "Jahnstraße, 21279 Hollenstedt",
    mapsUrl:
      "https://maps.google.com/?q=Max-Schmeling-Hallen+Jahnstrasse+21279+Hollenstedt",
    resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
    notes:
      "Heimhalle TuS Jahn Hollenstedt (Halle 1) · In der D-Jugend gilt generelles Harzverbot.",
  });

  await upsertVenue({
    id: "venue-tjh-603135",
    name: "Hollenstedt, Max-Schmeling-Hallen (Halle 2) (603135)",
    address: "Jahnstraße, 21279 Hollenstedt",
    mapsUrl:
      "https://maps.google.com/?q=Max-Schmeling-Hallen+Jahnstrasse+21279+Hollenstedt",
    resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
    notes: "Heimhalle TuS Jahn Hollenstedt (Halle 2) · Trainingshalle Jugend.",
  });

  const halleBremervoerde = await upsertVenue({
    id: "venue-tjh-608153",
    name: "Bremervörde, SH Gymnasium (608153)",
    address: "Tetjus-Tügel-Straße, 27432 Bremervörde",
    mapsUrl:
      "https://maps.google.com/?q=Tetjus-Tuegel-Strasse+27432+Bremervoerde",
    resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
    notes: "Auswärtshalle TSV Bremervörde · Harzverbot in der Jugend.",
  });

  const halleKlecken = await upsertVenue({
    id: "venue-tjh-603134",
    name: "Klecken, SH (603134)",
    address: "Heinbuchenweg 19, 21224 Ortsteil Klecken/Rosengarten",
    mapsUrl: "https://maps.google.com/?q=Heinbuchenweg+19+21224+Rosengarten",
    resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
    notes:
      "Auswärtshalle HL Buchholz 08 - Rosengarten · Harzverbot in der Jugend.",
  });

  const halleBuxtehude = await upsertVenue({
    id: "venue-tjh-608165",
    name: "Buxtehude, Halle Nord - NEU (Halle 4+5) (608165)",
    address: "Konrad-Adenauer-Allee 2, 21614 Buxtehude",
    mapsUrl:
      "https://maps.google.com/?q=Konrad-Adenauer-Allee+2+21614+Buxtehude",
    resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
    notes:
      "Auswärtshalle mJSG Buxtehude/Beckdorf · Harzverbot in der Jugend.",
  });

  const halleLuhdorf = await upsertVenue({
    id: "venue-tjh-603112",
    name: "Winsen-Luhdorf, Peter-Wind-Halle (603112)",
    address: "Höllenberg, 21423 Winsen/Luhe (OT Luhdorf)",
    mapsUrl: "https://maps.google.com/?q=Hoellenberg+21423+Winsen+Luhe",
    resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
    notes: "Auswärtshalle SG Luhdorf/Scharmbeck · Harzverbot in der Jugend.",
  });

  const halleHorneburg = await upsertVenue({
    id: "venue-tjh-608115",
    name: "Horneburg, SH 1 (608115)",
    address: "Hermannstraße 27, 21640 Horneburg",
    mapsUrl: "https://maps.google.com/?q=Hermannstrasse+27+21640+Horneburg",
    resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
    notes: "Auswärtshalle VfL Horneburg · Harzverbot in der Jugend.",
  });

  const halleStade = await upsertVenue({
    id: "venue-tjh-608178",
    name: "Sportcampus Stade (BCR) (608178)",
    address: "Harsefelder Landstr. 200, 21684 Stade",
    mapsUrl: "https://maps.google.com/?q=Harsefelder+Landstr+200+21684+Stade",
    resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
    notes:
      "Auswärtshalle JSG Fredenbeck/Stade/Harsefeld · Harzverbot in der Jugend.",
  });

  const daysFromNow = (days: number, hour: number, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  // 10. Trainingstermin männliche D-Jugend
  const mjdTrainingNext = await prisma.event.upsert({
    where: { id: "event-mjd-training-next" },
    update: {
      title: "Mannschaftstraining männliche D-Jugend",
      venueId: halleHollenstedt1.id,
      startAt: daysFromNow(2, 17, 0),
      endAt: daysFromNow(2, 18, 30),
      rsvpDeadlineAt: daysFromNow(2, 14, 0),
      requireDeclineReason: true,
    },
    create: {
      id: "event-mjd-training-next",
      clubId: club.id,
      teamId: mjdTeam.id,
      venueId: halleHollenstedt1.id,
      type: EventType.TRAINING,
      title: "Mannschaftstraining männliche D-Jugend",
      description:
        "Schwerpunkt: Offensive 1:5-Abwehr, Freilaufen ohne Ball und 1. Welle.",
      startAt: daysFromNow(2, 17, 0),
      endAt: daysFromNow(2, 18, 30),
      rsvpDeadlineAt: daysFromNow(2, 14, 0),
      requireDeclineReason: true,
    },
  });

  // 11. Offizielle Spiele der Regionsoberliga MJD Nord 2026/27 (aus nuLiga HVNB importiert)
  const lastMatchSquadIds = [
    "member-mjd-fiete-ruser",
    "member-mjd-jonas-homann",
    "member-mjd-tom-ackermann",
    "member-mjd-erik-bruhn",
    "member-mjd-henri-berkowitz",
    "member-mjd-hannes-kroepfl",
    "member-mjd-menuas-demirel",
    "member-mjd-jarle-hofmann",
    "member-mjd-piet-ruser",
    "member-mjd-matti-borgmann",
    "member-mjd-jonas-mayer",
    "member-mjd-liron-alpermann",
  ];

  const nuligaMatches: Array<{
    id: string;
    externalId: string;
    matchNo: number;
    homeTeam: string;
    awayTeam: string;
    isHome: boolean;
    opponentName: string;
    startAtUtc: string;
    endAtUtc: string;
    meetingOffsetMinutes: number;
    venueId: string;
    homeScoreHalf?: number;
    awayScoreHalf?: number;
    homeScoreFull?: number;
    awayScoreFull?: number;
  }> = [
    {
      id: "event-mjd-rol-04",
      externalId: "f2ee4a43-b352-4efa-87ff-c272bbdad4fd",
      matchNo: 4,
      homeTeam: "TuS Jahn Hollenstedt",
      awayTeam: "SG Luhdorf/Scharmbeck",
      isHome: true,
      opponentName: "SG Luhdorf/Scharmbeck",
      startAtUtc: "2026-10-31T12:00:00.000Z", // 13:00 CET
      endAtUtc: "2026-10-31T13:00:00.000Z",
      meetingOffsetMinutes: 45,
      venueId: halleHollenstedt1.id,
      homeScoreHalf: 9,
      awayScoreHalf: 17,
      homeScoreFull: 22,
      awayScoreFull: 26,
    },
    {
      id: "event-mjd-rol-06",
      externalId: "ad5ebc59-9253-486b-a951-97281e3bcd35",
      matchNo: 6,
      homeTeam: "TSV Bremervörde",
      awayTeam: "TuS Jahn Hollenstedt",
      isHome: false,
      opponentName: "TSV Bremervörde",
      startAtUtc: "2026-11-08T11:30:00.000Z", // 12:30 CET
      endAtUtc: "2026-11-08T12:30:00.000Z",
      meetingOffsetMinutes: 75,
      venueId: halleBremervoerde.id,
      homeScoreHalf: 21,
      awayScoreHalf: 17,
      homeScoreFull: 39,
      awayScoreFull: 32,
    },
    {
      id: "event-mjd-rol-15",
      externalId: "b8cb75f1-ed68-49a0-9cdb-1319df15f2fd",
      matchNo: 15,
      homeTeam: "HL Buchholz 08 - Rosengarten gem.",
      awayTeam: "TuS Jahn Hollenstedt",
      isHome: false,
      opponentName: "HL Buchholz 08 - Rosengarten gem.",
      startAtUtc: "2026-11-22T10:15:00.000Z", // 11:15 CET
      endAtUtc: "2026-11-22T11:15:00.000Z",
      meetingOffsetMinutes: 60,
      venueId: halleKlecken.id,
      homeScoreHalf: 8,
      awayScoreHalf: 12,
      homeScoreFull: 17,
      awayScoreFull: 23,
    },
    {
      id: "event-mjd-rol-20",
      externalId: "aebd78a0-cbc1-453f-ae48-9433eac80fed",
      matchNo: 20,
      homeTeam: "HL Buchholz 08 - Rosengarten II",
      awayTeam: "TuS Jahn Hollenstedt",
      isHome: false,
      opponentName: "HL Buchholz 08 - Rosengarten II",
      startAtUtc: "2026-12-05T13:00:00.000Z", // 14:00 CET
      endAtUtc: "2026-12-05T14:00:00.000Z",
      meetingOffsetMinutes: 60,
      venueId: halleKlecken.id,
    },
    {
      id: "event-mjd-rol-24",
      externalId: "a3ee4c0d-f971-4dfe-aad2-596a04560ed0",
      matchNo: 24,
      homeTeam: "TuS Jahn Hollenstedt",
      awayTeam: "JSG Fredenbeck/Stade/Harsefeld (S)",
      isHome: true,
      opponentName: "JSG Fredenbeck/Stade/Harsefeld (S)",
      startAtUtc: "2026-12-13T09:00:00.000Z", // 10:00 CET
      endAtUtc: "2026-12-13T10:00:00.000Z",
      meetingOffsetMinutes: 45,
      venueId: halleHollenstedt1.id,
    },
    {
      id: "event-mjd-rol-25",
      externalId: "6ba2642f-d562-4085-bd2f-3009a5be7d0d",
      matchNo: 25,
      homeTeam: "mJSG Buxtehude/ Beckdorf (Bux)",
      awayTeam: "TuS Jahn Hollenstedt",
      isHome: false,
      opponentName: "mJSG Buxtehude/ Beckdorf (Bux)",
      startAtUtc: "2026-12-19T12:00:00.000Z", // 13:00 CET
      endAtUtc: "2026-12-19T13:00:00.000Z",
      meetingOffsetMinutes: 60,
      venueId: halleBuxtehude.id,
    },
    {
      id: "event-mjd-rol-32",
      externalId: "bfb845b5-32ee-4683-9dbd-09b2b7afc109",
      matchNo: 32,
      homeTeam: "SG Luhdorf/Scharmbeck",
      awayTeam: "TuS Jahn Hollenstedt",
      isHome: false,
      opponentName: "SG Luhdorf/Scharmbeck",
      startAtUtc: "2027-01-24T15:00:00.000Z", // 16:00 CET
      endAtUtc: "2027-01-24T16:00:00.000Z",
      meetingOffsetMinutes: 60,
      venueId: halleLuhdorf.id,
    },
    {
      id: "event-mjd-rol-34",
      externalId: "e1f434fe-821d-4095-8627-0cae18e7f5fe",
      matchNo: 34,
      homeTeam: "TuS Jahn Hollenstedt",
      awayTeam: "TSV Bremervörde",
      isHome: true,
      opponentName: "TSV Bremervörde",
      startAtUtc: "2027-02-06T12:10:00.000Z", // 13:10 CET
      endAtUtc: "2027-02-06T13:10:00.000Z",
      meetingOffsetMinutes: 45,
      venueId: halleHollenstedt1.id,
    },
    {
      id: "event-mjd-rol-40",
      externalId: "bd6cfa59-4ddb-4291-b124-2eefa155c50d",
      matchNo: 40,
      homeTeam: "VfL Horneburg",
      awayTeam: "TuS Jahn Hollenstedt",
      isHome: false,
      opponentName: "VfL Horneburg",
      startAtUtc: "2027-02-14T12:00:00.000Z", // 13:00 CET
      endAtUtc: "2027-02-14T13:00:00.000Z",
      meetingOffsetMinutes: 60,
      venueId: halleHorneburg.id,
    },
    {
      id: "event-mjd-rol-12",
      externalId: "97de471f-fb79-4dab-a2f4-11f8647cf747",
      matchNo: 12,
      homeTeam: "TuS Jahn Hollenstedt",
      awayTeam: "VfL Horneburg",
      isHome: true,
      opponentName: "VfL Horneburg",
      startAtUtc: "2027-02-21T14:40:00.000Z", // 15:40 CET
      endAtUtc: "2027-02-21T15:40:00.000Z",
      meetingOffsetMinutes: 45,
      venueId: halleHollenstedt1.id,
    },
    {
      id: "event-mjd-rol-43",
      externalId: "2b1bb6d0-64ea-47ab-aa00-e0950f8fde10",
      matchNo: 43,
      homeTeam: "TuS Jahn Hollenstedt",
      awayTeam: "HL Buchholz 08 - Rosengarten gem.",
      isHome: true,
      opponentName: "HL Buchholz 08 - Rosengarten gem.",
      startAtUtc: "2027-02-27T10:40:00.000Z", // 11:40 CET
      endAtUtc: "2027-02-27T11:40:00.000Z",
      meetingOffsetMinutes: 45,
      venueId: halleHollenstedt1.id,
    },
    {
      id: "event-mjd-rol-48",
      externalId: "b01554fb-60cd-4d59-8722-74399cff1850",
      matchNo: 48,
      homeTeam: "TuS Jahn Hollenstedt",
      awayTeam: "HL Buchholz 08 - Rosengarten II",
      isHome: true,
      opponentName: "HL Buchholz 08 - Rosengarten II",
      startAtUtc: "2027-03-06T13:50:00.000Z", // 14:50 CET
      endAtUtc: "2027-03-06T14:50:00.000Z",
      meetingOffsetMinutes: 45,
      venueId: halleHollenstedt1.id,
    },
    {
      id: "event-mjd-rol-52",
      externalId: "efbfbcc2-5662-4388-aefb-0e1497e30375",
      matchNo: 52,
      homeTeam: "JSG Fredenbeck/Stade/Harsefeld (S)",
      awayTeam: "TuS Jahn Hollenstedt",
      isHome: false,
      opponentName: "JSG Fredenbeck/Stade/Harsefeld (S)",
      startAtUtc: "2027-03-14T10:30:00.000Z", // 11:30 CET
      endAtUtc: "2027-03-14T11:30:00.000Z",
      meetingOffsetMinutes: 60,
      venueId: halleStade.id,
    },
    {
      id: "event-mjd-rol-53",
      externalId: "7143802a-a828-4a7f-8d93-8917442c4bf5",
      matchNo: 53,
      homeTeam: "TuS Jahn Hollenstedt",
      awayTeam: "mJSG Buxtehude/ Beckdorf (Bux)",
      isHome: true,
      opponentName: "mJSG Buxtehude/ Beckdorf (Bux)",
      startAtUtc: "2027-04-10T09:30:00.000Z", // 11:30 CEST (Sommerzeit!)
      endAtUtc: "2027-04-10T10:30:00.000Z",
      meetingOffsetMinutes: 45,
      venueId: halleHollenstedt1.id,
    },
  ];

  const matchEventsById: Record<string, string> = {};

  for (const m of nuligaMatches) {
    const startAt = new Date(m.startAtUtc);
    const endAt = new Date(m.endAtUtc);
    const meetingAt = new Date(
      startAt.getTime() - m.meetingOffsetMinutes * 60 * 1000
    );
    const title = `${m.homeTeam} vs. ${m.awayTeam}`;

    const ev = await prisma.event.upsert({
      where: { id: m.id },
      update: {
        title,
        venueId: m.venueId,
        startAt,
        endAt,
        meetingAt,
        externalId: m.externalId,
        requireDeclineReason: true,
      },
      create: {
        id: m.id,
        clubId: club.id,
        teamId: mjdTeam.id,
        venueId: m.venueId,
        type: EventType.MATCH,
        title,
        description: `Regionsoberliga männliche Jugend D Nord · nuLiga Begegnungs-Nr. ${m.matchNo}`,
        startAt,
        endAt,
        meetingAt,
        externalId: m.externalId,
        requireDeclineReason: true,
      },
    });

    matchEventsById[m.id] = ev.id;

    await prisma.matchDetails.upsert({
      where: { eventId: ev.id },
      update: {
        opponentName: m.opponentName,
        isHome: m.isHome,
        throwOffAt: startAt,
        jerseyColor: m.isHome ? "Rot / Weiß (Heim)" : "Weiß / Rot (Auswärts)",
        homeScoreHalf: m.homeScoreHalf ?? null,
        awayScoreHalf: m.awayScoreHalf ?? null,
        homeScoreFull: m.homeScoreFull ?? null,
        awayScoreFull: m.awayScoreFull ?? null,
        scoreManuallyEdited: false,
        officialHomeScoreHalf: m.homeScoreHalf ?? null,
        officialAwayScoreHalf: m.awayScoreHalf ?? null,
        officialHomeScoreFull: m.homeScoreFull ?? null,
        officialAwayScoreFull: m.awayScoreFull ?? null,
        nominatedMemberIds: lastMatchSquadIds,
      },
      create: {
        id: `match-${m.id}`,
        eventId: ev.id,
        opponentName: m.opponentName,
        isHome: m.isHome,
        throwOffAt: startAt,
        jerseyColor: m.isHome ? "Rot / Weiß (Heim)" : "Weiß / Rot (Auswärts)",
        refereeNote: "Ansetzung über nuLiga HVNB",
        homeScoreHalf: m.homeScoreHalf ?? null,
        awayScoreHalf: m.awayScoreHalf ?? null,
        homeScoreFull: m.homeScoreFull ?? null,
        awayScoreFull: m.awayScoreFull ?? null,
        scoreManuallyEdited: false,
        officialHomeScoreHalf: m.homeScoreHalf ?? null,
        officialAwayScoreHalf: m.awayScoreHalf ?? null,
        officialHomeScoreFull: m.homeScoreFull ?? null,
        officialAwayScoreFull: m.awayScoreFull ?? null,
        nominatedMemberIds: lastMatchSquadIds,
      },
    });
  }

  const nextAwayMatchId = matchEventsById["event-mjd-rol-20"]; // 05.12.2026 in Klecken
  const nextHomeMatchId = matchEventsById["event-mjd-rol-24"]; // 13.12.2026 in Hollenstedt
  const lastPastMatchId = matchEventsById["event-mjd-rol-15"]; // 22.11.2026 Auswärtssieg 17:23 (8:12)

  // 12. Realistische RSVP-Rückmeldungen
  const upsertRsvp = async (
    eventId: string,
    memberId: string,
    status: RsvpStatus,
    declineReasonCategory: DeclineReasonCategory | null = null,
    declineReason: string | null = null
  ) => {
    await prisma.eventAttendance.upsert({
      where: { eventId_memberId: { eventId, memberId } },
      update: {
        status,
        declineReasonCategory,
        declineReason,
        respondedAt: new Date(),
      },
      create: {
        eventId,
        memberId,
        status,
        declineReasonCategory,
        declineReason,
        respondedAt: new Date(),
      },
    });
  };

  await upsertRsvp(
    mjdTrainingNext.id,
    "member-mjd-matti-borgmann",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    mjdTrainingNext.id,
    "member-mjd-tom-ackermann",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    mjdTrainingNext.id,
    "member-mjd-erik-bruhn",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    mjdTrainingNext.id,
    "member-mjd-henri-berkowitz",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    mjdTrainingNext.id,
    "member-mjd-hannes-kroepfl",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    mjdTrainingNext.id,
    "member-mjd-jonas-mayer",
    RsvpStatus.MAYBE
  );
  await upsertRsvp(mjdTrainingNext.id, jarleHofmann.id, RsvpStatus.ACCEPTED);
  await upsertRsvp(mjdTrainingNext.id, fieteRuser.id, RsvpStatus.PENDING);
  await upsertRsvp(mjdTrainingNext.id, pietRuser.id, RsvpStatus.PENDING);
  await upsertRsvp(
    mjdTrainingNext.id,
    "member-mjd-tobias-barkow",
    RsvpStatus.DECLINED,
    DeclineReasonCategory.SCHOOL_UNI,
    "Schulveranstaltung am Nachmittag"
  );

  await upsertRsvp(nextAwayMatchId, jarleHofmann.id, RsvpStatus.ACCEPTED);
  await upsertRsvp(
    nextAwayMatchId,
    "member-mjd-matti-borgmann",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    nextAwayMatchId,
    "member-mjd-tom-ackermann",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    nextAwayMatchId,
    "member-mjd-erik-bruhn",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    nextAwayMatchId,
    "member-mjd-henri-berkowitz",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    nextAwayMatchId,
    "member-mjd-hannes-kroepfl",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(nextAwayMatchId, fieteRuser.id, RsvpStatus.ACCEPTED);
  await upsertRsvp(nextAwayMatchId, pietRuser.id, RsvpStatus.ACCEPTED);

  await upsertRsvp(nextHomeMatchId, jarleHofmann.id, RsvpStatus.PENDING);
  await upsertRsvp(
    nextHomeMatchId,
    "member-mjd-matti-borgmann",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(
    nextHomeMatchId,
    "member-mjd-tom-ackermann",
    RsvpStatus.ACCEPTED
  );
  await upsertRsvp(nextHomeMatchId, fieteRuser.id, RsvpStatus.PENDING);
  await upsertRsvp(nextHomeMatchId, pietRuser.id, RsvpStatus.PENDING);

  for (const memberId of lastMatchSquadIds) {
    await upsertRsvp(lastPastMatchId, memberId, RsvpStatus.ACCEPTED);
  }

  // 13. Echte nuLiga iCal-Importquelle & Change-Log (M2b)
  const mjdSource = await prisma.leagueImportSource.upsert({
    where: { id: "source-mjd-nuliga-ical" },
    update: {
      name: "nuLiga Regionsoberliga MJD Nord (HVNB iCal)",
      sourceUrl: NULIGA_MJD_ICAL_URL,
      teamNameMatch: "TuS Jahn Hollenstedt",
      isEnabled: true,
      syncIntervalMinutes: 60,
    },
    create: {
      id: "source-mjd-nuliga-ical",
      clubId: club.id,
      teamId: mjdTeam.id,
      provider: LeagueProviderType.ICAL_URL,
      name: "nuLiga Regionsoberliga MJD Nord (HVNB iCal)",
      sourceUrl: NULIGA_MJD_ICAL_URL,
      teamNameMatch: "TuS Jahn Hollenstedt",
      isEnabled: true,
      syncIntervalMinutes: 60,
      lastSyncedAt: new Date(),
      lastSyncStatus: SyncStatus.SUCCESS,
    },
  });

  await prisma.leagueSyncChangeLog.upsert({
    where: { id: "changelog-mjd-nuliga-initial" },
    update: {
      summary:
        "nuLiga-Import: 14 Spiele der Regionsoberliga MJD Nord (Saison 2026/27) synchronisiert",
    },
    create: {
      id: "changelog-mjd-nuliga-initial",
      sourceId: mjdSource.id,
      teamId: mjdTeam.id,
      eventId: nextHomeMatchId,
      externalId: "a3ee4c0d-f971-4dfe-aad2-596a04560ed0",
      changeType: SyncChangeType.CREATED,
      summary:
        "nuLiga-Import: 14 Spiele der Regionsoberliga MJD Nord (Saison 2026/27) synchronisiert",
      newStartAt: new Date("2026-12-13T09:00:00.000Z"),
      newVenueName: halleHollenstedt1.name,
    },
  });

  // 14. Fahrgemeinschaft für das nächste Auswärtsspiel in Klecken (M2b)
  const mjdCarpool = await prisma.carpool.upsert({
    where: { id: "carpool-mjd-klecken-ruser" },
    update: {
      departureLocation: "Parkplatz Max-Schmeling-Hallen, Hollenstedt",
      departureTime: "13:00 Uhr",
      totalSeats: 3,
      notes:
        "Kombi mit Platz für 3 Kinder + Sporttaschen (Sitzerhöhungen vorhanden).",
    },
    create: {
      id: "carpool-mjd-klecken-ruser",
      eventId: nextAwayMatchId,
      driverMemberId: "member-mjd-parent",
      departureLocation: "Parkplatz Max-Schmeling-Hallen, Hollenstedt",
      departureTime: "13:00 Uhr",
      totalSeats: 3,
      notes:
        "Kombi mit Platz für 3 Kinder + Sporttaschen (Sitzerhöhungen vorhanden).",
    },
  });

  await prisma.carpoolBooking.upsert({
    where: {
      carpoolId_passengerMemberId: {
        carpoolId: mjdCarpool.id,
        passengerMemberId: "member-mjd-henri-berkowitz",
      },
    },
    update: {},
    create: {
      id: "booking-mjd-klecken-henri",
      carpoolId: mjdCarpool.id,
      passengerMemberId: "member-mjd-henri-berkowitz",
      bookedByUserId: coachUser.id,
    },
  });

  // 15. Heimspieltag & Hallendienste in den Max-Schmeling-Hallen (M3)
  const matchday = await prisma.matchday.upsert({
    where: { id: "matchday-tjh-2026-12-13" },
    update: {
      title: "Heimspieltag Sonntag – Max-Schmeling-Hallen (Halle 1)",
      date: new Date("2026-12-13T09:00:00.000Z"),
      venueId: halleHollenstedt1.id,
    },
    create: {
      id: "matchday-tjh-2026-12-13",
      clubId: club.id,
      seasonId: season.id,
      venueId: halleHollenstedt1.id,
      title: "Heimspieltag Sonntag – Max-Schmeling-Hallen (Halle 1)",
      date: new Date("2026-12-13T09:00:00.000Z"),
      notes:
        "Jugend-Heimspieltag in Hollenstedt: 10:00 Uhr mD-Jugend vs. JSG Fredenbeck/Stade/Harsefeld (S).",
    },
  });

  await prisma.workDuty.upsert({
    where: { id: "duty-tjh-kampfg-mjd" },
    update: {
      title: "Kampfgericht (Zeitnehmer / Sekretär) – mD-Jugend",
      startAt: new Date("2026-12-13T08:45:00.000Z"),
      endAt: new Date("2026-12-13T10:15:00.000Z"),
      assignedTeamId: mjdTeam.id,
    },
    create: {
      id: "duty-tjh-kampfg-mjd",
      clubId: club.id,
      matchdayId: matchday.id,
      scope: DutyScope.CLUB_MATCHDAY,
      category: DutyCategory.TIMEKEEPER,
      title: "Kampfgericht (Zeitnehmer / Sekretär) – mD-Jugend",
      description:
        "Elektronischer Spielbericht (nuScore) & Hallenuhr beim Heimspiel gegen JSG Fredenbeck/Stade/Harsefeld.",
      startAt: new Date("2026-12-13T08:45:00.000Z"),
      endAt: new Date("2026-12-13T10:15:00.000Z"),
      hoursCredit: 1.5,
      requiresLicense: false,
      slotsNeeded: 2,
      assignedTeamId: mjdTeam.id,
    },
  });

  const kioskDuty = await prisma.workDuty.upsert({
    where: { id: "duty-tjh-kiosk-mjd" },
    update: {
      title: "Kiosk / Cafeteria – Schicht 1 (Max-Schmeling-Hallen)",
      startAt: new Date("2026-12-13T08:30:00.000Z"),
      endAt: new Date("2026-12-13T11:00:00.000Z"),
    },
    create: {
      id: "duty-tjh-kiosk-mjd",
      clubId: club.id,
      matchdayId: matchday.id,
      scope: DutyScope.CLUB_MATCHDAY,
      category: DutyCategory.KIOSK,
      title: "Kiosk / Cafeteria – Schicht 1 (Max-Schmeling-Hallen)",
      description:
        "Kaffee, Waffeln, Brezeln & Getränke für Zuschauer und Gastteam.",
      startAt: new Date("2026-12-13T08:30:00.000Z"),
      endAt: new Date("2026-12-13T11:00:00.000Z"),
      hoursCredit: 2.5,
      requiresLicense: false,
      slotsNeeded: 2,
    },
  });

  await prisma.workDutyAssignment.upsert({
    where: { id: "assignment-tjh-kiosk-ruser" },
    update: {
      status: DutyAssignmentStatus.SWAP_REQUESTED,
      swapNote:
        "Kann erst ab 10:30 Uhr in der Halle sein – tausche gern gegen Schicht 2!",
    },
    create: {
      id: "assignment-tjh-kiosk-ruser",
      dutyId: kioskDuty.id,
      assignedMemberId: "member-mjd-parent",
      status: DutyAssignmentStatus.SWAP_REQUESTED,
      swapNote:
        "Kann erst ab 10:30 Uhr in der Halle sein – tausche gern gegen Schicht 2!",
    },
  });

  // 15b. Trikotsätze inkl. Zustand & Pflegehinweisen
  await prisma.jerseySet.upsert({
    where: { id: "jersey-tjh-mjd-home" },
    update: {},
    create: {
      id: "jersey-tjh-mjd-home",
      clubId: club.id,
      teamId: mjdTeam.id,
      name: "Heimtrikot mD-Jugend",
      colors: "Grün / Weiß",
      sizes: "152–S (14 Feld + 2 TW)",
      jerseyCount: 16,
      condition: JerseyCondition.GOOD,
      conditionNote: "Vollständig und frisch gezählt.",
      careInstructions:
        "Max. 30 °C auf links waschen, kein Weichspüler, nicht trocknergeeignet (Beflockung!).",
    },
  });

  const awayJerseySet = await prisma.jerseySet.upsert({
    where: { id: "jersey-tjh-mjd-away" },
    update: {},
    create: {
      id: "jersey-tjh-mjd-away",
      clubId: club.id,
      teamId: mjdTeam.id,
      name: "Auswärtstrikot mD-Jugend",
      colors: "Schwarz / Neongrün",
      sizes: "152–S (14 Feld + 2 TW)",
      jerseyCount: 16,
      condition: JerseyCondition.WORN,
      conditionNote: "Nr. 9 leichter Druckabrieb am Rücken, sonst gut.",
      careInstructions:
        "Max. 30 °C Feinwäsche auf links, kein Weichspüler, nicht bügeln, lufttrocknen.",
    },
  });

  const laundryDuty = await prisma.workDuty.upsert({
    where: { id: "duty-tjh-trikot-mjd" },
    update: {
      title: "Trikotwäsche mD-Jugend (Auswärtsspiel Klecken 17:23)",
      jerseySetId: awayJerseySet.id,
    },
    create: {
      id: "duty-tjh-trikot-mjd",
      clubId: club.id,
      teamId: mjdTeam.id,
      eventId: lastPastMatchId,
      jerseySetId: awayJerseySet.id,
      scope: DutyScope.TEAM,
      category: DutyCategory.JERSEY_LAUNDRY,
      title: "Trikotwäsche mD-Jugend (Auswärtsspiel Klecken 17:23)",
      description: "Kompletter Auswärts-Trikotsatz gewaschen und gezählt.",
      hoursCredit: 1.5,
      requiresLicense: false,
      slotsNeeded: 1,
    },
  });

  await prisma.workDutyAssignment.upsert({
    where: { id: "assignment-tjh-trikot-matti" },
    update: { status: DutyAssignmentStatus.COMPLETED },
    create: {
      id: "assignment-tjh-trikot-matti",
      dutyId: laundryDuty.id,
      assignedMemberId: "member-mjd-matti-borgmann",
      status: DutyAssignmentStatus.COMPLETED,
      completedAt: daysFromNow(-1, 18, 0),
    },
  });

  // 16. Übungsbibliothek & Trainingsplan für D-Jugend (M3)
  const drillWarmup = await prisma.drill.upsert({
    where: { id: "drill-tjh-tw-konter" },
    update: {},
    create: {
      id: "drill-tjh-tw-konter",
      clubId: club.id,
      createdByUserId: coachUser.id,
      title: "Torwart-Einwerfen & 1.-Welle-Konterpass",
      description:
        "Saubere Schlag- und Sprungwürfe aus dem Rückraum, direkt gefolgt von schnellem Umschaltpass auf den startenden Außen.",
      phase: TrainingPhaseType.WARMUP,
      durationMinutes: 15,
      tags: ["Torwart", "Gegenstoß", "Wurftraining"],
      equipment: "12 Handbälle (Größe 1), 4 Hütchen",
    },
  });

  const drillDefense = await prisma.drill.upsert({
    where: { id: "drill-tjh-1-5-abwehr" },
    update: {},
    create: {
      id: "drill-tjh-1-5-abwehr",
      clubId: club.id,
      createdByUserId: coachUser.id,
      title: "Offensive 1:5-Abwehr: Passwege zustellen & Helfen",
      description:
        "D-Jugend-gerechte offensive Deckung: aktives Herausarbeiten auf den ballführenden Spieler und rechtzeitiges Absinken zur Ballseite.",
      phase: TrainingPhaseType.TACTICS,
      durationMinutes: 25,
      tags: ["1:5-Abwehr", "1-gegen-1", "Ballgewinn"],
      equipment: "Leibchen (2 Farben), 6 Bälle (Größe 1)",
    },
  });

  const drillGameForm = await prisma.drill.upsert({
    where: { id: "drill-tjh-ueberzahl-4-3" },
    update: {},
    create: {
      id: "drill-tjh-ueberzahl-4-3",
      clubId: club.id,
      createdByUserId: coachUser.id,
      title: "Stoßen & Weitergeben im 4-gegen-3 bis zur Außenchance",
      description:
        "Tiefe annehmen, Verteidiger binden und rechtzeitig parallel weiterspielen.",
      phase: TrainingPhaseType.GAME_FORM,
      durationMinutes: 25,
      tags: ["Stoßen", "Überzahl", "Wurftraining"],
      equipment: "Leibchen, 8 Bälle (Größe 1)",
    },
  });

  await prisma.trainingPlan.upsert({
    where: { id: "plan-tjh-mjd-rosengarten" },
    update: {
      title:
        "Vorbereitung HL Buchholz 08 - Rosengarten II – 1:5-Abwehr & 1. Welle",
      isSharedWithTeam: true,
    },
    create: {
      id: "plan-tjh-mjd-rosengarten",
      clubId: club.id,
      teamId: mjdTeam.id,
      eventId: mjdTrainingNext.id,
      createdByUserId: coachUser.id,
      title:
        "Vorbereitung HL Buchholz 08 - Rosengarten II – 1:5-Abwehr & 1. Welle",
      focus:
        "Aktive Ballgewinne in der 1:5-Abwehr & schnelles Umschalten nach vorn",
      targetDurationMinutes: 90,
      isSharedWithTeam: true,
      phases: [
        {
          id: "ph-1",
          phase: "WARMUP",
          title: drillWarmup.title,
          durationMinutes: 15,
          drillId: drillWarmup.id,
          equipment: drillWarmup.equipment,
          notes: "Auf sauberes Fangen im Lauf achten.",
        },
        {
          id: "ph-2",
          phase: "TECHNIQUE",
          title: "Körpertäuschung 1-gegen-1 & Schlagwurf",
          durationMinutes: 15,
          equipment: "Hütchen, 10 Bälle (Größe 1)",
          notes: "Beidseitige Täuschung gegen stehende Hütchen und aktive Partner.",
        },
        {
          id: "ph-3",
          phase: "TACTICS",
          title: drillDefense.title,
          durationMinutes: 25,
          drillId: drillDefense.id,
          equipment: drillDefense.equipment,
          notes: "Lautstarke Kommunikation beim Übergeben.",
        },
        {
          id: "ph-4",
          phase: "GAME_FORM",
          title: drillGameForm.title,
          durationMinutes: 25,
          drillId: drillGameForm.id,
          equipment: drillGameForm.equipment,
          notes: "Zusatzpunkt bei Tor über Außen oder Gegenstoß.",
        },
        {
          id: "ph-5",
          phase: "COOLDOWN",
          title: "Auslaufen, Dehnkreis & kurze Spielbesprechung",
          durationMinutes: 10,
          notes: "Treffpunkt und Fahrgemeinschaften für Klecken klären.",
        },
      ],
    },
  });

  // 17. Interaktives Handball-Playbook (M4)
  const kreuzungPlay = await prisma.tacticPlay.upsert({
    where: { id: "tactic-tjh-einlaeufer" },
    update: {
      title: "D-Jugend Basis: Stoßen Mitte → Einläufer RA",
      isSharedWithTeam: true,
    },
    create: {
      id: "tactic-tjh-einlaeufer",
      clubId: club.id,
      teamId: mjdTeam.id,
      createdByUserId: coachUser.id,
      title: "D-Jugend Basis: Stoßen Mitte → Einläufer RA",
      description:
        "Einfache Auslösehandlung gegen offensive Jugendabwehr: RM stößt tief in die Lücke, RL übernimmt, RA läuft über die rechte Seite an den Kreis ein.",
      category: TacticCategory.TRIGGER_PLAY,
      courtMode: CourtMode.HALF_COURT,
      tags: ["1:5-Abwehr", "Stoßen", "Einläufer"],
      isSharedWithTeam: true,
      boardData: {
        version: 1,
        keyframes: [
          {
            id: "kf-1",
            label: "1. Auftakt & Stoßen RM",
            notes: "RM stößt mit Tempo auf die Nahtstelle, RL bietet sich an.",
            durationMs: 1500,
            tokens: [
              { id: "tw", kind: "GOALKEEPER", label: "TW", x: 500, y: 120 },
              { id: "la", kind: "ATTACKER", label: "LA", x: 110, y: 245 },
              { id: "rl", kind: "ATTACKER", label: "RL", x: 255, y: 610 },
              { id: "rm", kind: "ATTACKER", label: "RM", x: 500, y: 690 },
              { id: "rr", kind: "ATTACKER", label: "RR", x: 745, y: 610 },
              { id: "ra", kind: "ATTACKER", label: "RA", x: 890, y: 245 },
              { id: "km", kind: "ATTACKER", label: "KM", x: 560, y: 375 },
              { id: "d1", kind: "DEFENDER", label: "1", x: 215, y: 270 },
              { id: "d2", kind: "DEFENDER", label: "2", x: 330, y: 365 },
              { id: "d3", kind: "DEFENDER", label: "3", x: 500, y: 495 },
              { id: "d4", kind: "DEFENDER", label: "4", x: 555, y: 375 },
              { id: "d5", kind: "DEFENDER", label: "5", x: 670, y: 365 },
              { id: "d6", kind: "DEFENDER", label: "6", x: 785, y: 270 },
              { id: "ball", kind: "BALL", label: "", x: 525, y: 655 },
            ],
            drawings: [
              { id: "d-run-rm", kind: "RUN", x1: 500, y1: 690, x2: 335, y2: 530 },
              { id: "d-run-rl", kind: "RUN", x1: 255, y1: 610, x2: 470, y2: 565 },
              { id: "d-pass-1", kind: "PASS", x1: 360, y1: 545, x2: 455, y2: 565 },
            ],
          },
          {
            id: "kf-2",
            label: "2. Übergabe & Einläufer RA",
            notes: "RL spielt in die Tiefe, RA startet in den freien Raum am 6m-Kreis.",
            durationMs: 1500,
            tokens: [
              { id: "tw", kind: "GOALKEEPER", label: "TW", x: 515, y: 120 },
              { id: "la", kind: "ATTACKER", label: "LA", x: 115, y: 245 },
              { id: "rl", kind: "ATTACKER", label: "RL", x: 470, y: 560 },
              { id: "rm", kind: "ATTACKER", label: "RM", x: 300, y: 515 },
              { id: "rr", kind: "ATTACKER", label: "RR", x: 760, y: 585 },
              { id: "ra", kind: "ATTACKER", label: "RA", x: 720, y: 350 },
              { id: "km", kind: "ATTACKER", label: "KM", x: 565, y: 390 },
              { id: "d1", kind: "DEFENDER", label: "1", x: 215, y: 275 },
              { id: "d2", kind: "DEFENDER", label: "2", x: 330, y: 375 },
              { id: "d3", kind: "DEFENDER", label: "3", x: 455, y: 430 },
              { id: "d4", kind: "DEFENDER", label: "4", x: 570, y: 375 },
              { id: "d5", kind: "DEFENDER", label: "5", x: 685, y: 355 },
              { id: "d6", kind: "DEFENDER", label: "6", x: 790, y: 290 },
              { id: "ball", kind: "BALL", label: "", x: 495, y: 530 },
            ],
            drawings: [
              { id: "d-run-ra", kind: "RUN", x1: 720, y1: 350, x2: 615, y2: 430 },
              { id: "d-pass-2", kind: "PASS", x1: 495, y1: 530, x2: 615, y2: 430 },
            ],
          },
          {
            id: "kf-3",
            label: "3. Abschluss am 6m-Kreis",
            notes: "RA erhält das Anspiel in die freie Lücke und schließt frei ab.",
            durationMs: 1400,
            tokens: [
              { id: "tw", kind: "GOALKEEPER", label: "TW", x: 540, y: 140 },
              { id: "la", kind: "ATTACKER", label: "LA", x: 130, y: 260 },
              { id: "rl", kind: "ATTACKER", label: "RL", x: 485, y: 535 },
              { id: "rm", kind: "ATTACKER", label: "RM", x: 295, y: 515 },
              { id: "rr", kind: "ATTACKER", label: "RR", x: 785, y: 540 },
              { id: "ra", kind: "ATTACKER", label: "RA", x: 605, y: 310 },
              { id: "km", kind: "ATTACKER", label: "KM", x: 545, y: 395 },
              { id: "d1", kind: "DEFENDER", label: "1", x: 225, y: 280 },
              { id: "d2", kind: "DEFENDER", label: "2", x: 355, y: 365 },
              { id: "d3", kind: "DEFENDER", label: "3", x: 470, y: 390 },
              { id: "d4", kind: "DEFENDER", label: "4", x: 575, y: 385 },
              { id: "d5", kind: "DEFENDER", label: "5", x: 705, y: 355 },
              { id: "d6", kind: "DEFENDER", label: "6", x: 790, y: 300 },
              { id: "ball", kind: "BALL", label: "", x: 590, y: 270 },
            ],
            drawings: [
              { id: "d-shot", kind: "SHOT", x1: 605, y1: 310, x2: 505, y2: 95 },
              { id: "d-zone", kind: "ZONE", x1: 555, y1: 265, x2: 660, y2: 355 },
            ],
          },
        ],
      },
    },
  });

  await prisma.tacticPlay.upsert({
    where: { id: "tactic-tjh-gegenstoss" },
    update: {
      title: "Gegenstoß 1. & 2. Welle (Ganzfeld)",
      isSharedWithTeam: true,
    },
    create: {
      id: "tactic-tjh-gegenstoss",
      clubId: club.id,
      teamId: mjdTeam.id,
      createdByUserId: coachUser.id,
      title: "Gegenstoß 1. & 2. Welle (Ganzfeld)",
      description:
        "Schnelles Umschaltspiel nach Torwartparade: LA sprintet in die 1. Welle, RM & RR ziehen die 2. Welle nach.",
      category: TacticCategory.FAST_BREAK,
      courtMode: CourtMode.FULL_COURT,
      tags: ["Gegenstoß", "1. Welle", "2. Welle"],
      isSharedWithTeam: true,
      boardData: {
        version: 1,
        keyframes: [
          {
            id: "gb-1",
            label: "1. Parade & Start LA",
            notes: "TW fängt den Ball und sucht sofort den Blickkontakt zu LA.",
            durationMs: 1400,
            tokens: [
              { id: "tw", kind: "GOALKEEPER", label: "TW", x: 95, y: 500 },
              { id: "la", kind: "ATTACKER", label: "LA", x: 350, y: 175 },
              { id: "rm", kind: "ATTACKER", label: "RM", x: 240, y: 500 },
              { id: "rr", kind: "ATTACKER", label: "RR", x: 260, y: 740 },
              { id: "d1", kind: "DEFENDER", label: "1", x: 520, y: 300 },
              { id: "d2", kind: "DEFENDER", label: "2", x: 540, y: 540 },
              { id: "dtw", kind: "DEFENDER", label: "TW", x: 910, y: 500 },
              { id: "ball", kind: "BALL", label: "", x: 130, y: 480 },
            ],
            drawings: [
              { id: "g-p1", kind: "PASS", x1: 130, y1: 480, x2: 640, y2: 205 },
              { id: "g-r1", kind: "RUN", x1: 350, y1: 175, x2: 660, y2: 205 },
            ],
          },
          {
            id: "gb-2",
            label: "2. Langpass & Tempoabschluss",
            notes: "LA fängt im Vollsprint über die linke Bahn und zieht zum 6m-Raum.",
            durationMs: 1400,
            tokens: [
              { id: "tw", kind: "GOALKEEPER", label: "TW", x: 110, y: 500 },
              { id: "la", kind: "ATTACKER", label: "LA", x: 750, y: 265 },
              { id: "rm", kind: "ATTACKER", label: "RM", x: 560, y: 500 },
              { id: "rr", kind: "ATTACKER", label: "RR", x: 590, y: 740 },
              { id: "d1", kind: "DEFENDER", label: "1", x: 730, y: 410 },
              { id: "d2", kind: "DEFENDER", label: "2", x: 720, y: 590 },
              { id: "dtw", kind: "DEFENDER", label: "TW", x: 895, y: 465 },
              { id: "ball", kind: "BALL", label: "", x: 785, y: 280 },
            ],
            drawings: [
              { id: "g-s1", kind: "SHOT", x1: 750, y1: 265, x2: 945, y2: 495 },
            ],
          },
        ],
      },
    },
  });

  await prisma.tacticPlay.upsert({
    where: { id: "tactic-tjh-draft-freiwurf" },
    update: { isSharedWithTeam: false },
    create: {
      id: "tactic-tjh-draft-freiwurf",
      clubId: club.id,
      teamId: mjdTeam.id,
      createdByUserId: coachUser.id,
      title: "Freiwurfvariante Rückrunde (Trainer-Entwurf)",
      description:
        "Nur für Trainerteam sichtbar bis zur Freigabe vor dem Rückspiel gegen SG Luhdorf/Scharmbeck.",
      category: TacticCategory.FREE_THROW,
      courtMode: CourtMode.HALF_COURT,
      tags: ["Freiwurf", "Entwurf"],
      isSharedWithTeam: false,
      boardData: {
        version: 1,
        keyframes: [
          {
            id: "kf-fw",
            label: "Freiwurf Grundstellung",
            notes: "RR läuft um den Block von KM.",
            durationMs: 1400,
            tokens: [
              { id: "la", kind: "ATTACKER", label: "LA", x: 110, y: 245 },
              { id: "rl", kind: "ATTACKER", label: "RL", x: 255, y: 610 },
              { id: "rm", kind: "ATTACKER", label: "RM", x: 500, y: 690 },
              { id: "rr", kind: "ATTACKER", label: "RR", x: 745, y: 610 },
              { id: "ra", kind: "ATTACKER", label: "RA", x: 890, y: 245 },
              { id: "km", kind: "ATTACKER", label: "KM", x: 565, y: 365 },
              { id: "ball", kind: "BALL", label: "", x: 530, y: 655 },
            ],
            drawings: [],
          },
        ],
      },
    },
  });

  // 18. Gegner-Scouting Dossier: JSG Fredenbeck/Stade/Harsefeld (S) (M4)
  const oppFredenbeck = await prisma.opponent.upsert({
    where: { id: "opponent-tjh-fredenbeck" },
    update: {
      name: "JSG Fredenbeck/Stade/Harsefeld (S)",
      leagueName: "Regionsoberliga MJD Nord",
    },
    create: {
      id: "opponent-tjh-fredenbeck",
      clubId: club.id,
      teamId: mjdTeam.id,
      name: "JSG Fredenbeck/Stade/Harsefeld (S)",
      leagueName: "Regionsoberliga MJD Nord",
      defenseSystems: ["1:5 offensiv", "3:3 Manndeckung"],
      attackSystems: ["1-gegen-1 Durchbruch", "Schnelle Mitte", "Kreisanspiel"],
      transitionNotes:
        "Sehr hohes Tempo nach Ballgewinnen – sofortiges Rückzugsverhalten entscheidend.",
      strengths:
        "Spielstarke Mitte und wurfstarker halblinker Rückraum; kennen wir bereits aus der Vorrunde Gruppe 7.",
      weaknesses:
        "Bei konsequentem Weiterspielen über die Außen entstehen klare Chancen mit gutem Winkel.",
      generalNotes:
        "Heimspiel am 13.12.2026 um 10:00 Uhr in den Max-Schmeling-Hallen (Halle 1).",
    },
  });

  await prisma.opponentPlayer.upsert({
    where: { id: "opp-player-tjh-1" },
    update: {},
    create: {
      id: "opp-player-tjh-1",
      opponentId: oppFredenbeck.id,
      name: "Spieler #11 (Rückraum Links)",
      jerseyNumber: 11,
      position: HandballPosition.RL,
      throwingHand: ThrowingHand.RIGHT,
      isSevenMeterShooter: true,
      threatLevel: ThreatLevel.HIGH,
      feintPreference: "Zieht bevorzugt über die rechte Wurfhand zur Mitte.",
      notes: "Früh offensiv annehmen, keinen freien Anlauf lassen.",
      shotZones: {
        topLeft: 15,
        topCenter: 10,
        topRight: 80,
        midLeft: 20,
        midCenter: 5,
        midRight: 30,
        botLeft: 65,
        botCenter: 10,
        botRight: 25,
      },
    },
  });

  await prisma.scoutingNote.upsert({
    where: { id: "scouting-note-tjh-shared" },
    update: { isSharedWithTeam: true },
    create: {
      id: "scouting-note-tjh-shared",
      clubId: club.id,
      teamId: mjdTeam.id,
      opponentId: oppFredenbeck.id,
      eventId: nextHomeMatchId,
      tacticPlayId: kreuzungPlay.id,
      createdByUserId: coachUser.id,
      title: "Matchplan Heimspiel JSG Fredenbeck/Stade/Harsefeld (S)",
      content:
        "Fokus Abwehr: Wach in der 1:5-Deckung bleiben und schnelle Mitte früh stören. Im Angriff geduldig über „Stoßen Mitte → Einläufer RA“ spielen.",
      isSharedWithTeam: true,
    },
  });

  await prisma.scoutingNote.upsert({
    where: { id: "scouting-note-tjh-trainer-only" },
    update: { isSharedWithTeam: false },
    create: {
      id: "scouting-note-tjh-trainer-only",
      clubId: club.id,
      teamId: mjdTeam.id,
      opponentId: oppFredenbeck.id,
      eventId: nextHomeMatchId,
      createdByUserId: coachUser.id,
      title: "Interne Trainer-Notiz: Wechselrotation & Auszeit",
      content:
        "Alle 12 Spieler im Kader sollen ausreichend Einsatzzeit bekommen; auf klare Aufgaben in der 1:5-Deckung achten.",
      isSharedWithTeam: false,
    },
  });

  // 19. Schwarzes Brett, Umfragen & Mannschaftskasse (M5)
  await prisma.teamAnnouncement.upsert({
    where: { id: "ann-tjh-klecken" },
    update: {
      authorName: "Hans-Peter Lehmann",
      isPinned: true,
      audience: "ALL",
    },
    create: {
      id: "ann-tjh-klecken",
      clubId: club.id,
      teamId: mjdTeam.id,
      authorUserId: coachUser.id,
      authorName: "Hans-Peter Lehmann",
      title:
        "Auswärtsspiel in Klecken (05.12.): Treffpunkt 13:00 Uhr Max-Schmeling-Hallen",
      body: "Starkes 23:17 (12:8) am letzten Wochenende in Klecken! Am Samstag fahren wir erneut nach Klecken gegen HL Buchholz 08 - Rosengarten II. Bitte tragt euch bei den Fahrgemeinschaften ein und denkt an Trinkflaschen & Hallenschuhe (kein Harz).",
      audience: "ALL",
      isPinned: true,
    },
  });

  await prisma.teamAnnouncement.upsert({
    where: { id: "ann-tjh-staff-only" },
    update: { authorName: "Hans-Peter Lehmann", audience: "STAFF_ONLY" },
    create: {
      id: "ann-tjh-staff-only",
      clubId: club.id,
      teamId: mjdTeam.id,
      authorUserId: coachUser.id,
      authorName: "Hans-Peter Lehmann",
      title: "Trainer-Intern: Trainingsbälle & Leibchen-Bestellung",
      body: "Für die Rückrunde bestellen wir 6 neue Handbälle Größe 1 über die Jugendleitung.",
      audience: "STAFF_ONLY",
      isPinned: false,
    },
  });

  await prisma.teamPoll.upsert({
    where: { id: "poll-tjh-weihnachtsfeier" },
    update: { createdByName: "Hans-Peter Lehmann" },
    create: {
      id: "poll-tjh-weihnachtsfeier",
      clubId: club.id,
      teamId: mjdTeam.id,
      createdByUserId: coachUser.id,
      createdByName: "Hans-Peter Lehmann",
      question: "Was machen wir als Weihnachts-Teamevent der mD-Jugend?",
      allowMultiple: false,
      options: {
        create: [
          {
            id: "poll-opt-tjh-hsvh",
            label: "Gemeinsamer Besuch beim HSV Hamburg (Barclays Arena)",
            sortOrder: 0,
          },
          {
            id: "poll-opt-tjh-bowling",
            label: "Bowling & Pizza in Buchholz",
            sortOrder: 1,
          },
          {
            id: "poll-opt-tjh-halle",
            label: "Eltern-Kind-Turnier in den Max-Schmeling-Hallen",
            sortOrder: 2,
          },
        ],
      },
    },
  });

  await prisma.teamPollVote.upsert({
    where: {
      optionId_userId: {
        optionId: "poll-opt-tjh-hsvh",
        userId: coachUser.id,
      },
    },
    update: { voterName: "Hans-Peter Lehmann" },
    create: {
      optionId: "poll-opt-tjh-hsvh",
      userId: coachUser.id,
      voterName: "Hans-Peter Lehmann",
    },
  });

  const fineItems = [
    {
      id: "fine-tjh-trikot",
      title: "Trikot oder Spielhose vergessen (Kuchen/Snacks fürs Team)",
      amountCents: 300,
      category: "Spieltag",
    },
    {
      id: "fine-tjh-kabine",
      title: "Trinkflasche oder Ball in der Halle vergessen",
      amountCents: 100,
      category: "Ordnung",
    },
    {
      id: "fine-tjh-eltern-kaffee",
      title: "Freiwilliger Eltern-Beitrag Kaffeekasse",
      amountCents: 500,
      category: "Teamkasse",
    },
  ];

  for (const item of fineItems) {
    await prisma.fineCatalogItem.upsert({
      where: { id: item.id },
      update: { amountCents: item.amountCents, category: item.category },
      create: {
        id: item.id,
        clubId: club.id,
        teamId: mjdTeam.id,
        title: item.title,
        amountCents: item.amountCents,
        category: item.category,
      },
    });
  }

  await prisma.teamCashEntry.upsert({
    where: { id: "cash-tjh-starteinlage" },
    update: { status: "PAID", amountCents: 15000 },
    create: {
      id: "cash-tjh-starteinlage",
      clubId: club.id,
      teamId: mjdTeam.id,
      type: "INCOME",
      status: "PAID",
      title: "Eltern-Starteinlage Jugendkasse 2026/27",
      amountCents: 15000,
      notes: "Für Turnier-Startgelder, Obst & Saisonabschluss",
      createdByUserId: coachUser.id,
      paidAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.teamCashEntry.upsert({
    where: { id: "cash-tjh-obst" },
    update: { status: "PAID", amountCents: 2450 },
    create: {
      id: "cash-tjh-obst",
      clubId: club.id,
      teamId: mjdTeam.id,
      type: "EXPENSE",
      status: "PAID",
      title: "Äpfel, Bananen & Wasser für Auswärtsspiel Klecken",
      amountCents: 2450,
      notes: "Beleg beim Elternvertreter hinterlegt",
      createdByUserId: coachUser.id,
      paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.teamCashEntry.upsert({
    where: { id: "cash-tjh-kiosk-erloes" },
    update: { status: "PAID", amountCents: 6500 },
    create: {
      id: "cash-tjh-kiosk-erloes",
      clubId: club.id,
      teamId: mjdTeam.id,
      type: "INCOME",
      status: "PAID",
      title: "Waffelverkauf Heimspieltag Max-Schmeling-Hallen",
      amountCents: 6500,
      createdByUserId: coachUser.id,
      paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("Seeding erfolgreich abgeschlossen:");
  console.log("  Verein: TuS Jahn Hollenstedt (Saison 2026/27)");
  console.log("  Logo: /clubs/tus-jahn-hollenstedt.png");
  console.log("  Demo-Mannschaft: männliche D-Jugend (Regionsoberliga MJD Nord)");
  console.log("  nuLiga Kader: 13 Spieler + 4 Trainer/Offizielle aus den Spielberichten");
  console.log("  nuLiga Spiele importiert: 14 Spiele (inkl. Halbzeit- & Endstände)");
  console.log("  Demo-Passwort für alle Accounts:", DEMO_PASSWORD);
}

main()
  .catch((err) => {
    console.error("Fehler beim Seeding:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
