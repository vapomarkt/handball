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
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId } = await context.params;
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") ?? undefined;
    const notes = await services.scouting.listScoutingNotes(
      viewer,
      teamId,
      eventId
    );
    return jsonOk({ notes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId } = await context.params;
    const body = await parseJsonBody(request);
    const note = await services.scouting.createScoutingNote(
      viewer,
      teamId,
      body
    );
    return jsonCreated({ note });
  } catch (error) {
    return handleApiError(error);
  }
}
