import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; drillId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, drillId } = await context.params;
    await services.training.deleteDrill(viewer, teamId, drillId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
