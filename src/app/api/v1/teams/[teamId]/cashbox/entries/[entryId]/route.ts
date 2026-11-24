import { NextResponse } from "next/server";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; entryId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, entryId } = await context.params;
    const body = await request.json();
    const entry = await services.cashbox.updateEntryStatus(
      viewer,
      teamId,
      entryId,
      body
    );
    return NextResponse.json({ entry });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; entryId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, entryId } = await context.params;
    await services.cashbox.deleteEntry(viewer, teamId, entryId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
