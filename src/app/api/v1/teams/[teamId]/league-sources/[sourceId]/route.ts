import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; sourceId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, sourceId } = await context.params;
    await services.leagueSync.deleteSource(viewer, teamId, sourceId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
