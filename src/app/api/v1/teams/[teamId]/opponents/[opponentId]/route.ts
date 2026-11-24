import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; opponentId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, opponentId } = await context.params;
    const body = await parseJsonBody(request);
    const opponent = await services.scouting.updateOpponent(
      viewer,
      teamId,
      opponentId,
      body
    );
    return jsonOk({ opponent });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; opponentId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, opponentId } = await context.params;
    await services.scouting.deleteOpponent(viewer, teamId, opponentId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
