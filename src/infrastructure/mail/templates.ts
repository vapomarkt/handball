import { BRANDING } from "@/config/branding";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function formatPinForDisplay(otp: string): string {
  const clean = otp.trim();
  if (clean.length === 6) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  return clean;
}

function wrapHtml(params: {
  heading: string;
  intro: string;
  otp: string;
  footer: string;
}): string {
  const formatted = formatPinForDisplay(params.otp);
  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${params.heading}</title>
  </head>
  <body style="margin:0;padding:24px;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;">
      <tr>
        <td style="padding:28px 28px 12px 28px;">
          <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ea580c;">
            ${BRANDING.appName}
          </p>
          <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:#18181b;">
            ${params.heading}
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 20px 28px;">
          <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#3f3f46;">
            ${params.intro}
          </p>
          <div style="background:#fff7ed;border:2px solid #fdba74;border-radius:12px;padding:18px;text-align:center;">
            <span style="font-size:34px;font-weight:800;letter-spacing:0.18em;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#9a3412;">
              ${formatted}
            </span>
          </div>
          <p style="margin:18px 0 0 0;font-size:13px;line-height:1.5;color:#71717a;">
            Der Code ist <strong>10 Minuten</strong> gültig. ${params.footer}
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px;background:#fafafa;border-top:1px solid #f4f4f5;font-size:12px;color:#a1a1aa;">
          ${BRANDING.appName} · Handball-Plattform für Vereine, Trainer, Spieler &amp; Eltern
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderOtpEmail(params: {
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}): RenderedEmail {
  const formatted = formatPinForDisplay(params.otp);

  if (params.type === "forget-password") {
    return {
      subject: `${formatted} – Dein Code zum Passwort-Zurücksetzen (${BRANDING.appName})`,
      text: `Hallo,\n\ndein 6-stelliger Code zum Zurücksetzen deines Passworts bei ${BRANDING.appName} lautet:\n\n${formatted}\n\nDer Code ist 10 Minuten gültig. Falls du das nicht angefordert hast, kannst du diese E-Mail einfach ignorieren.`,
      html: wrapHtml({
        heading: "Passwort zurücksetzen",
        intro:
          "Gib diesen 6-stelligen Code in der App ein, um ein neues Passwort festzulegen:",
        otp: params.otp,
        footer:
          "Falls du kein neues Passwort angefordert hast, kannst du diese E-Mail einfach ignorieren.",
      }),
    };
  }

  if (params.type === "email-verification" || params.type === "change-email") {
    return {
      subject: `${formatted} – Bestätige deine E-Mail-Adresse (${BRANDING.appName})`,
      text: `Hallo,\n\ndein 6-stelliger Bestätigungscode für ${BRANDING.appName} lautet:\n\n${formatted}\n\nDer Code ist 10 Minuten gültig.`,
      html: wrapHtml({
        heading: "E-Mail-Adresse bestätigen",
        intro:
          "Gib diesen 6-stelligen Code in der App ein, um deine E-Mail-Adresse zu bestätigen:",
        otp: params.otp,
        footer:
          "Falls du diese Anfrage nicht gestellt hast, ignoriere diese Nachricht einfach.",
      }),
    };
  }

  // sign-in (Standard: Login-PIN)
  return {
    subject: `${formatted} – Deine ${BRANDING.appName} Login-PIN`,
    text: `Hallo,\n\ndeine 6-stellige Login-PIN für ${BRANDING.appName} lautet:\n\n${formatted}\n\nGib diese Zahlen einfach in der App ein – du brauchst kein Passwort. Der Code ist 10 Minuten gültig.`,
    html: wrapHtml({
      heading: "Deine Login-PIN",
      intro:
        "Gib diese 6 Zahlen einfach in der App ein, um dich direkt anzumelden – ganz ohne Passwort:",
      otp: params.otp,
      footer:
        "Falls du dich nicht angemeldet hast, kannst du diese E-Mail einfach ignorieren.",
    }),
  };
}
