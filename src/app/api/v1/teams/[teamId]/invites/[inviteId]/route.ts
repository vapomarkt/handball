import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ teamId: string; inviteId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { teamId, inviteId } = await context.params;
    await services.invite.revokeInvite(viewer, teamId, inviteId);
    return jsonOk({ revoked: true });
  } catch (error) {
    return handleApiError(error);
  }
}
