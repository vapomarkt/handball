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

test.describe("Meilenstein 3 – Zweistufige Dienste, Arbeitsstunden & Trainingsplaner", () => {
  test("Spieler-Flow: Delegiertes Kampfgericht, Tauschbörse & Arbeitsstunden-Konto", async ({
    page,
  }) => {
    await loginAs(page, "spieler@tsv-musterstadt.de");
    await page.goto("/dienste");

    // Zweistufige Dienste inkl. Team-Delegation & Lizenz-Flag
    const kampfgCard = page.getByTestId("duty-card-duty-kampfg-damen1");
    await expect(
      kampfgCard.getByText("Kampfgericht (Zeitnehmer) – Damen 1")
    ).toBeVisible();
    await expect(kampfgCard.getByText(/Team: Herren 1/)).toBeVisible();
    await expect(kampfgCard.getByText(/Z\/S-Lizenz/)).toBeVisible();

    // Tauschbörse auf Kiosk-Schicht
    const kioskCard = page.getByTestId("duty-card-duty-kiosk-samstag");
    await expect(kioskCard.getByText("Tausch gesucht")).toBeVisible();
    await expect(kioskCard.getByText("Katrin Weber")).toBeVisible();

    // Arbeitsstunden-Konto zeigt gutgeschriebene 1.5 Std. für Lukas Hartmann
    await page.getByRole("tab", { name: /Arbeitsstunden-Konto/ }).click();
    await expect(
      page.getByRole("main").getByText("Lukas Hartmann")
    ).toBeVisible();
    await expect(page.getByText(/1\.5 \/ 8 Std\./)).toBeVisible();
  });

  test("Trainer-Flow: Trainingsplaner & Übungsbibliothek mit Handball-Tags unter Taktik & Training", async ({
    page,
  }) => {
    await loginAs(page, "trainer@tsv-musterstadt.de");
    await page.goto("/taktik");

    // Trainingsplaner
    await page.getByRole("tab", { name: /^Trainingsplaner/ }).click();
    await expect(
      page.getByText("Vorbereitung SG Neustadt – 6:0-Abwehr & 1. Welle")
    ).toBeVisible();
    await expect(page.getByText("90 / 90 Min.")).toBeVisible();

    // Übungsbibliothek mit Tag-Filter
    await page.getByRole("tab", { name: /Übungsbibliothek/ }).click();
    await expect(
      page.getByText("Torwart-Einwerfen & 1.-Welle-Konterpass")
    ).toBeVisible();

    await page.getByRole("button", { name: "6:0-Abwehr", exact: true }).click();
    await expect(
      page.getByText("6:0-Abwehr: Verschieben, Helfen & Übergeben")
    ).toBeVisible();
    await expect(
      page.getByText("Torwart-Einwerfen & 1.-Welle-Konterpass")
    ).toHaveCount(0);
  });
});
