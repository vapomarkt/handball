import { NextResponse } from "next/server";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; announcementId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, announcementId } = await context.params;
    const body = await request.json();
    const announcement = await services.community.updateAnnouncement(
      viewer,
      teamId,
      announcementId,
      body
    );
    return NextResponse.json({ announcement });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; announcementId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, announcementId } = await context.params;
    await services.community.deleteAnnouncement(viewer, teamId, announcementId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
