import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonCreated,
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
    const members = await services.roster.listRoster(viewer, teamId);
    return jsonOk({ members });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { teamId } = await context.params;
    const body = await parseJsonBody(request);
    const member = await services.roster.addMember(viewer, teamId, body);
    return jsonCreated({ member });
  } catch (error) {
    return handleApiError(error);
  }
}
