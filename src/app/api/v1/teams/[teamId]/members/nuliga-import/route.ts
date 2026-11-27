import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId } = await context.params;
    const body = await parseJsonBody(request);
    const result = await services.roster.importNuligaRoster(
      viewer,
      teamId,
      body
    );
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
