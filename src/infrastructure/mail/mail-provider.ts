import nodemailer from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailProvider {
  readonly kind: "smtp" | "resend" | "console";
  send(message: MailMessage): Promise<void>;
}

export interface DevOtpRecord {
  email: string;
  otp: string;
  type: string;
  createdAt: string;
}

const globalForMail = globalThis as unknown as {
  __throwoffDevOtpOutbox?: DevOtpRecord[];
};

const MAX_DEV_OUTBOX = 50;

export function isDevMailOutboxEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEV_MAIL_OUTBOX === "true"
  );
}

export function recordDevOtp(record: Omit<DevOtpRecord, "createdAt">): void {
  if (!isDevMailOutboxEnabled()) return;
  const list = (globalForMail.__throwoffDevOtpOutbox ??= []);
  list.unshift({
    ...record,
    email: record.email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  });
  if (list.length > MAX_DEV_OUTBOX) {
    list.length = MAX_DEV_OUTBOX;
  }
}

export function getLatestDevOtp(email: string): DevOtpRecord | null {
  if (!isDevMailOutboxEnabled()) return null;
  const normalized = email.trim().toLowerCase();
  const list = globalForMail.__throwoffDevOtpOutbox ?? [];
  return list.find((entry) => entry.email === normalized) ?? null;
}

function resolveMailFrom(): string {
  return process.env.MAIL_FROM || "ThrowOff <noreply@throwoff.app>";
}

function resolveProviderKind(): "smtp" | "resend" | "console" {
  const configured = process.env.MAIL_PROVIDER?.trim().toLowerCase();
  if (configured === "smtp" || configured === "resend" || configured === "console") {
    return configured;
  }
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST) return "smtp";
  return "console";
}

class SmtpMailProvider implements MailProvider {
  readonly kind = "smtp" as const;

  async send(message: MailMessage): Promise<void> {
    const host = process.env.SMTP_HOST;
    if (!host) {
      throw new Error("SMTP_HOST ist für MAIL_PROVIDER=smtp nicht gesetzt.");
    }
    const port = Number(process.env.SMTP_PORT || "587");
    const secure =
      process.env.SMTP_SECURE === "true" || port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(process.env.SMTP_USER
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS || "",
            },
          }
        : {}),
    });

    await transporter.sendMail({
      from: resolveMailFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

class ResendMailProvider implements MailProvider {
  readonly kind = "resend" as const;

  async send(message: MailMessage): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY ist für MAIL_PROVIDER=resend nicht gesetzt.");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resolveMailFrom(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Resend-E-Mail-Versand fehlgeschlagen (HTTP ${res.status}): ${body.slice(0, 200)}`
      );
    }
  }
}

class ConsoleMailProvider implements MailProvider {
  readonly kind = "console" as const;

  async send(message: MailMessage): Promise<void> {
    console.info(
      [
        "==================================================",
        `[ThrowOff Mail · Console-Fallback] An: ${message.to}`,
        `Betreff: ${message.subject}`,
        "--------------------------------------------------",
        message.text,
        "==================================================",
      ].join("\n")
    );
  }
}

export function getMailProvider(): MailProvider {
  const kind = resolveProviderKind();
  if (kind === "smtp") return new SmtpMailProvider();
  if (kind === "resend") return new ResendMailProvider();
  return new ConsoleMailProvider();
}
