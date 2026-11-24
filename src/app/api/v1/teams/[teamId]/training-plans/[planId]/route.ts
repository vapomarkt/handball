import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; planId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, planId } = await context.params;
    const body = await parseJsonBody(request);
    const plan = await services.training.updateTrainingPlan(
      viewer,
      teamId,
      planId,
      body
    );
    return jsonOk({ plan });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; planId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, planId } = await context.params;
    await services.training.deleteTrainingPlan(viewer, teamId, planId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
