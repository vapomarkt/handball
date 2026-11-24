import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ clubId: string; venueId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId, venueId } = await context.params;
    const body = await parseJsonBody(request);
    const venue = await services.venue.updateVenue(
      viewer,
      clubId,
      venueId,
      body
    );
    return jsonOk({ venue });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ clubId: string; venueId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId, venueId } = await context.params;
    await services.venue.deleteVenue(viewer, clubId, venueId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
