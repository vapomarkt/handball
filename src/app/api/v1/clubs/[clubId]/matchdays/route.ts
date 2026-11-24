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
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId } = await context.params;
    const matchdays = await services.duty.listMatchdays(viewer, clubId);
    return jsonOk({ matchdays });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId } = await context.params;
    const body = await parseJsonBody(request);
    const matchday = await services.duty.createMatchday(viewer, clubId, body);
    return jsonCreated({ matchday });
  } catch (error) {
    return handleApiError(error);
  }
}
