import { NextResponse } from "next/server";
import { BRANDING } from "@/config/branding";
import { prisma } from "@/infrastructure/db/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        app: BRANDING.appName,
        database: "up",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        app: BRANDING.appName,
        database: "down",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
