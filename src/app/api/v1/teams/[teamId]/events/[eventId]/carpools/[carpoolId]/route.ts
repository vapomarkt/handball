import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ teamId: string; eventId: string; carpoolId: string }>;
  }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, eventId, carpoolId } = await context.params;
    await services.carpool.deleteCarpool(viewer, teamId, eventId, carpoolId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
