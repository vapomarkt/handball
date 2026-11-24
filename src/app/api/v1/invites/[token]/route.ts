import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const preview = await services.invite.previewInvite(token);
    return jsonOk({ invite: preview });
  } catch (error) {
    return handleApiError(error);
  }
}
