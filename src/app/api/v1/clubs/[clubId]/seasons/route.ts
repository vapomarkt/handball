import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonCreated,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { clubId } = await context.params;
    const body = await parseJsonBody(request);
    const season = await services.club.createSeason(viewer, clubId, body);
    return jsonCreated({ season });
  } catch (error) {
    return handleApiError(error);
  }
}
