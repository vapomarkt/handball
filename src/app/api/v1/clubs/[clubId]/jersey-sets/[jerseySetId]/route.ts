import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clubId: string; jerseySetId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId, jerseySetId } = await context.params;
    const body = await parseJsonBody(request);
    const jerseySet = await services.jerseySet.updateJerseySet(
      viewer,
      clubId,
      jerseySetId,
      body
    );
    return jsonOk({ jerseySet });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ clubId: string; jerseySetId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId, jerseySetId } = await context.params;
    await services.jerseySet.deleteJerseySet(viewer, clubId, jerseySetId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
