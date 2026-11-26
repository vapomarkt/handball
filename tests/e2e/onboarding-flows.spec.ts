import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || "ThrowOff2026!";

async function loginWithPassword(
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

test.describe("Onboarding, Login-PIN, Kurzcode-Einladung, Betreuer & App-Tour", () => {
  test("Betreuer-Flow (TEAM_MANAGER): volle Orga-Rechte + Notfallkontakte, aber kein Taktik-Schreibrecht", async ({
    page,
  }) => {
    await loginWithPassword(page, "betreuer@tus-jahn-hollenstedt.de");

    await expect(page.getByText(/Betreuer/).first()).toBeVisible();

    // Kader-Seite: Betreuer sieht sensible Daten & kann Einladungen öffnen
    await page.goto("/team");
    await expect(
      page.getByRole("button", { name: /Einladungen/i }).first()
    ).toBeVisible();
    await expect(page.getByText(/Geschützte Profildaten/i).first()).toBeVisible();

    // Taktik- und Trainingsplan-Schreibzugriffe müssen für TEAM_MANAGER mit 403 blockiert werden
    const meRes = await page.request.get("/api/v1/me");
    const me = await meRes.json();
    const teamId = me.memberships?.[0]?.team?.id as string;
    expect(teamId).toBeTruthy();

    const tacticRes = await page.request.post(
      `/api/v1/teams/${encodeURIComponent(teamId)}/tactics`,
      {
        data: {
          title: "Unberechtigter Spielzug",
          category: "TRIGGER_PLAY",
          courtMode: "HALF_COURT",
          steps: [],
        },
      }
    );
    expect(tacticRes.status()).toBe(403);

    const trainingRes = await page.request.post(
      `/api/v1/teams/${encodeURIComponent(teamId)}/training-plans`,
      {
        data: {
          title: "Unberechtigter Trainingsplan",
          durationMinutes: 90,
          focus: "Angriff",
        },
      }
    );
    expect(trainingRes.status()).toBe(403);
  });

  test("Nahtloser Invite-Flow über 6-stelligen Kurzcode + Login-PIN + schnelle Profil-Vervollständigung + abschaltbare App-Tour", async ({
    page,
    browser,
  }) => {
    // 1. Trainer erstellt Einladung und liest Kurzcode aus
    await loginWithPassword(page, "trainer@tus-jahn-hollenstedt.de");
    const meRes = await page.request.get("/api/v1/me");
    const me = await meRes.json();
    const teamId = me.memberships?.[0]?.team?.id as string;

    const createInvRes = await page.request.post(
      `/api/v1/teams/${encodeURIComponent(teamId)}/invites`,
      {
        data: {
          type: "TEAM_JOIN",
          role: "HELPER",
          expiresInDays: 7,
        },
      }
    );
    expect(createInvRes.status()).toBe(201);
    const createdInv = (await createInvRes.json()).invite;
    expect(createdInv.shortCode).toMatch(/^[A-Z2-9]{6}$/);

    // 2. Neuer Helfer (ohne Konto!) tritt im frischen Browser-Kontext über /register -> Kurzcode -> Login-PIN bei
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    try {
      const uniqueEmail = `helfer-e2e-${Date.now()}@example.de`;

      await guestPage.goto("/register");
      await guestPage.fill("#reg-invite-code", createdInv.shortCode);
      await guestPage.getByRole("button", { name: "Weiter" }).click();
      await guestPage.waitForURL(`**/invite/${createdInv.shortCode}`);

      await expect(guestPage.getByText("Du wurdest eingeladen!")).toBeVisible();
      await expect(guestPage.getByText("Vereinshelfer")).toBeVisible();

      // Inline Login-PIN anfordern (kein Passwort nötig!)
      await guestPage.fill("#inv-first", "Tim");
      await guestPage.fill("#inv-last", "Helfer");
      await guestPage.fill("#inv-email", uniqueEmail);
      await guestPage
        .getByRole("button", { name: /6-stellige Login-PIN erhalten/i })
        .click();

      // OTP aus Dev-Outbox abrufen
      await expect(
        guestPage.getByText(/6-stellige PIN aus deiner E-Mail eingeben/i)
      ).toBeVisible({ timeout: 10_000 });

      const otpRes = await guestPage.request.get(
        `/api/v1/dev/last-otp?email=${encodeURIComponent(uniqueEmail)}`
      );
      expect(otpRes.status()).toBe(200);
      const otpCode = (await otpRes.json()).otp.otp as string;
      expect(otpCode).toMatch(/^\d{6}$/);

      // 6-stellige PIN in die Ziffernfelder eingeben -> löst automatisch Claim aus
      for (let i = 0; i < 6; i++) {
        await guestPage.fill(`#invite-pin-${i}`, otpCode[i]);
      }

      // Schritt 2: Schnelle Profil-Vervollständigung
      await expect(
        guestPage.getByText("Profil kurz vervollständigen")
      ).toBeVisible({ timeout: 15_000 });
      await guestPage.fill("#qp-phone", "0170 4445566");
      await guestPage
        .getByRole("button", { name: "Speichern & weiter" })
        .click();

      // Falls Passkey-Prompt angezeigt wird, überspringen
      const skipPasskeyBtn = guestPage.getByRole("button", {
        name: "Direkt zur App",
      });
      if (await skipPasskeyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await skipPasskeyBtn.click();
      }

      await guestPage.waitForURL("**/dashboard", { timeout: 15_000 });

      // 3. App-Tour startet automatisch für die neue Rolle und lässt sich dauerhaft abschalten
      const tourDialog = guestPage.getByTestId("app-tour-dialog");
      await expect(tourDialog).toBeVisible({ timeout: 5_000 });
      await tourDialog.getByRole("button", { name: "Überspringen" }).click();
      await expect(tourDialog).toHaveCount(0);

      // Nach Reload darf die Tour NICHT erneut automatisch erscheinen
      await guestPage.reload();
      await guestPage.waitForTimeout(800);
      await expect(tourDialog).toHaveCount(0);

      // 4. Im Profil (/profil) lässt sich die Tour manuell wieder starten
      await guestPage.goto("/profil");
      await expect(
        guestPage.getByText("Mein Profil & Sicherheit")
      ).toBeVisible();
      await guestPage
        .getByRole("button", { name: /Kurztour für .* jetzt starten/i })
        .click();
      await guestPage.waitForURL("**/dashboard", { timeout: 10_000 });
      await expect(tourDialog).toBeVisible({ timeout: 5_000 });
    } finally {
      await guestContext.close();
      // Einladung aufräumen
      await page.request.delete(
        `/api/v1/teams/${encodeURIComponent(teamId)}/invites/${encodeURIComponent(createdInv.id)}`
      );
    }
  });
});
