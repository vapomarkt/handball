import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ clubId: string; dutyId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId, dutyId } = await context.params;
    await services.duty.deleteDuty(viewer, clubId, dutyId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
