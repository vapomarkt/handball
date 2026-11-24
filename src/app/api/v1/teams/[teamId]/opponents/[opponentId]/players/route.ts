import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonCreated,
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
    const body = await parseJsonBody(request);
    const player = await services.scouting.addKeyPlayer(
      viewer,
      teamId,
      opponentId,
      body
    );
    return jsonCreated({ player });
  } catch (error) {
    return handleApiError(error);
  }
}
