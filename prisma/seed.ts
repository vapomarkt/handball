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
  console.log("Starte idempotentes Seeding für TSV Musterstadt...");

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // 1. Demo-Benutzerkonten
  const adminUser = await upsertDemoUser({
    id: "user-tsv-admin",
    email: "admin@tsv-musterstadt.de",
    name: "Sabine Krause",
    passwordHash,
  });

  const coachUser = await upsertDemoUser({
    id: "user-tsv-coach",
    email: "trainer@tsv-musterstadt.de",
    name: "Markus Brenner",
    passwordHash,
  });

  const playerUser = await upsertDemoUser({
    id: "user-tsv-player",
    email: "spieler@tsv-musterstadt.de",
    name: "Lukas Hartmann",
    passwordHash,
  });

  const womenPlayerUser = await upsertDemoUser({
    id: "user-tsv-women-player",
    email: "spielerin@tsv-musterstadt.de",
    name: "Hannah Berger",
    passwordHash,
  });

  const parentUser = await upsertDemoUser({
    id: "user-tsv-parent",
    email: "eltern@tsv-musterstadt.de",
    name: "Katrin Weber",
    passwordHash,
  });

  // 2. Verein: TSV Musterstadt
  const club = await prisma.club.upsert({
    where: { slug: "tsv-musterstadt" },
    update: {
      name: "TSV Musterstadt",
      shortName: "TSV",
      city: "Musterstadt",
    },
    create: {
      id: "club-tsv-musterstadt",
      name: "TSV Musterstadt",
      shortName: "TSV",
      slug: "tsv-musterstadt",
      city: "Musterstadt",
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
      id: "season-2026-27",
      clubId: club.id,
      name: "2026/27",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2027-06-30T23:59:59.000Z"),
      isActive: true,
    },
  });

  // 4. Mannschaften: Herren 1, Damen 1, mC-Jugend
  const herren1 = await prisma.team.upsert({
    where: {
      clubId_seasonId_name: {
        clubId: club.id,
        seasonId: season.id,
        name: "Herren 1",
      },
    },
    update: {
      category: "Aktive",
      gender: TeamGender.MALE,
      leagueName: "Verbandsliga",
    },
    create: {
      id: "team-herren-1",
      clubId: club.id,
      seasonId: season.id,
      name: "Herren 1",
      category: "Aktive",
      gender: TeamGender.MALE,
      leagueName: "Verbandsliga",
    },
  });

  const damen1 = await prisma.team.upsert({
    where: {
      clubId_seasonId_name: {
        clubId: club.id,
        seasonId: season.id,
        name: "Damen 1",
      },
    },
    update: {
      category: "Aktive",
      gender: TeamGender.FEMALE,
      leagueName: "Landesliga",
    },
    create: {
      id: "team-damen-1",
      clubId: club.id,
      seasonId: season.id,
      name: "Damen 1",
      category: "Aktive",
      gender: TeamGender.FEMALE,
      leagueName: "Landesliga",
    },
  });

  const mcJugend = await prisma.team.upsert({
    where: {
      clubId_seasonId_name: {
        clubId: club.id,
        seasonId: season.id,
        name: "mC-Jugend",
      },
    },
    update: {
      category: "Jugend",
      gender: TeamGender.MALE,
      leagueName: "Bezirksoberliga",
    },
    create: {
      id: "team-mc-jugend",
      clubId: club.id,
      seasonId: season.id,
      name: "mC-Jugend",
      category: "Jugend",
      gender: TeamGender.MALE,
      leagueName: "Bezirksoberliga",
    },
  });

  // 5. Kader Herren 1
  await upsertTeamMember({
    id: "member-h1-admin",
    clubId: club.id,
    teamId: herren1.id,
    userId: adminUser.id,
    role: MemberRole.CLUB_ADMIN,
    firstName: "Sabine",
    lastName: "Krause",
    email: adminUser.email,
    phone: "+49 170 1112233",
    teamRoles: ["Abteilungsleitung"],
  });

  await upsertTeamMember({
    id: "member-h1-coach",
    clubId: club.id,
    teamId: herren1.id,
    userId: coachUser.id,
    role: MemberRole.COACH,
    firstName: "Markus",
    lastName: "Brenner",
    email: coachUser.email,
    phone: "+49 171 2223344",
    teamRoles: ["Cheftrainer"],
  });

  await upsertTeamMember({
    id: "member-h1-lukas",
    clubId: club.id,
    teamId: herren1.id,
    userId: playerUser.id,
    role: MemberRole.PLAYER,
    firstName: "Lukas",
    lastName: "Hartmann",
    email: playerUser.email,
    phone: "+49 172 3334455",
    jerseyNumber: 10,
    primaryPosition: HandballPosition.RM,
    secondaryPosition: HandballPosition.RL,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    teamRoles: ["Kapitän"],
    passNumber: "DHB-2026-10412",
    emergencyContact: "Anna Hartmann (+49 172 9990001)",
  });

  // Entkoppelte Kader-Profile (ohne User-Account -> über Claim-Link übernehmbar)
  const timSchneider = await upsertTeamMember({
    id: "member-h1-tim",
    clubId: club.id,
    teamId: herren1.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Tim",
    lastName: "Schneider",
    jerseyNumber: 1,
    primaryPosition: HandballPosition.TW,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    teamRoles: ["Trikot-Verantwortlicher"],
    passNumber: "DHB-2026-10401",
    emergencyContact: "Peter Schneider (+49 173 4445566)",
  });

  await upsertTeamMember({
    id: "member-h1-jonas",
    clubId: club.id,
    teamId: herren1.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Jonas",
    lastName: "Keller",
    jerseyNumber: 7,
    primaryPosition: HandballPosition.LA,
    secondaryPosition: HandballPosition.RM,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.INJURED,
    teamRoles: ["Kassenwart"],
    passNumber: "DHB-2026-10407",
    injuryNote: "Bänderdehnung im linken Sprunggelenk – voraussichtlich 3 Wochen Pause",
    emergencyContact: "Maria Keller (+49 174 5556677)",
  });

  await upsertTeamMember({
    id: "member-h1-finn",
    clubId: club.id,
    teamId: herren1.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Finn",
    lastName: "Albrecht",
    jerseyNumber: 15,
    primaryPosition: HandballPosition.RR,
    secondaryPosition: HandballPosition.RA,
    throwingHand: ThrowingHand.LEFT,
    availabilityStatus: AvailabilityStatus.FIT,
    passNumber: "DHB-2026-10415",
    emergencyContact: "Thomas Albrecht (+49 175 6667788)",
  });

  await upsertTeamMember({
    id: "member-h1-max",
    clubId: club.id,
    teamId: herren1.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Maximilian",
    lastName: "Vogt",
    jerseyNumber: 22,
    primaryPosition: HandballPosition.KM,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.UNAVAILABLE,
    injuryNote: "Beruflich auf Dienstreise bis Sonntag",
    passNumber: "DHB-2026-10422",
    emergencyContact: "Julia Vogt (+49 176 7778899)",
  });

  await upsertTeamMember({
    id: "member-h1-nico",
    clubId: club.id,
    teamId: herren1.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Nico",
    lastName: "Richter",
    jerseyNumber: 19,
    primaryPosition: HandballPosition.RA,
    throwingHand: ThrowingHand.LEFT,
    availabilityStatus: AvailabilityStatus.FIT,
    passNumber: "DHB-2026-10419",
  });

  // 6. Kader Damen 1
  await upsertTeamMember({
    id: "member-d1-hannah",
    clubId: club.id,
    teamId: damen1.id,
    userId: womenPlayerUser.id,
    role: MemberRole.PLAYER,
    firstName: "Hannah",
    lastName: "Berger",
    email: womenPlayerUser.email,
    phone: "+49 170 8889900",
    jerseyNumber: 7,
    primaryPosition: HandballPosition.LA,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    teamRoles: ["Kapitän"],
    passNumber: "DHB-2026-20107",
    emergencyContact: "Stefan Berger (+49 170 1122334)",
  });

  await upsertTeamMember({
    id: "member-d1-clara",
    clubId: club.id,
    teamId: damen1.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Clara",
    lastName: "Lindner",
    jerseyNumber: 12,
    primaryPosition: HandballPosition.TW,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    passNumber: "DHB-2026-20112",
  });

  await upsertTeamMember({
    id: "member-d1-sophia",
    clubId: club.id,
    teamId: damen1.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Sophia",
    lastName: "Meier",
    jerseyNumber: 9,
    primaryPosition: HandballPosition.RL,
    secondaryPosition: HandballPosition.RM,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    teamRoles: ["Kassenwart"],
    passNumber: "DHB-2026-20109",
  });

  // 7. Kader mC-Jugend (Multi-Team-Trainer + Eltern-Kind-Verknüpfung ohne Kinder-Login)
  await upsertTeamMember({
    id: "member-mc-coach",
    clubId: club.id,
    teamId: mcJugend.id,
    userId: coachUser.id,
    role: MemberRole.COACH,
    firstName: "Markus",
    lastName: "Brenner",
    email: coachUser.email,
    teamRoles: ["Jugendtrainer"],
  });

  await upsertTeamMember({
    id: "member-mc-parent",
    clubId: club.id,
    teamId: mcJugend.id,
    userId: parentUser.id,
    role: MemberRole.PARENT,
    firstName: "Katrin",
    lastName: "Weber",
    email: parentUser.email,
    phone: "+49 177 1234567",
  });

  const leoWeber = await upsertTeamMember({
    id: "member-mc-leo",
    clubId: club.id,
    teamId: mcJugend.id,
    userId: null, // Jugendspieler ohne eigenen Login!
    role: MemberRole.PLAYER,
    firstName: "Leo",
    lastName: "Weber",
    jerseyNumber: 14,
    primaryPosition: HandballPosition.RM,
    secondaryPosition: HandballPosition.LA,
    throwingHand: ThrowingHand.RIGHT,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
    passNumber: "DHB-JUG-2026-4414",
    emergencyContact: "Katrin Weber (+49 177 1234567)",
  });

  await upsertTeamMember({
    id: "member-mc-ben",
    clubId: club.id,
    teamId: mcJugend.id,
    userId: null,
    role: MemberRole.PLAYER,
    firstName: "Ben",
    lastName: "Schulz",
    jerseyNumber: 1,
    primaryPosition: HandballPosition.TW,
    throwingHand: ThrowingHand.BOTH,
    availabilityStatus: AvailabilityStatus.FIT,
    isMinor: true,
    passNumber: "DHB-JUG-2026-4401",
    emergencyContact: "Martin Schulz (+49 178 2345678)",
  });

  // 8. Eltern-Kind-Verknüpfung (Katrin Weber -> Leo Weber)
  await prisma.guardianLink.upsert({
    where: {
      guardianUserId_childMemberId: {
        guardianUserId: parentUser.id,
        childMemberId: leoWeber.id,
      },
    },
    update: { relationship: "Mutter" },
    create: {
      id: "guardian-katrin-leo",
      guardianUserId: parentUser.id,
      childMemberId: leoWeber.id,
      relationship: "Mutter",
    },
  });

  // 9. Demo-Einladungslinks (Team-Beitritt & persönlicher Claim-Link)
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  await prisma.teamInvite.upsert({
    where: { token: "demo-herren1-join" },
    update: { expiresAt, revokedAt: null },
    create: {
      id: "invite-demo-herren1",
      clubId: club.id,
      teamId: herren1.id,
      token: "demo-herren1-join",
      type: InviteType.TEAM_JOIN,
      role: MemberRole.PLAYER,
      createdByUserId: coachUser.id,
      maxUses: 50,
      expiresAt,
    },
  });

  await prisma.teamInvite.upsert({
    where: { token: "demo-claim-tim-schneider" },
    update: { expiresAt, revokedAt: null },
    create: {
      id: "invite-demo-claim-tim",
      clubId: club.id,
      teamId: herren1.id,
      token: "demo-claim-tim-schneider",
      type: InviteType.PROFILE_CLAIM,
      role: MemberRole.PLAYER,
      targetMemberId: timSchneider.id,
      createdByUserId: coachUser.id,
      maxUses: 1,
      expiresAt,
    },
  });

  // 10. Hallen (M2a) inkl. Harz-/Haftmittel-Regelung
  const heimHalle = await prisma.venue.upsert({
    where: { id: "venue-sporthalle-sued" },
    update: {
      name: "Sporthalle Musterstadt-Süd",
      address: "Sportparkstraße 12, 12345 Musterstadt",
      mapsUrl: "https://maps.google.com/?q=Sportparkstrasse+12+Musterstadt",
      resinPolicy: ResinPolicy.RESIN_ALLOWED,
      notes: "Heimhalle TSV Musterstadt · Harz erlaubt (Ausgabe durch Hallenwart), abriebfeste Sohlen.",
    },
    create: {
      id: "venue-sporthalle-sued",
      clubId: club.id,
      name: "Sporthalle Musterstadt-Süd",
      address: "Sportparkstraße 12, 12345 Musterstadt",
      mapsUrl: "https://maps.google.com/?q=Sportparkstrasse+12+Musterstadt",
      resinPolicy: ResinPolicy.RESIN_ALLOWED,
      notes: "Heimhalle TSV Musterstadt · Harz erlaubt (Ausgabe durch Hallenwart), abriebfeste Sohlen.",
    },
  });

  const schulHalle = await prisma.venue.upsert({
    where: { id: "venue-schulhalle-park" },
    update: {
      name: "Schulsporthalle Am Park",
      address: "Parkallee 4, 12345 Musterstadt",
      mapsUrl: "https://maps.google.com/?q=Parkallee+4+Musterstadt",
      resinPolicy: ResinPolicy.WATER_SOLUBLE_ONLY,
      notes: "Nur wasserlösliches Haftmittel erlaubt. Kabinenschlüssel beim Trainer.",
    },
    create: {
      id: "venue-schulhalle-park",
      clubId: club.id,
      name: "Schulsporthalle Am Park",
      address: "Parkallee 4, 12345 Musterstadt",
      mapsUrl: "https://maps.google.com/?q=Parkallee+4+Musterstadt",
      resinPolicy: ResinPolicy.WATER_SOLUBLE_ONLY,
      notes: "Nur wasserlösliches Haftmittel erlaubt. Kabinenschlüssel beim Trainer.",
    },
  });

  const auswaertsHalle = await prisma.venue.upsert({
    where: { id: "venue-dreifeld-nachbarstadt" },
    update: {
      name: "Dreifeldhalle Nachbarstadt",
      address: "Am Stadion 8, 12399 Nachbarstadt",
      mapsUrl: "https://maps.google.com/?q=Am+Stadion+8+Nachbarstadt",
      resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
      notes: "Striktes Harzverbot! Bei Verstoß droht Hallensperre und Reinigungsgebühr.",
    },
    create: {
      id: "venue-dreifeld-nachbarstadt",
      clubId: club.id,
      name: "Dreifeldhalle Nachbarstadt",
      address: "Am Stadion 8, 12399 Nachbarstadt",
      mapsUrl: "https://maps.google.com/?q=Am+Stadion+8+Nachbarstadt",
      resinPolicy: ResinPolicy.RESIN_FORBIDDEN,
      notes: "Striktes Harzverbot! Bei Verstoß droht Hallensperre und Reinigungsgebühr.",
    },
  });

  // Hilfsfunktion für relative Termine
  const daysFromNow = (days: number, hour: number, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  // 11. Termine & Spieltage Herren 1 (M2a)
  const h1TrainingNext = await prisma.event.upsert({
    where: { id: "event-h1-training-next" },
    update: {
      title: "Mannschaftstraining Herren 1",
      venueId: heimHalle.id,
      startAt: daysFromNow(2, 19, 30),
      endAt: daysFromNow(2, 21, 0),
      rsvpDeadlineAt: daysFromNow(2, 16, 0),
      requireDeclineReason: true,
    },
    create: {
      id: "event-h1-training-next",
      clubId: club.id,
      teamId: herren1.id,
      venueId: heimHalle.id,
      type: EventType.TRAINING,
      title: "Mannschaftstraining Herren 1",
      description: "Schwerpunkt: 6:0-Abwehrverschieben und erste/zweite Welle.",
      startAt: daysFromNow(2, 19, 30),
      endAt: daysFromNow(2, 21, 0),
      rsvpDeadlineAt: daysFromNow(2, 16, 0),
      requireDeclineReason: true,
    },
  });

  const h1MatchHome = await prisma.event.upsert({
    where: { id: "event-h1-match-home" },
    update: {
      title: "Herren 1 vs. SG Neustadt",
      venueId: heimHalle.id,
      startAt: daysFromNow(5, 19, 0),
      endAt: daysFromNow(5, 20, 45),
      meetingAt: daysFromNow(5, 17, 45),
      rsvpDeadlineAt: daysFromNow(4, 18, 0),
      requireDeclineReason: true,
    },
    create: {
      id: "event-h1-match-home",
      clubId: club.id,
      teamId: herren1.id,
      venueId: heimHalle.id,
      type: EventType.MATCH,
      title: "Herren 1 vs. SG Neustadt",
      description: "Verbandsliga Heimspiel – bitte pünktlich zum Aufwärmen in der Halle sein.",
      startAt: daysFromNow(5, 19, 0),
      endAt: daysFromNow(5, 20, 45),
      meetingAt: daysFromNow(5, 17, 45),
      rsvpDeadlineAt: daysFromNow(4, 18, 0),
      requireDeclineReason: true,
    },
  });

  await prisma.matchDetails.upsert({
    where: { eventId: h1MatchHome.id },
    update: {
      opponentName: "SG Neustadt",
      isHome: true,
      throwOffAt: daysFromNow(5, 19, 0),
      jerseyColor: "Orange / Schwarz (Heim)",
      refereeNote: "SR-Gespann Becker / Hoffmann (Bezirk Nord)",
      nominatedMemberIds: [
        "member-h1-lukas",
        "member-h1-tim",
        "member-h1-finn",
        "member-h1-nico",
      ],
    },
    create: {
      id: "match-h1-home",
      eventId: h1MatchHome.id,
      opponentName: "SG Neustadt",
      isHome: true,
      throwOffAt: daysFromNow(5, 19, 0),
      jerseyColor: "Orange / Schwarz (Heim)",
      refereeNote: "SR-Gespann Becker / Hoffmann (Bezirk Nord)",
      nominatedMemberIds: [
        "member-h1-lukas",
        "member-h1-tim",
        "member-h1-finn",
        "member-h1-nico",
      ],
    },
  });

  const h1MatchAway = await prisma.event.upsert({
    where: { id: "event-h1-match-away" },
    update: {
      title: "TV Nachbarstadt vs. Herren 1",
      venueId: auswaertsHalle.id,
      startAt: daysFromNow(12, 18, 0),
      endAt: daysFromNow(12, 19, 45),
      meetingAt: daysFromNow(12, 16, 30),
    },
    create: {
      id: "event-h1-match-away",
      clubId: club.id,
      teamId: herren1.id,
      venueId: auswaertsHalle.id,
      type: EventType.MATCH,
      title: "TV Nachbarstadt vs. Herren 1",
      description: "Achtung: Auswärtshalle mit striktem Harzverbot!",
      startAt: daysFromNow(12, 18, 0),
      endAt: daysFromNow(12, 19, 45),
      meetingAt: daysFromNow(12, 16, 30),
    },
  });

  await prisma.matchDetails.upsert({
    where: { eventId: h1MatchAway.id },
    update: {
      opponentName: "TV Nachbarstadt",
      isHome: false,
      throwOffAt: daysFromNow(12, 18, 0),
      jerseyColor: "Weiß / Navy (Auswärts)",
      refereeNote: "Ansetzung folgt",
    },
    create: {
      id: "match-h1-away",
      eventId: h1MatchAway.id,
      opponentName: "TV Nachbarstadt",
      isHome: false,
      throwOffAt: daysFromNow(12, 18, 0),
      jerseyColor: "Weiß / Navy (Auswärts)",
      refereeNote: "Ansetzung folgt",
    },
  });

  const h1MatchPast = await prisma.event.upsert({
    where: { id: "event-h1-match-past" },
    update: {
      title: "Herren 1 vs. HSG Bergland",
      venueId: heimHalle.id,
      startAt: daysFromNow(-4, 19, 0),
      endAt: daysFromNow(-4, 20, 45),
    },
    create: {
      id: "event-h1-match-past",
      clubId: club.id,
      teamId: herren1.id,
      venueId: heimHalle.id,
      type: EventType.MATCH,
      title: "Herren 1 vs. HSG Bergland",
      startAt: daysFromNow(-4, 19, 0),
      endAt: daysFromNow(-4, 20, 45),
    },
  });

  await prisma.matchDetails.upsert({
    where: { eventId: h1MatchPast.id },
    update: {
      opponentName: "HSG Bergland",
      isHome: true,
      throwOffAt: daysFromNow(-4, 19, 0),
      jerseyColor: "Orange / Schwarz (Heim)",
      homeScoreHalf: 14,
      awayScoreHalf: 12,
      homeScoreFull: 29,
      awayScoreFull: 25,
      nominatedMemberIds: [
        "member-h1-lukas",
        "member-h1-tim",
        "member-h1-finn",
        "member-h1-nico",
      ],
    },
    create: {
      id: "match-h1-past",
      eventId: h1MatchPast.id,
      opponentName: "HSG Bergland",
      isHome: true,
      throwOffAt: daysFromNow(-4, 19, 0),
      jerseyColor: "Orange / Schwarz (Heim)",
      homeScoreHalf: 14,
      awayScoreHalf: 12,
      homeScoreFull: 29,
      awayScoreFull: 25,
      nominatedMemberIds: [
        "member-h1-lukas",
        "member-h1-tim",
        "member-h1-finn",
        "member-h1-nico",
      ],
    },
  });

  // 12. Termine mC-Jugend (für Eltern-Kind RSVP-Flow)
  const mcTrainingNext = await prisma.event.upsert({
    where: { id: "event-mc-training-next" },
    update: {
      title: "Jugendtraining mC-Jugend",
      venueId: schulHalle.id,
      startAt: daysFromNow(3, 17, 30),
      endAt: daysFromNow(3, 19, 0),
      rsvpDeadlineAt: daysFromNow(3, 14, 0),
    },
    create: {
      id: "event-mc-training-next",
      clubId: club.id,
      teamId: mcJugend.id,
      venueId: schulHalle.id,
      type: EventType.TRAINING,
      title: "Jugendtraining mC-Jugend",
      description: "Koordination, 1-gegen-1 und Wurftraining.",
      startAt: daysFromNow(3, 17, 30),
      endAt: daysFromNow(3, 19, 0),
      rsvpDeadlineAt: daysFromNow(3, 14, 0),
    },
  });

  // 13. Realistische RSVP-Rückmeldungen (inkl. DSGVO-geschützter Absagegründe)
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

  await upsertRsvp(h1TrainingNext.id, "member-h1-lukas", RsvpStatus.ACCEPTED);
  await upsertRsvp(h1TrainingNext.id, "member-h1-tim", RsvpStatus.ACCEPTED);
  await upsertRsvp(h1TrainingNext.id, "member-h1-finn", RsvpStatus.ACCEPTED);
  await upsertRsvp(h1TrainingNext.id, "member-h1-nico", RsvpStatus.MAYBE);
  await upsertRsvp(
    h1TrainingNext.id,
    "member-h1-jonas",
    RsvpStatus.DECLINED,
    DeclineReasonCategory.INJURY,
    "Bänderdehnung im linken Sprunggelenk – Physiotherapie"
  );
  await upsertRsvp(
    h1TrainingNext.id,
    "member-h1-max",
    RsvpStatus.DECLINED,
    DeclineReasonCategory.WORK,
    "Dienstreise bis Sonntag"
  );

  await upsertRsvp(h1MatchHome.id, "member-h1-lukas", RsvpStatus.ACCEPTED);
  await upsertRsvp(h1MatchHome.id, "member-h1-tim", RsvpStatus.ACCEPTED);
  await upsertRsvp(h1MatchHome.id, "member-h1-finn", RsvpStatus.ACCEPTED);
  await upsertRsvp(
    h1MatchHome.id,
    "member-h1-jonas",
    RsvpStatus.DECLINED,
    DeclineReasonCategory.INJURY,
    "Noch im Aufbautraining nach Bänderdehnung"
  );

  await upsertRsvp(h1MatchPast.id, "member-h1-lukas", RsvpStatus.ACCEPTED);
  await upsertRsvp(h1MatchPast.id, "member-h1-tim", RsvpStatus.ACCEPTED);
  await upsertRsvp(h1MatchPast.id, "member-h1-finn", RsvpStatus.ACCEPTED);
  await upsertRsvp(h1MatchPast.id, "member-h1-nico", RsvpStatus.ACCEPTED);

  await upsertRsvp(mcTrainingNext.id, leoWeber.id, RsvpStatus.PENDING);

  // 14. Liga-Importquelle & Change-Log Demo (M2b)
  const h1Source = await prisma.leagueImportSource.upsert({
    where: { id: "source-h1-nuliga-ical" },
    update: {
      name: "nuLiga Verbandsliga Herren 1 (iCal)",
      teamNameMatch: "TSV Musterstadt",
      isEnabled: true,
      syncIntervalMinutes: 60,
    },
    create: {
      id: "source-h1-nuliga-ical",
      clubId: club.id,
      teamId: herren1.id,
      provider: LeagueProviderType.ICAL_URL,
      name: "nuLiga Verbandsliga Herren 1 (iCal)",
      sourceUrl: "https://example.invalid/nuliga-herren1-2026-27.ics",
      teamNameMatch: "TSV Musterstadt",
      isEnabled: true,
      syncIntervalMinutes: 60,
      lastSyncedAt: new Date(),
      lastSyncStatus: SyncStatus.SUCCESS,
    },
  });

  await prisma.leagueSyncChangeLog.upsert({
    where: { id: "changelog-h1-demo-1" },
    update: {
      summary: "Spielverlegung (TV Nachbarstadt vs. Herren 1): Anwurf von 17:30 auf 18:00 Uhr verlegt",
    },
    create: {
      id: "changelog-h1-demo-1",
      sourceId: h1Source.id,
      teamId: herren1.id,
      eventId: h1MatchAway.id,
      externalId: "nuliga-2026-h1-away-01",
      changeType: SyncChangeType.RESCHEDULED,
      summary: "Spielverlegung (TV Nachbarstadt vs. Herren 1): Anwurf von 17:30 auf 18:00 Uhr verlegt",
      oldStartAt: daysFromNow(12, 17, 30),
      newStartAt: daysFromNow(12, 18, 0),
      oldVenueName: "Dreifeldhalle Nachbarstadt",
      newVenueName: "Dreifeldhalle Nachbarstadt",
    },
  });

  // 15. Fahrgemeinschaften für Auswärtsspiel (M2b)
  const h1Carpool = await prisma.carpool.upsert({
    where: { id: "carpool-h1-away-lukas" },
    update: {
      departureLocation: "Parkplatz Sporthalle Musterstadt-Süd",
      departureTime: "16:15 Uhr",
      totalSeats: 3,
      notes: "Kombi mit Platz für 3 Sporttaschen + Harzkoffer (bleibt im Auto).",
    },
    create: {
      id: "carpool-h1-away-lukas",
      eventId: h1MatchAway.id,
      driverMemberId: "member-h1-lukas",
      departureLocation: "Parkplatz Sporthalle Musterstadt-Süd",
      departureTime: "16:15 Uhr",
      totalSeats: 3,
      notes: "Kombi mit Platz für 3 Sporttaschen + Harzkoffer (bleibt im Auto).",
    },
  });

  await prisma.carpoolBooking.upsert({
    where: {
      carpoolId_passengerMemberId: {
        carpoolId: h1Carpool.id,
        passengerMemberId: "member-h1-finn",
      },
    },
    update: {},
    create: {
      id: "booking-h1-away-finn",
      carpoolId: h1Carpool.id,
      passengerMemberId: "member-h1-finn",
      bookedByUserId: coachUser.id,
    },
  });

  // 16. Heimspieltag & Zweistufige Vereinsarbeitseinsätze (M3)
  const matchday = await prisma.matchday.upsert({
    where: { id: "matchday-tsv-samstag" },
    update: {
      title: "Heimspieltag Samstag – Sporthalle Musterstadt-Süd",
      date: daysFromNow(5, 14, 0),
      venueId: heimHalle.id,
    },
    create: {
      id: "matchday-tsv-samstag",
      clubId: club.id,
      seasonId: season.id,
      venueId: heimHalle.id,
      title: "Heimspieltag Samstag – Sporthalle Musterstadt-Süd",
      date: daysFromNow(5, 14, 0),
      notes: "Heimspiele von mC-Jugend (15:00), Damen 1 (17:00) und Herren 1 (19:00).",
    },
  });

  // Delegierter Vereinsdienst: Herren 1 stellt Kampfgericht für Damen 1!
  await prisma.workDuty.upsert({
    where: { id: "duty-kampfg-damen1" },
    update: {
      title: "Kampfgericht (Zeitnehmer) – Damen 1",
      startAt: daysFromNow(5, 16, 45),
      endAt: daysFromNow(5, 18, 45),
      assignedTeamId: herren1.id,
    },
    create: {
      id: "duty-kampfg-damen1",
      clubId: club.id,
      matchdayId: matchday.id,
      scope: DutyScope.CLUB_MATCHDAY,
      category: DutyCategory.TIMEKEEPER,
      title: "Kampfgericht (Zeitnehmer) – Damen 1",
      description: "Delegiert an Herren 1: Zeitnehmer-Lizenz (Z/S) erforderlich.",
      startAt: daysFromNow(5, 16, 45),
      endAt: daysFromNow(5, 18, 45),
      hoursCredit: 2.5,
      requiresLicense: true,
      slotsNeeded: 1,
      assignedTeamId: herren1.id,
    },
  });

  // Kiosk-Dienst mit aktiver Tauschbörsen-Anfrage
  const kioskDuty = await prisma.workDuty.upsert({
    where: { id: "duty-kiosk-samstag" },
    update: {
      title: "Kiosk / Theke – Schicht 1",
      startAt: daysFromNow(5, 14, 30),
      endAt: daysFromNow(5, 17, 0),
    },
    create: {
      id: "duty-kiosk-samstag",
      clubId: club.id,
      matchdayId: matchday.id,
      scope: DutyScope.CLUB_MATCHDAY,
      category: DutyCategory.KIOSK,
      title: "Kiosk / Theke – Schicht 1",
      description: "Kaffee, Brezeln & Getränke während mC-Jugend und Damen 1.",
      startAt: daysFromNow(5, 14, 30),
      endAt: daysFromNow(5, 17, 0),
      hoursCredit: 2.0,
      requiresLicense: false,
      slotsNeeded: 2,
    },
  });

  await prisma.workDutyAssignment.upsert({
    where: { id: "assignment-kiosk-katrin" },
    update: {
      status: DutyAssignmentStatus.SWAP_REQUESTED,
      swapNote: "Kann erst ab 17:00 Uhr in der Halle sein – tausche gern gegen Schicht 2!",
    },
    create: {
      id: "assignment-kiosk-katrin",
      dutyId: kioskDuty.id,
      assignedMemberId: "member-mc-parent",
      status: DutyAssignmentStatus.SWAP_REQUESTED,
      swapNote: "Kann erst ab 17:00 Uhr in der Halle sein – tausche gern gegen Schicht 2!",
    },
  });

  // Team-Dienst: Trikotwäsche bereits erledigt (Gutschrift im Arbeitsstunden-Konto)
  const laundryDuty = await prisma.workDuty.upsert({
    where: { id: "duty-trikot-h1" },
    update: {
      title: "Trikotwäsche Herren 1 (Heimspiel HSG Bergland)",
    },
    create: {
      id: "duty-trikot-h1",
      clubId: club.id,
      teamId: herren1.id,
      eventId: h1MatchPast.id,
      scope: DutyScope.TEAM,
      category: DutyCategory.JERSEY_LAUNDRY,
      title: "Trikotwäsche Herren 1 (Heimspiel HSG Bergland)",
      description: "Kompletter Heim-Trikotsatz gewaschen und gezählt.",
      hoursCredit: 1.5,
      requiresLicense: false,
      slotsNeeded: 1,
    },
  });

  await prisma.workDutyAssignment.upsert({
    where: { id: "assignment-trikot-lukas" },
    update: {
      status: DutyAssignmentStatus.COMPLETED,
    },
    create: {
      id: "assignment-trikot-lukas",
      dutyId: laundryDuty.id,
      assignedMemberId: "member-h1-lukas",
      status: DutyAssignmentStatus.COMPLETED,
      completedAt: daysFromNow(-2, 18, 0),
    },
  });

  // 17. Übungsbibliothek & Trainingsplan (M3)
  const drillWarmup = await prisma.drill.upsert({
    where: { id: "drill-tw-konter" },
    update: {},
    create: {
      id: "drill-tw-konter",
      clubId: club.id,
      createdByUserId: coachUser.id,
      title: "Torwart-Einwerfen & 1.-Welle-Konterpass",
      description: "Halbhohe und flache Würfe von 9m, direkt gefolgt von präzisem Langpass auf den startenden Außen.",
      phase: TrainingPhaseType.WARMUP,
      durationMinutes: 15,
      tags: ["Torwart", "Gegenstoß", "Wurftraining"],
      equipment: "12 Handbälle, 4 Hütchen",
    },
  });

  const drillDefense = await prisma.drill.upsert({
    where: { id: "drill-6-0-verschieben" },
    update: {},
    create: {
      id: "drill-6-0-verschieben",
      clubId: club.id,
      createdByUserId: coachUser.id,
      title: "6:0-Abwehr: Verschieben, Helfen & Übergeben",
      description: "4-gegen-4 im Mittelblock mit Fokus auf Kommunikation beim Kreuzen und Kreis-Übergabe.",
      phase: TrainingPhaseType.TACTICS,
      durationMinutes: 25,
      tags: ["6:0-Abwehr", "1-gegen-1", "Kreisanspiel"],
      equipment: "Leibchen (2 Farben), 6 Bälle",
    },
  });

  const drillGameForm = await prisma.drill.upsert({
    where: { id: "drill-ueberzahl-6-5" },
    update: {},
    create: {
      id: "drill-ueberzahl-6-5",
      clubId: club.id,
      createdByUserId: coachUser.id,
      title: "Überzahl 6-gegen-5 bis zur klaren Außenchance",
      description: "Schnelles Durchstoßen auf die Nahtstellen, Weiterspielen bis LA/RA freien Winkel erhält.",
      phase: TrainingPhaseType.GAME_FORM,
      durationMinutes: 25,
      tags: ["Überzahl", "Wurftraining"],
      equipment: "Leibchen, 8 Bälle, Zeitnahme",
    },
  });

  await prisma.trainingPlan.upsert({
    where: { id: "plan-h1-sg-neustadt" },
    update: {
      title: "Vorbereitung SG Neustadt – 6:0-Abwehr & 1. Welle",
      isSharedWithTeam: true,
    },
    create: {
      id: "plan-h1-sg-neustadt",
      clubId: club.id,
      teamId: herren1.id,
      eventId: h1TrainingNext.id,
      createdByUserId: coachUser.id,
      title: "Vorbereitung SG Neustadt – 6:0-Abwehr & 1. Welle",
      focus: "Kompakter Innenblock gegen wurfstarken Rückraum & schnelles Umschalten",
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
          notes: "Hohe Passqualität beim Gegenstoßpass einfordern.",
        },
        {
          id: "ph-2",
          phase: "TECHNIQUE",
          title: "Pass-Kontinuität & Täuschung 1-gegen-1",
          durationMinutes: 15,
          equipment: "Hütchen, 10 Bälle",
          notes: "Beidseitige Körpertäuschung aus dem Lauf.",
        },
        {
          id: "ph-3",
          phase: "TACTICS",
          title: drillDefense.title,
          durationMinutes: 25,
          drillId: drillDefense.id,
          equipment: drillDefense.equipment,
          notes: "Lautstarke Ansage bei jedem Einläufer.",
        },
        {
          id: "ph-4",
          phase: "GAME_FORM",
          title: drillGameForm.title,
          durationMinutes: 25,
          drillId: drillGameForm.id,
          equipment: drillGameForm.equipment,
          notes: "Zählt doppelt bei Tor von Außen nach Gegenstoß.",
        },
        {
          id: "ph-5",
          phase: "COOLDOWN",
          title: "Auslaufen, Mobilisation & kurze Spieltags-Ansprache",
          durationMinutes: 10,
          notes: "Fokus auf Regeneration für Samstag.",
        },
      ],
    },
  });

  // 18. Interaktives Handball-Playbook (M4) – 3 Spielzüge inkl. 3-Schritt-Animation
  const kreuzungPlay = await prisma.tacticPlay.upsert({
    where: { id: "tactic-kreuzung-einlaeufer" },
    update: {
      title: "Auslösehandlung „Kreuzung Links → Einläufer RA“",
      isSharedWithTeam: true,
    },
    create: {
      id: "tactic-kreuzung-einlaeufer",
      clubId: club.id,
      teamId: herren1.id,
      createdByUserId: coachUser.id,
      title: "Auslösehandlung „Kreuzung Links → Einläufer RA“",
      description:
        "Klassische Auslösehandlung gegen kompakte 6:0-Abwehr: RM und RL kreuzen links, KM sperrt Innenblock 4, RA läuft auf die Nahtstelle ein.",
      category: TacticCategory.TRIGGER_PLAY,
      courtMode: CourtMode.HALF_COURT,
      tags: ["6:0-Abwehr", "Auslösehandlung", "Einläufer"],
      isSharedWithTeam: true,
      boardData: {
        version: 1,
        keyframes: [
          {
            id: "kf-1",
            label: "1. Auftakt & Kreuzung Links",
            notes: "RM stößt auf die Nahtstelle 2/3, RL kreuzt mit Tempo hinter RM.",
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
              { id: "d2", kind: "DEFENDER", label: "2", x: 330, y: 345 },
              { id: "d3", kind: "DEFENDER", label: "3", x: 445, y: 375 },
              { id: "d4", kind: "DEFENDER", label: "4", x: 555, y: 375 },
              { id: "d5", kind: "DEFENDER", label: "5", x: 670, y: 345 },
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
            label: "2. Sperre KM & Einläufer RA",
            notes: "RL übernimmt auf Mitte, KM stellt Sperre gegen Abwehr 4, RA läuft hinter dem Block ein.",
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
              { id: "d3", kind: "DEFENDER", label: "3", x: 455, y: 410 },
              { id: "d4", kind: "DEFENDER", label: "4", x: 570, y: 375 },
              { id: "d5", kind: "DEFENDER", label: "5", x: 685, y: 355 },
              { id: "d6", kind: "DEFENDER", label: "6", x: 790, y: 290 },
              { id: "ball", kind: "BALL", label: "", x: 495, y: 530 },
            ],
            drawings: [
              { id: "d-scr-km", kind: "SCREEN", x1: 565, y1: 390, x2: 575, y2: 355 },
              { id: "d-run-ra", kind: "RUN", x1: 720, y1: 350, x2: 615, y2: 430 },
              { id: "d-pass-2", kind: "PASS", x1: 495, y1: 530, x2: 615, y2: 430 },
            ],
          },
          {
            id: "kf-3",
            label: "3. Abschluss am 6m-Kreis",
            notes: "RA erhält das Anspiel in die freie Lücke und schließt frei vor dem Torwart ab.",
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
    where: { id: "tactic-gegenstoss-welle" },
    update: {
      title: "Gegenstoß 1. & 2. Welle (Ganzfeld)",
      isSharedWithTeam: true,
    },
    create: {
      id: "tactic-gegenstoss-welle",
      clubId: club.id,
      teamId: herren1.id,
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

  // Trainer-only Entwurf (nicht fürs Team freigegeben -> RBAC-Test)
  await prisma.tacticPlay.upsert({
    where: { id: "tactic-draft-7-6" },
    update: { isSharedWithTeam: false },
    create: {
      id: "tactic-draft-7-6",
      clubId: club.id,
      teamId: herren1.id,
      createdByUserId: coachUser.id,
      title: "Geheimvariante 7-gegen-6 (Entwurf)",
      description: "Nur für Trainerteam sichtbar bis zur Freigabe vor dem Rückspiel.",
      category: TacticCategory.POWERPLAY_7_6,
      courtMode: CourtMode.HALF_COURT,
      tags: ["7-gegen-6", "Entwurf"],
      isSharedWithTeam: false,
      boardData: {
        version: 1,
        keyframes: [
          {
            id: "kf-76",
            label: "7-gegen-6 Grundstellung",
            notes: "Zwei Kreisläufer binden Innenblock 3 & 4.",
            durationMs: 1400,
            tokens: [
              { id: "la", kind: "ATTACKER", label: "LA", x: 110, y: 245 },
              { id: "rl", kind: "ATTACKER", label: "RL", x: 255, y: 610 },
              { id: "rm", kind: "ATTACKER", label: "RM", x: 500, y: 690 },
              { id: "rr", kind: "ATTACKER", label: "RR", x: 745, y: 610 },
              { id: "ra", kind: "ATTACKER", label: "RA", x: 890, y: 245 },
              { id: "km1", kind: "ATTACKER", label: "KM", x: 565, y: 365 },
              { id: "km2", kind: "ATTACKER", label: "KM2", x: 385, y: 365 },
              { id: "ball", kind: "BALL", label: "", x: 530, y: 655 },
            ],
            drawings: [],
          },
        ],
      },
    },
  });

  // 19. Gegner-Scouting Dossier: SG Neustadt (M4)
  const oppNeustadt = await prisma.opponent.upsert({
    where: { id: "opponent-sg-neustadt" },
    update: {
      name: "SG Neustadt",
      leagueName: "Verbandsliga",
    },
    create: {
      id: "opponent-sg-neustadt",
      clubId: club.id,
      teamId: herren1.id,
      name: "SG Neustadt",
      leagueName: "Verbandsliga",
      defenseSystems: ["6:0 kompakt", "5:1 offensiv"],
      attackSystems: ["Kreuzung Rückraum", "Übergang 2. Kreis", "Schnelle Mitte"],
      transitionNotes:
        "Sehr starke schnelle Mitte nach Gegentoren; im Rückzug oft ungeordnet auf der linken Abwehrseite.",
      strengths:
        "Wurfgewaltiger Rückraum Links (#11) und starkes Zusammenspiel mit Kreisläufer #23.",
      weaknesses:
        "Anfällig gegen Einläufer von Rechtsaußen und Tempospiel in die 2. Welle.",
      generalNotes: "Hinspiel knapp 27:28 verloren – Rückspiel zuhause mit Harz klarer Vorteil für uns.",
    },
  });

  await prisma.opponentPlayer.upsert({
    where: { id: "opp-player-koenig" },
    update: {},
    create: {
      id: "opp-player-koenig",
      opponentId: oppNeustadt.id,
      name: "Lukas König",
      jerseyNumber: 11,
      position: HandballPosition.RL,
      throwingHand: ThrowingHand.RIGHT,
      isSevenMeterShooter: true,
      threatLevel: ThreatLevel.HIGH,
      feintPreference: "Geht fast immer über rechts in den Stemmwurf; bei 7m bevorzugt oben rechts.",
      notes: "Früh auf 9m annehmen, keinen freien Anlauf lassen!",
      shotZones: {
        topLeft: 15,
        topCenter: 10,
        topRight: 85,
        midLeft: 20,
        midCenter: 5,
        midRight: 30,
        botLeft: 70,
        botCenter: 10,
        botRight: 25,
      },
    },
  });

  await prisma.opponentPlayer.upsert({
    where: { id: "opp-player-bauer" },
    update: {},
    create: {
      id: "opp-player-bauer",
      opponentId: oppNeustadt.id,
      name: "Jonas Bauer",
      jerseyNumber: 23,
      position: HandballPosition.KM,
      throwingHand: ThrowingHand.LEFT,
      isSevenMeterShooter: false,
      threatLevel: ThreatLevel.MEDIUM,
      feintPreference: "Dreht nach Sperre fast immer zur linken Wurfhand ab.",
      notes: "Stellt breite Sperren am 6m-Kreis; beim Übergeben eng am Körper bleiben.",
      shotZones: {
        topLeft: 45,
        topCenter: 10,
        topRight: 20,
        midLeft: 30,
        midCenter: 10,
        midRight: 15,
        botLeft: 65,
        botCenter: 35,
        botRight: 50,
      },
    },
  });

  // Freigegebener Matchplan am Heimspiel gegen SG Neustadt (mit Taktik-Verknüpfung!)
  await prisma.scoutingNote.upsert({
    where: { id: "scouting-note-matchplan-shared" },
    update: { isSharedWithTeam: true },
    create: {
      id: "scouting-note-matchplan-shared",
      clubId: club.id,
      teamId: herren1.id,
      opponentId: oppNeustadt.id,
      eventId: h1MatchHome.id,
      tacticPlayId: kreuzungPlay.id,
      createdByUserId: coachUser.id,
      title: "Matchplan Heimspiel SG Neustadt",
      content:
        "Fokus Abwehr: #11 Lukas König offensiv auf 9m stören und rechte Wurfhand zumachen. Im Angriff konsequent über unsere Auslösehandlung „Kreuzung Links → Einläufer RA“ die Lücke neben Innenblock 4 attackieren.",
      videoUrl: "https://example.invalid/video/hinspiel-sg-neustadt-highlights",
      isSharedWithTeam: true,
    },
  });

  // Trainer-only Scouting-Notiz (für Spieler NICHT sichtbar!)
  await prisma.scoutingNote.upsert({
    where: { id: "scouting-note-trainer-only" },
    update: { isSharedWithTeam: false },
    create: {
      id: "scouting-note-trainer-only",
      clubId: club.id,
      teamId: herren1.id,
      opponentId: oppNeustadt.id,
      eventId: h1MatchHome.id,
      createdByUserId: coachUser.id,
      title: "Interne Trainer-Notiz: Auszeit-Plan & Torwartwechsel",
      content:
        "Geheim-Taktik: Falls SG Neustadt auf 5:1 umstellt, sofort Auszeit nehmen und auf 7-gegen-6 wechseln.",
      isSharedWithTeam: false,
    },
  });

  // ==========================================================================
  // 11. Meilenstein 5: Schwarzes Brett, Umfragen & Mannschaftskasse
  // ==========================================================================
  await prisma.teamAnnouncement.upsert({
    where: { id: "ann-h1-heimspiel" },
    update: { isPinned: true, audience: "ALL" },
    create: {
      id: "ann-h1-heimspiel",
      clubId: club.id,
      teamId: herren1.id,
      authorUserId: coachUser.id,
      authorName: "Markus Brenner",
      title: "Heimspieltag Samstag: Neue Aufwärm-Shirts liegen in Kabine 2",
      body: "Bitte 60 Minuten vor Anwurf in der Sporthalle Musterstadt-Süd sein. Wir testen vorab die Auslösehandlung aus dem Playbook. Nach dem Spiel gemeinsamer Ausklang am Kiosk.",
      audience: "ALL",
      isPinned: true,
    },
  });

  await prisma.teamAnnouncement.upsert({
    where: { id: "ann-h1-staff-only" },
    update: { audience: "STAFF_ONLY" },
    create: {
      id: "ann-h1-staff-only",
      clubId: club.id,
      teamId: herren1.id,
      authorUserId: coachUser.id,
      authorName: "Markus Brenner",
      title: "Trainer-Intern: Belastungssteuerung Rückraum vor Pokalspiel",
      body: "Interne Abstimmung Trainerteam: Lukas am Donnerstag nach 60 Min. aus der 6-gegen-6-Einheit nehmen.",
      audience: "STAFF_ONLY",
      isPinned: false,
    },
  });

  await prisma.teamPoll.upsert({
    where: { id: "poll-h1-mannschaftsfahrt" },
    update: {},
    create: {
      id: "poll-h1-mannschaftsfahrt",
      clubId: club.id,
      teamId: herren1.id,
      createdByUserId: coachUser.id,
      createdByName: "Markus Brenner",
      question: "Wohin geht unsere Saisonabschluss-Fahrt 2027?",
      allowMultiple: false,
      options: {
        create: [
          { id: "poll-opt-mallorca", label: "Mallorca (3 Tage)", sortOrder: 0 },
          { id: "poll-opt-hamburg", label: "Hamburg inkl. Bundesliga-Spiel", sortOrder: 1 },
          { id: "poll-opt-huette", label: "Hüttenwochenende Allgäu", sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.teamPollVote.upsert({
    where: {
      optionId_userId: {
        optionId: "poll-opt-hamburg",
        userId: coachUser.id,
      },
    },
    update: {},
    create: {
      optionId: "poll-opt-hamburg",
      userId: coachUser.id,
      voterName: "Markus Brenner",
    },
  });

  const fineItems = [
    {
      id: "fine-zu-spaet",
      title: "Zu spät zum Training (> 5 Min.)",
      amountCents: 200,
      category: "Pünktlichkeit",
    },
    {
      id: "fine-trikot-vergessen",
      title: "Trikot oder Spielhose vergessen",
      amountCents: 500,
      category: "Spieltag",
    },
    {
      id: "fine-harz-kabine",
      title: "Harz-Flecken in der Kabine / am Boden",
      amountCents: 500,
      category: "Ordnung",
    },
    {
      id: "fine-2min-meckern",
      title: "2-Minuten-Strafe wegen Meckerns",
      amountCents: 300,
      category: "Disziplin",
    },
  ];

  for (const item of fineItems) {
    await prisma.fineCatalogItem.upsert({
      where: { id: item.id },
      update: { amountCents: item.amountCents, category: item.category },
      create: {
        id: item.id,
        clubId: club.id,
        teamId: herren1.id,
        title: item.title,
        amountCents: item.amountCents,
        category: item.category,
      },
    });
  }

  // Kassenbuch: +180,00 € Einlage (PAID) + 3,00 € Strafe (PAID) - 35,00 € Getränke (PAID) = 148,00 € Kassenstand
  // + 5,00 € offene Strafe für Lukas Hartmann (OPEN)
  await prisma.teamCashEntry.upsert({
    where: { id: "cash-h1-starteinlage" },
    update: { status: "PAID", amountCents: 18000 },
    create: {
      id: "cash-h1-starteinlage",
      clubId: club.id,
      teamId: herren1.id,
      type: "INCOME",
      status: "PAID",
      title: "Saison-Starteinlage Mannschaftskasse",
      amountCents: 18000,
      notes: "Übertrag aus der Vorsaison + Mannschaftsbeitrag",
      createdByUserId: coachUser.id,
      paidAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.teamCashEntry.upsert({
    where: { id: "cash-h1-getraenke" },
    update: { status: "PAID", amountCents: 3500 },
    create: {
      id: "cash-h1-getraenke",
      clubId: club.id,
      teamId: herren1.id,
      type: "EXPENSE",
      status: "PAID",
      title: "Kaltgetränke & Isodrinks Auswärtsspiel",
      amountCents: 3500,
      notes: "Beleg beim Kassenwart hinterlegt",
      createdByUserId: coachUser.id,
      paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.teamCashEntry.upsert({
    where: { id: "cash-h1-fine-paid" },
    update: { status: "PAID", amountCents: 300 },
    create: {
      id: "cash-h1-fine-paid",
      clubId: club.id,
      teamId: herren1.id,
      memberId: "member-h1-lukas",
      type: "FINE",
      status: "PAID",
      title: "2-Minuten-Strafe wegen Meckerns",
      amountCents: 300,
      createdByUserId: coachUser.id,
      paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.teamCashEntry.upsert({
    where: { id: "cash-h1-fine-open-lukas" },
    update: { status: "OPEN", amountCents: 500 },
    create: {
      id: "cash-h1-fine-open-lukas",
      clubId: club.id,
      teamId: herren1.id,
      memberId: "member-h1-lukas",
      type: "FINE",
      status: "OPEN",
      title: "Harz-Flecken in der Kabine / am Boden",
      amountCents: 500,
      notes: "Bitte bis zum nächsten Heimspiel begleichen",
      createdByUserId: coachUser.id,
    },
  });

  console.log("Seeding erfolgreich abgeschlossen:");
  console.log("  Verein: TSV Musterstadt (Saison 2026/27)");
  console.log("  Teams: Herren 1, Damen 1, mC-Jugend");
  console.log("  Hallen: Sporthalle Musterstadt-Süd, Schulsporthalle Am Park, Dreifeldhalle Nachbarstadt");
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
