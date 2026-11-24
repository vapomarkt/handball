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
    const invites = await services.invite.listInvites(viewer, teamId);
    return jsonOk({ invites });
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
    const invite = await services.invite.createInvite(viewer, teamId, body);
    return jsonCreated({ invite });
  } catch (error) {
    return handleApiError(error);
  }
}
