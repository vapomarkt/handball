import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ seasonId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { seasonId } = await context.params;
    const body = await parseJsonBody(request);
    const season = await services.seasonCatalog.updateSeason(
      viewer,
      seasonId,
      body
    );
    return jsonOk({ season });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ seasonId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { seasonId } = await context.params;
    await services.seasonCatalog.deleteSeason(viewer, seasonId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
