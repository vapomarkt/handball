import type { PushNotificationData } from "@throwoff/shared";
import { PgBoss } from "pg-boss";
import { getNuligaFederations } from "@/domain/data/federation-registry";
import { prisma } from "../db/prisma";
import { importNuligaFederationLive } from "../leagues/directory-importer";
import { ExpoPushService } from "../push/expo-push-service";
import { services } from "../services/container";

export const LEAGUE_AUTO_SYNC_QUEUE = "league-auto-sync";
export const HVNB_DIRECTORY_SYNC_QUEUE = "hvnb-directory-sync";
export const DIRECTORY_SYNC_FEDERATION_QUEUE = "directory-sync-federation";
export const PUSH_NOTIFICATIONS_QUEUE = "push-notifications";
export const RSVP_REMINDERS_QUEUE = "rsvp-reminders";

export interface DirectorySyncFederationPayload {
  federationCode: string;
  seasonName?: string;
}

export interface PushJobPayload {
  userIds: string[];
  title: string;
  body: string;
  data?: PushNotificationData;
  channelId?: string;
}

function createPrismaPushService(): ExpoPushService {
  return new ExpoPushService({
    store: {
      async findActiveTokensByUserIds(userIds: string[]) {
        const rows = await prisma.pushDevice.findMany({
          where: { userId: { in: userIds }, enabled: true },
          select: { expoPushToken: true },
        });
        return rows.map((r) => r.expoPushToken);
      },
      async disableTokens(tokens: string[]) {
        await prisma.pushDevice.updateMany({
          where: { expoPushToken: { in: tokens } },
          data: { enabled: false },
        });
      },
    },
  });
}

async function sendUpcomingRsvpReminders(pushService: ExpoPushService) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const upcomingEvents = await prisma.event.findMany({
    where: {
      isCancelled: false,
      startAt: { gte: in24h, lte: in48h },
    },
    select: {
      id: true,
      teamId: true,
      title: true,
      startAt: true,
      team: {
        select: {
          members: {
            where: { userId: { not: null } },
            select: { id: true, userId: true },
          },
        },
      },
      attendances: {
        where: { status: { not: "PENDING" } },
        select: { memberId: true },
      },
    },
  });

  let totalSent = 0;
  for (const event of upcomingEvents) {
    const respondedMemberIds = new Set(
      event.attendances.map((a) => a.memberId)
    );
    const pendingUserIds = event.team.members
      .filter((m) => m.userId && !respondedMemberIds.has(m.id))
      .map((m) => m.userId as string);

    if (pendingUserIds.length === 0) continue;

    const result = await pushService.sendToUsers({
      userIds: pendingUserIds,
      title: "Rückmeldung offen",
      body: `Bitte gib deine Rückmeldung für „${event.title}“ ab.`,
      data: {
        kind: "RSVP_REMINDER",
        url: `throwoff://termine/${event.id}`,
        teamId: event.teamId,
        eventId: event.id,
      },
    });
    totalSent += result.sent;
  }

  return { eventsChecked: upcomingEvents.length, totalSent };
}

export async function startPgBossWorker(): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL ist für pg-boss nicht gesetzt.");
  }

  const boss = new PgBoss(connectionString);
  boss.on("error", (err) => {
    console.error("[pg-boss error]", err);
  });

  await boss.start();
  await boss.createQueue(LEAGUE_AUTO_SYNC_QUEUE);

  // Stündlicher Auto-Sync aller aktiven Liga-iCal-Quellen (kein Redis nötig)
  await boss.schedule(LEAGUE_AUTO_SYNC_QUEUE, "0 * * * *", {}, {
    tz: "Europe/Berlin",
  });

  await boss.work(LEAGUE_AUTO_SYNC_QUEUE, async () => {
    const result = await services.leagueSync.syncAllEnabledIcalSources();
    console.log(
      `[pg-boss] Liga-Auto-Sync abgeschlossen: ${result.sourcesProcessed} Quellen geprüft, ${result.errors.length} Fehler.`
    );
  });

  await boss.createQueue(DIRECTORY_SYNC_FEDERATION_QUEUE);
  await boss.work<DirectorySyncFederationPayload>(
    DIRECTORY_SYNC_FEDERATION_QUEUE,
    async (jobs) => {
      for (const job of jobs) {
        const fedCode = job.data?.federationCode;
        if (!fedCode) continue;
        const result = await importNuligaFederationLive(prisma, fedCode, {
          seasonName: job.data?.seasonName ?? "2026/27",
          delayMs: 150,
        });
        console.log(
          `[pg-boss] Verzeichnis ${result.countryCode}/${result.federationCode} (${result.status}): ` +
            `${result.groups} Staffeln, ${result.teams} Mannschaften, ${result.failures.length} Fehler.`
        );
      }
    }
  );

  await boss.createQueue(HVNB_DIRECTORY_SYNC_QUEUE);
  // Nächtlicher Orchestrator für alle aktiven nuLiga-Verbände (zeitlich gestaffelt ab 02:30 Uhr)
  await boss.schedule(HVNB_DIRECTORY_SYNC_QUEUE, "30 2 * * *", {}, {
    tz: "Europe/Berlin",
  });
  await boss.work(HVNB_DIRECTORY_SYNC_QUEUE, async () => {
    const federations = getNuligaFederations();
    for (let idx = 0; idx < federations.length; idx++) {
      const fed = federations[idx];
      await boss.send(
        DIRECTORY_SYNC_FEDERATION_QUEUE,
        { federationCode: fed.federationCode, seasonName: "2026/27" },
        {
          startAfter: idx * 10 * 60, // 10 Minuten Versatz pro Verband
          singletonKey: `dir-sync-${fed.federationCode}`,
        }
      );
    }
    console.log(
      `[pg-boss] Nächtlicher Verzeichnis-Sync für ${federations.length} nuLiga-Verbände gestaffelt eingereiht.`
    );
  });

  const pushService = createPrismaPushService();

  await boss.createQueue(PUSH_NOTIFICATIONS_QUEUE);
  await boss.work<PushJobPayload>(PUSH_NOTIFICATIONS_QUEUE, async (jobs) => {
    for (const job of jobs) {
      if (!job.data) continue;
      const result = await pushService.sendToUsers(job.data);
      console.log(
        `[pg-boss] Push-Job ${job.id}: ${result.sent}/${result.attempted} zugestellt, ${result.invalidTokens.length} ungültige Tokens deaktiviert.`
      );
    }
  });

  await boss.createQueue(RSVP_REMINDERS_QUEUE);
  // Tägliche RSVP-Erinnerung um 18:00 Uhr für Termine in 24–48 Stunden
  await boss.schedule(RSVP_REMINDERS_QUEUE, "0 18 * * *", {}, {
    tz: "Europe/Berlin",
  });
  await boss.work(RSVP_REMINDERS_QUEUE, async () => {
    const result = await sendUpcomingRsvpReminders(pushService);
    console.log(
      `[pg-boss] RSVP-Erinnerungen: ${result.eventsChecked} Termine geprüft, ${result.totalSent} Pushes gesendet.`
    );
  });

  return boss;
}
