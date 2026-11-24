import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string; sourceId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, sourceId } = await context.params;
    let body: unknown = {};
    try {
      body = await parseJsonBody(request);
    } catch {
      body = {};
    }
    const summary = await services.leagueSync.triggerSourceSync(
      viewer,
      teamId,
      sourceId,
      body
    );
    return jsonOk({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
