import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; noteId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, noteId } = await context.params;
    const body = await parseJsonBody(request);
    const note = await services.scouting.updateScoutingNote(
      viewer,
      teamId,
      noteId,
      body
    );
    return jsonOk({ note });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; noteId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, noteId } = await context.params;
    await services.scouting.deleteScoutingNote(viewer, teamId, noteId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
