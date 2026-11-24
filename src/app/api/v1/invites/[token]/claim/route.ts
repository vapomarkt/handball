import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { token } = await context.params;
    let body: unknown = {};
    try {
      body = await parseJsonBody(request);
    } catch {
      body = {};
    }
    const result = await services.invite.claimInvite(viewer, token, body);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
