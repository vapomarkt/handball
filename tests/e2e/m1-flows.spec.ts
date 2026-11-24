import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "Anwurf2026!";

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

test.describe("Meilenstein 1 – Kritische E2E-Flows", () => {
  test("Trainer-Flow: Login, Kaderansicht mit sensiblen Daten und neuen Spieler anlegen", async ({
    page,
  }) => {
    await loginAs(page, "trainer@tsv-musterstadt.de");

    await expect(
      page.getByRole("main").getByText(/TSV Musterstadt/).first()
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByText("Markus Brenner").first()
    ).toBeVisible();

    await page.goto("/team");
    await expect(page.getByText("Lukas Hartmann")).toBeVisible();
    await expect(page.getByText("Jonas Keller")).toBeVisible();
    // Trainer sieht DSGVO-geschützte Daten (Passnummer & Verletzungsnotiz)
    await expect(page.getByText("DHB-2026-10407")).toBeVisible();
    await expect(page.getByText(/Bänderdehnung/)).toBeVisible();

    // Neuen entkoppelten Spieler anlegen
    const uniqueLast = `E2E${Date.now().toString().slice(-4)}`;
    await page.getByRole("button", { name: "Spieler hinzufügen" }).click();
    await page.fill("#m-first", "Paul");
    await page.fill("#m-last", uniqueLast);
    await page.fill("#m-jersey", "88");
    await page.selectOption("#m-pos1", "KM");
    await page.fill("#m-pass", "DHB-E2E-8888");
    await page.getByRole("button", { name: "Profil anlegen" }).click();

    await expect(page.getByText(`Paul ${uniqueLast}`)).toBeVisible();
    await expect(page.getByText("Noch ohne Login").first()).toBeVisible();

    // Aufräumen: angelegten Test-Spieler wieder entfernen
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: `Paul ${uniqueLast} entfernen` })
      .click();
    await expect(page.getByText(`Paul ${uniqueLast}`)).toHaveCount(0);
  });

  test("DSGVO-Flow (PLAYER): Mitspieler erhalten weder im UI noch in der REST-API sensible Felder", async ({
    page,
  }) => {
    await loginAs(page, "spieler@tsv-musterstadt.de");
    await page.goto("/team");

    await expect(page.getByText("Jonas Keller")).toBeVisible();
    // Jonas Kellers Verletzungsnotiz & Passnummer dürfen für Lukas Hartmann NICHT sichtbar sein
    await expect(page.getByText("DHB-2026-10407")).toHaveCount(0);
    await expect(page.getByText(/Bänderdehnung/)).toHaveCount(0);

    // Direkter REST-API-Check auf /api/v1/teams/team-herren-1/members
    const res = await page.request.get("/api/v1/teams/team-herren-1/members");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const members = body.members as Array<Record<string, unknown>>;

    const jonas = members.find((m) => m.lastName === "Keller");
    expect(jonas).toBeDefined();
    expect(jonas?.canViewSensitive).toBe(false);
    expect("passNumber" in jonas!).toBe(false);
    expect("emergencyContact" in jonas!).toBe(false);
    expect("injuryNote" in jonas!).toBe(false);
    expect("phone" in jonas!).toBe(false);
    expect("email" in jonas!).toBe(false);

    // Eigene Daten (Lukas Hartmann) sind hingegen sichtbar
    const lukas = members.find((m) => m.lastName === "Hartmann");
    expect(lukas).toBeDefined();
    expect(lukas?.canViewSensitive).toBe(true);
    expect(lukas?.passNumber).toBe("DHB-2026-10412");
  });

  test("Eltern-Kind-Flow (PARENT): Verknüpftes Kind sichtbar ohne eigenen Kinder-Login, fremde Kinder geschützt", async ({
    page,
  }) => {
    await loginAs(page, "eltern@tsv-musterstadt.de");

    // Dashboard zeigt verknüpftes Kind Leo Weber
    await expect(page.getByText("Verknüpfte Kinder-Profile")).toBeVisible();
    await expect(page.getByText("Leo Weber")).toBeVisible();

    await page.goto("/team");
    await expect(page.getByText("Leo Weber")).toBeVisible();
    await expect(page.getByText("Dein Kind")).toBeVisible();
    // Sensible Daten des eigenen Kindes sind sichtbar
    await expect(page.getByText("DHB-JUG-2026-4414")).toBeVisible();
    // Sensible Daten von fremdem Jugendspieler (Ben Schulz) sind geschützt
    await expect(page.getByText("DHB-JUG-2026-4401")).toHaveCount(0);
  });

  test("Einladungs- & Registrierungs-Flow: Vorschau und Beitritt über Team-Einladungslink", async ({
    page,
  }) => {
    await page.goto("/invite/demo-herren1-join");

    await expect(page.getByText("Herren 1")).toBeVisible();
    await expect(page.getByText(/TSV Musterstadt/)).toBeVisible();

    // Neues Konto registrieren mit automatischem Redirect zurück zur Einladung
    await page.getByRole("link", { name: /Neues Konto erstellen/ }).click();
    await page.waitForURL("**/register**");

    const uniqueEmail = `e2e-join-${Date.now()}@example.de`;
    await page.fill("#register-name", "E2E Neuzugang");
    await page.fill("#register-email", uniqueEmail);
    await page.fill("#register-password", "SicherPasswort2026!");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/invite/demo-herren1-join", { timeout: 15_000 });
    await page.getByRole("button", { name: "Mannschaft beitreten" }).click();

    await page.waitForURL("**/team", { timeout: 15_000 });
    await expect(page.getByText("Kader · Herren 1")).toBeVisible();
    await expect(page.getByText("E2E Neuzugang")).toBeVisible();
  });
});
