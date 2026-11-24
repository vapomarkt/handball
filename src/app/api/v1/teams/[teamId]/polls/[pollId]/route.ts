import { NextResponse } from "next/server";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; pollId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, pollId } = await context.params;
    await services.community.deletePoll(viewer, teamId, pollId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
