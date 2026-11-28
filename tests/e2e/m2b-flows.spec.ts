import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "ThrowOff2026!";

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password = DEMO_PASSWORD
) {
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

test.describe("Meilenstein 2b – Liga-Import, Sync-Schutz & Fahrgemeinschaften", () => {
  test("iCal Re-Sync erkennt Spielverlegung und schützt lokale Anreicherungen sowie Hallen-Harzregelung", async ({
    page,
  }) => {
    await loginAs(page, "trainer@tsv-musterstadt.de");

    const uid = `e2e-sync-${Date.now()}`;
    const icsV1 = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      "DTSTART:20270214T180000Z",
      "DTEND:20270214T194500Z",
      "SUMMARY:TSV Musterstadt - SG Testgegner",
      "LOCATION:Sporthalle Musterstadt-Süd",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    // 1. Erst-Sync via API
    const res1 = await page.request.post(
      "/api/v1/teams/team-herren-1/league-sources/source-h1-nuliga-ical/sync",
      { data: { icalContent: icsV1 } }
    );
    expect(res1.status()).toBe(200);
    const body1 = await res1.json();
    expect(body1.summary.createdCount).toBe(1);
    const createdEventId = body1.summary.changes[0].eventId as string;
    expect(createdEventId).toBeTruthy();

    // 2. Lokale Anreicherungen durch Trainer (Trikotfarbe + Spieltagskader)
    const patchMatch = await page.request.patch(
      `/api/v1/teams/team-herren-1/events/${createdEventId}/match`,
      {
        data: {
          jerseyColor: "Sonder-Trikot Neon",
          nominatedMemberIds: ["member-h1-lukas", "member-h1-tim"],
        },
      }
    );
    expect(patchMatch.status()).toBe(200);

    // 3. Re-Sync mit Spielverlegung (18:00 -> 20:00)
    const icsV2 = icsV1
      .replace("20270214T180000Z", "20270214T200000Z")
      .replace("20270214T194500Z", "20270214T214500Z");

    const res2 = await page.request.post(
      "/api/v1/teams/team-herren-1/league-sources/source-h1-nuliga-ical/sync",
      { data: { icalContent: icsV2 } }
    );
    expect(res2.status()).toBe(200);
    const body2 = await res2.json();
    expect(body2.summary.updatedCount).toBe(1);
    expect(body2.summary.changes[0].changeType).toBe("RESCHEDULED");

    // 4. Prüfen: Neue Zeit übernommen, ABER lokale Anreicherungen & Harz-Regelung 100% geschützt!
    const evRes = await page.request.get(
      `/api/v1/teams/team-herren-1/events/${createdEventId}`
    );
    expect(evRes.status()).toBe(200);
    const { event } = await evRes.json();
    expect(event.startAt).toBe("2027-02-14T20:00:00.000Z");
    expect(event.matchDetails.jerseyColor).toBe("Sonder-Trikot Neon");
    expect(event.matchDetails.nominatedMemberIds).toEqual([
      "member-h1-lukas",
      "member-h1-tim",
    ]);
    expect(event.venue.resinPolicy).toBe("RESIN_ALLOWED");

    // Aufräumen
    await page.request.delete(
      `/api/v1/teams/team-herren-1/events/${createdEventId}`
    );
  });

  test("UI-Flow: Liga-Import Tab & Fahrgemeinschaft auf Auswärtsspiel", async ({
    page,
  }) => {
    await loginAs(page, "trainer@tsv-musterstadt.de");
    await page.goto("/termine");

    // Tab Liga-Import & Sync zeigt Quelle & Change-Log
    await page.getByRole("tab", { name: /Liga-Import & Sync/ }).click();
    await expect(
      page.getByText("nuLiga Verbandsliga Herren 1 (iCal)").first()
    ).toBeVisible();
    await expect(page.getByText(/Liga-Änderungsprotokoll/)).toBeVisible();

    // Zurück zu Terminen -> Auswärtsspiel per Klick auf die gesamte Kachel öffnen -> Fahrgemeinschaft prüfen
    await page.getByRole("tab", { name: /^Termine/ }).click();
    await page
      .locator('[data-testid="event-card-event-h1-match-away"]')
      .click();

    await expect(
      page.getByRole("heading", { name: /Fahrgemeinschaften/ })
    ).toBeVisible();
    const carpoolCard = page.getByTestId("carpool-card-carpool-h1-away-lukas");
    await expect(carpoolCard.getByText("Fahrer: Lukas Hartmann")).toBeVisible();
    await expect(carpoolCard.getByText("2 / 3 frei")).toBeVisible();
    await expect(carpoolCard.getByText("Finn Albrecht")).toBeVisible();
  });
});
