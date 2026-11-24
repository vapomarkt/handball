import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string; playId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, playId } = await context.params;
    const play = await services.tactics.getPlay(viewer, teamId, playId);
    return jsonOk({ play });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; playId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, playId } = await context.params;
    const body = await parseJsonBody(request);
    const play = await services.tactics.updatePlay(
      viewer,
      teamId,
      playId,
      body
    );
    return jsonOk({ play });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; playId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, playId } = await context.params;
    await services.tactics.deletePlay(viewer, teamId, playId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
