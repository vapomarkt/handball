import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string; opponentId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, opponentId } = await context.params;
    const body = await parseJsonBody(request).catch(() => ({}));
    const preview = await services.scouting.previewNuligaOpponentPlayers(
      viewer,
      teamId,
      opponentId,
      body
    );
    return jsonOk(preview);
  } catch (error) {
    return handleApiError(error);
  }
}
