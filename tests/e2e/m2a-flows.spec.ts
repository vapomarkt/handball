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

test.describe("Meilenstein 2a – Termine, Hallen, Harz-Regelung & 1-Klick-RSVP", () => {
  test("Trainer-Flow: Hallen inkl. Harz-Regelung, Spieltagsdetails & DSGVO-Absagegrund sichtbar", async ({
    page,
  }) => {
    await loginAs(page, "trainer@tsv-musterstadt.de");

    await page.goto("/termine");
    await expect(
      page.getByText("Mannschaftstraining Herren 1").first()
    ).toBeVisible();
    await expect(page.getByText("Herren 1 vs. SG Neustadt")).toBeVisible();
    await expect(page.getByText("Harz erlaubt").first()).toBeVisible();
    await expect(page.getByText("Harz verboten").first()).toBeVisible();

    // Details des Trainings per Klick auf die gesamte Kachel öffnen -> Trainer sieht DSGVO-geschützten Absagegrund von Jonas Keller
    await page
      .locator('[data-testid="event-card-event-h1-training-next"]')
      .click();
    await expect(
      page.getByText(/Bänderdehnung im linken Sprunggelenk/)
    ).toBeVisible();
    await page.getByRole("button", { name: "Schließen" }).click();

    // Hallen-Tab: Neue Halle anlegen und wieder entfernen
    await page.getByRole("button", { name: /Hallen & Harz-Info/ }).click();
    await expect(page.getByText("Sporthalle Musterstadt-Süd")).toBeVisible();
    await expect(page.getByText("Dreifeldhalle Nachbarstadt")).toBeVisible();

    const venueName = `E2E-Halle-${Date.now().toString().slice(-4)}`;
    await page.getByRole("button", { name: "Halle anlegen" }).click();
    await page.fill("#v-name", venueName);
    await page.selectOption("#v-resin", "RESIN_FORBIDDEN");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Halle anlegen" })
      .click();

    await expect(page.getByText(venueName)).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: `Halle ${venueName} entfernen` })
      .click();
    await expect(page.getByText(venueName)).toHaveCount(0);
  });

  test("DSGVO & 1-Klick-RSVP (PLAYER): Fremde Absagegründe werden serverseitig entfernt", async ({
    page,
  }) => {
    await loginAs(page, "spieler@tsv-musterstadt.de");

    // Direkter REST-API-DSGVO-Check für /api/v1/teams/team-herren-1/events
    const res = await page.request.get("/api/v1/teams/team-herren-1/events");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const training = (body.events as Array<Record<string, unknown>>).find(
      (e) => e.id === "event-h1-training-next"
    );
    expect(training).toBeDefined();

    const attendances = training!.attendances as Array<Record<string, unknown>>;
    const jonasAtt = attendances.find((a) => a.memberLastName === "Keller");
    expect(jonasAtt).toBeDefined();
    expect(jonasAtt?.status).toBe("DECLINED");
    expect(jonasAtt?.canViewSensitive).toBe(false);
    expect("declineReason" in jonasAtt!).toBe(false);
    expect("declineReasonCategory" in jonasAtt!).toBe(false);

    // 1-Klick-RSVP auf /termine: Lukas wechselt auf Vielleicht und wieder zurück auf Zugesagt
    await page.goto("/termine");
    const trainingCard = page.locator(
      '[data-testid="event-card-event-h1-training-next"]'
    );
    await trainingCard.getByRole("button", { name: "Vielleicht" }).click();
    await expect(trainingCard.getByText(/2 Vielleicht/)).toBeVisible();

    await trainingCard.getByRole("button", { name: "Zugesagt" }).click();
    await expect(trainingCard.getByText(/3 Zugesagt/)).toBeVisible();
  });

  test("Eltern-Kind 1-Klick-RSVP (PARENT): Rückmeldung für Leo Weber ohne Kinder-Login", async ({
    page,
  }) => {
    await loginAs(page, "eltern@tsv-musterstadt.de");

    // Direkt auf dem Dashboard erscheint der nächste Termin mit 1-Klick-RSVP für Leo Weber
    await expect(page.getByText("Jugendtraining mC-Jugend")).toBeVisible();
    await expect(page.getByText(/Rückmeldung für/)).toBeVisible();
    await expect(page.getByText("Leo Weber").first()).toBeVisible();

    await page
      .getByRole("button", { name: "Zugesagt" })
      .first()
      .click();

    await page.reload();
    await expect(page.getByText("1/2").first()).toBeVisible();
  });
});
