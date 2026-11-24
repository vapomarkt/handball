import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, eventId } = await context.params;
    const body = await parseJsonBody(request);
    const matchDetails = await services.event.updateMatchDetails(
      viewer,
      teamId,
      eventId,
      body
    );
    return jsonOk({ matchDetails });
  } catch (error) {
    return handleApiError(error);
  }
}
