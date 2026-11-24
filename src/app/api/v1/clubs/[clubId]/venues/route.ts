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
    const venues = await services.venue.listVenues(viewer, clubId);
    return jsonOk({ venues });
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
    const venue = await services.venue.createVenue(viewer, clubId, body);
    return jsonCreated({ venue });
  } catch (error) {
    return handleApiError(error);
  }
}
