import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonCreated,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, eventId } = await context.params;
    const carpools = await services.carpool.listCarpools(
      viewer,
      teamId,
      eventId
    );
    return jsonOk({ carpools });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, eventId } = await context.params;
    const body = await parseJsonBody(request);
    const carpool = await services.carpool.offerCarpool(
      viewer,
      teamId,
      eventId,
      body
    );
    return jsonCreated({ carpool });
  } catch (error) {
    return handleApiError(error);
  }
}
