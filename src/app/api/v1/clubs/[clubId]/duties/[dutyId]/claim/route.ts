import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonCreated,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ clubId: string; dutyId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId, dutyId } = await context.params;
    const body = await parseJsonBody(request);
    const assignment = await services.duty.claimSlot(
      viewer,
      clubId,
      dutyId,
      body
    );
    return jsonCreated({ assignment });
  } catch (error) {
    return handleApiError(error);
  }
}
