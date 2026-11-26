import { connection, NextResponse } from "next/server";
import {
  getLatestDevOtp,
  isDevMailOutboxEnabled,
} from "@/infrastructure/mail/mail-provider";

/**
 * Nur in Entwicklung / CI (NODE_ENV !== "production" oder ALLOW_DEV_MAIL_OUTBOX=true) aktiv.
 * Erlaubt automatisierten E2E-Tests und lokalem Entwickeln das Auslesen der letzten Login-PIN.
 */
export async function GET(request: Request) {
  await connection();

  if (!isDevMailOutboxEnabled()) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Not found" } },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "email Parameter fehlt." } },
      { status: 400 }
    );
  }

  const record = getLatestDevOtp(email);
  if (!record) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Kein Code für diese E-Mail vorhanden.",
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ otp: record });
}
