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

test.describe("Meilenstein 4 – Interaktives Taktikboard & Gegner-Scouting", () => {
  test("Trainer-Flow: Playbook inkl. Entwurf, SVG-Animation, Gegner-Dossier & Spielzug-Sprung", async ({
    page,
  }) => {
    await loginAs(page, "trainer@tsv-musterstadt.de");
    await page.goto("/taktik");

    // Alle 3 Spielzüge inkl. Trainer-Entwurf sind sichtbar
    await expect(
      page.getByTestId("tactic-card-tactic-kreuzung-einlaeufer")
    ).toBeVisible();
    await expect(
      page.getByTestId("tactic-card-tactic-gegenstoss-welle")
    ).toBeVisible();
    await expect(
      page.getByTestId("tactic-card-tactic-draft-7-6")
    ).toBeVisible();

    // 3-Schritte-Spielzug auswählen und SVG-Animation abspielen
    await page.getByTestId("tactic-card-tactic-kreuzung-einlaeufer").click();
    const svg = page.getByTestId("handball-tactics-svg");
    await expect(svg).toBeVisible();
    await expect(page.getByTestId("tactic-token-rm")).toBeVisible();

    const playBtn = page.getByTestId("tactic-play-button");
    await expect(playBtn).toBeEnabled();
    await playBtn.click();

    // Wechsel zum Tab "Scouting"
    await page.getByRole("tab", { name: /Scouting/ }).click();

    const dossier = page.getByTestId("opponent-dossier-opponent-sg-neustadt");
    await expect(dossier).toBeVisible();
    await expect(dossier.getByText("SG Neustadt")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Lukas König" })
    ).toBeVisible();
    await expect(page.getByRole("main").getByText("7m-Schütze")).toBeVisible();

    // Sowohl freigegebener Matchplan als auch Trainer-interne Notiz sichtbar
    const sharedNote = page.getByTestId(
      "scouting-note-scouting-note-matchplan-shared"
    );
    await expect(sharedNote).toBeVisible();
    await expect(
      page.getByTestId("scouting-note-scouting-note-trainer-only")
    ).toBeVisible();

    // 1-Klick-Sprung zum verknüpften Spielzug öffnet wieder das Taktikboard
    await sharedNote
      .getByRole("button", { name: /Verknüpften Spielzug öffnen/ })
      .click();
    await expect(page.getByTestId("handball-tactics-svg")).toBeVisible();
  });

  test("Spieler-RBAC-Flow: Nur freigegebene Spielzüge & Matchpläne in UI und REST-API", async ({
    page,
  }) => {
    await loginAs(page, "spieler@tsv-musterstadt.de");
    await page.goto("/taktik");

    // UI: Freigegebene Spielzüge sichtbar, Trainer-Entwurf unsichtbar
    await expect(
      page.getByTestId("tactic-card-tactic-kreuzung-einlaeufer")
    ).toBeVisible();
    await expect(
      page.getByTestId("tactic-card-tactic-gegenstoss-welle")
    ).toBeVisible();
    await expect(
      page.getByTestId("tactic-card-tactic-draft-7-6")
    ).toHaveCount(0);

    // UI Matchplan-Tab: Freigegebener Matchplan sichtbar, Trainer-Notiz unsichtbar
    await page.getByRole("tab", { name: /Matchplan/ }).click();
    await expect(
      page.getByTestId("scouting-note-scouting-note-matchplan-shared")
    ).toBeVisible();
    await expect(
      page.getByTestId("scouting-note-scouting-note-trainer-only")
    ).toHaveCount(0);

    // Serverseitige RBAC-Prüfung über REST-API direkt
    const tacticsRes = await page.request.get(
      "/api/v1/teams/team-herren-1/tactics"
    );
    expect(tacticsRes.ok()).toBeTruthy();
    const tacticsJson = (await tacticsRes.json()) as {
      plays: Array<{ id: string }>;
    };
    const playIds = tacticsJson.plays.map((p) => p.id);
    expect(playIds).toContain("tactic-kreuzung-einlaeufer");
    expect(playIds).not.toContain("tactic-draft-7-6");

    // Direktabruf des Trainer-Entwurfs muss 403 liefern
    const draftRes = await page.request.get(
      "/api/v1/teams/team-herren-1/tactics/tactic-draft-7-6"
    );
    expect(draftRes.status()).toBe(403);

    // Scouting-Notizen-API liefert nur freigegebene Notizen
    const notesRes = await page.request.get(
      "/api/v1/teams/team-herren-1/scouting-notes"
    );
    expect(notesRes.ok()).toBeTruthy();
    const notesJson = (await notesRes.json()) as {
      notes: Array<{ id: string }>;
    };
    const noteIds = notesJson.notes.map((n) => n.id);
    expect(noteIds).toContain("scouting-note-matchplan-shared");
    expect(noteIds).not.toContain("scouting-note-trainer-only");
  });
});
