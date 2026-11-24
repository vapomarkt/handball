import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { teamId } = await context.params;
    const team = await services.club.getTeam(viewer, teamId);
    return jsonOk({ team });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { teamId } = await context.params;
    const body = await parseJsonBody(request);
    const team = await services.club.updateTeam(viewer, teamId, body);
    return jsonOk({ team });
  } catch (error) {
    return handleApiError(error);
  }
}
