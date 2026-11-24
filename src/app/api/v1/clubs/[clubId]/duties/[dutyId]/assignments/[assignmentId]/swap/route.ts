import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ clubId: string; dutyId: string; assignmentId: string }>;
  }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId, dutyId, assignmentId } = await context.params;
    const body = await parseJsonBody(request);
    const assignment = await services.duty.handleSwap(
      viewer,
      clubId,
      dutyId,
      assignmentId,
      body
    );
    return jsonOk({ assignment });
  } catch (error) {
    return handleApiError(error);
  }
}
