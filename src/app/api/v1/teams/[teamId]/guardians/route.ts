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
    const links = await services.guardian.listTeamGuardianLinks(viewer, teamId);
    return jsonOk({ links });
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
    const link = await services.guardian.linkGuardianToChild(
      viewer,
      teamId,
      body
    );
    return jsonCreated({ link });
  } catch (error) {
    return handleApiError(error);
  }
}
