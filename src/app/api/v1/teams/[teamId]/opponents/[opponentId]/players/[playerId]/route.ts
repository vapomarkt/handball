import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ teamId: string; opponentId: string; playerId: string }>;
  }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, opponentId, playerId } = await context.params;
    await services.scouting.deleteKeyPlayer(
      viewer,
      teamId,
      opponentId,
      playerId
    );
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
