import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
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
    const event = await services.event.getEvent(viewer, teamId, eventId);
    return jsonOk({ event });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, eventId } = await context.params;
    const body = await parseJsonBody(request);
    const event = await services.event.updateEvent(
      viewer,
      teamId,
      eventId,
      body
    );
    return jsonOk({ event });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, eventId } = await context.params;
    await services.event.deleteEvent(viewer, teamId, eventId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
