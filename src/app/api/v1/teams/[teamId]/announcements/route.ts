import { NextResponse } from "next/server";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId } = await context.params;
    const announcements = await services.community.listAnnouncements(
      viewer,
      teamId
    );
    return NextResponse.json({ announcements });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId } = await context.params;
    const body = await request.json();
    const announcement = await services.community.createAnnouncement(
      viewer,
      teamId,
      body
    );
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
