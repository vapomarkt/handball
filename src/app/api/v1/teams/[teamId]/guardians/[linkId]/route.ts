import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ teamId: string; linkId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { teamId, linkId } = await context.params;
    await services.guardian.unlinkGuardian(viewer, teamId, linkId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
