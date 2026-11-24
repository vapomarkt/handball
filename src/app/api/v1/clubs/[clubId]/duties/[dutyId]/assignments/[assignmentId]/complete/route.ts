import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ clubId: string; dutyId: string; assignmentId: string }>;
  }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId, dutyId, assignmentId } = await context.params;
    const assignment = await services.duty.completeAssignment(
      viewer,
      clubId,
      dutyId,
      assignmentId
    );
    return jsonOk({ assignment });
  } catch (error) {
    return handleApiError(error);
  }
}
