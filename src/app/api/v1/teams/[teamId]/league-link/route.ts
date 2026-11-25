import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

interface RouteContext {
  params: Promise<{ teamId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const viewer = await requireViewerContext();
    const { teamId } = await context.params;
    const body = await parseJsonBody(request);
    const result = await services.leagueDirectory.linkTeamToDirectoryTeam(
      viewer,
      teamId,
      body
    );
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const viewer = await requireViewerContext();
    const { teamId } = await context.params;
    await services.leagueDirectory.unlinkTeamFromDirectory(viewer, teamId);
    return jsonOk({ unlinked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
