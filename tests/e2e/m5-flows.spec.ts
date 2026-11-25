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

test.describe("Meilenstein 5 – Schwarzes Brett, Umfragen, Mannschaftskasse & PWA", () => {
  test("Trainer-Flow: Angepinnte & Trainer-Ankündigungen, Kassenstand & Strafenkatalog", async ({
    page,
  }) => {
    await loginAs(page, "trainer@tsv-musterstadt.de");
    await page.goto("/kasse");

    // Beide Ankündigungen (ALL + STAFF_ONLY) sichtbar
    await expect(
      page.getByTestId("announcement-ann-h1-heimspiel")
    ).toBeVisible();
    await expect(
      page.getByTestId("announcement-ann-h1-staff-only")
    ).toBeVisible();

    // Umfrage sichtbar
    await expect(
      page.getByTestId("poll-poll-h1-mannschaftsfahrt")
    ).toBeVisible();

    // Tab Mannschaftskasse
    await page.getByTestId("tab-cashbox").click();
    await expect(
      page.getByTestId("cashbox-balance-card").getByText("148,00 €")
    ).toBeVisible();
    await expect(
      page.getByTestId("cashbox-open-fines-card").getByText("5,00 €")
    ).toBeVisible();
    await expect(page.getByTestId("fine-catalog-fine-harz-kabine")).toBeVisible();
  });

  test("Spieler-RBAC, Umfrage-Abstimmung, eigene offene Strafen & PWA-Manifest", async ({
    page,
  }) => {
    await loginAs(page, "spieler@tsv-musterstadt.de");
    await page.goto("/kasse");

    // UI: Öffentliche Ankündigung sichtbar, STAFF_ONLY unsichtbar
    await expect(
      page.getByTestId("announcement-ann-h1-heimspiel")
    ).toBeVisible();
    await expect(
      page.getByTestId("announcement-ann-h1-staff-only")
    ).toHaveCount(0);

    // REST-API: STAFF_ONLY serverseitig herausgefiltert
    const annRes = await page.request.get(
      "/api/v1/teams/team-herren-1/announcements"
    );
    expect(annRes.ok()).toBeTruthy();
    const annJson = (await annRes.json()) as {
      announcements: Array<{ id: string }>;
    };
    const annIds = annJson.announcements.map((a) => a.id);
    expect(annIds).toContain("ann-h1-heimspiel");
    expect(annIds).not.toContain("ann-h1-staff-only");

    // Umfrage abstimmen (Option anklicken)
    await page.getByTestId("poll-option-poll-opt-mallorca").click();

    // Tab Mannschaftskasse: Eigene offene Strafe sichtbar (5,00 €), Schreibzugriff 403
    await page.getByTestId("tab-cashbox").click();
    await expect(
      page.getByTestId("cashbox-my-fines-card").getByText("5,00 €")
    ).toBeVisible();

    const forbiddenRes = await page.request.post(
      "/api/v1/teams/team-herren-1/cashbox",
      {
        data: { type: "FINE", title: "Test", amountCents: 200 },
      }
    );
    expect(forbiddenRes.status()).toBe(403);

    // PWA Web App Manifest erreichbar & valide
    const manifestRes = await page.request.get("/manifest.webmanifest");
    expect(manifestRes.ok()).toBeTruthy();
    const manifest = (await manifestRes.json()) as {
      short_name: string;
      display: string;
    };
    expect(manifest.short_name).toBe("ThrowOff");
    expect(manifest.display).toBe("standalone");
  });
});
