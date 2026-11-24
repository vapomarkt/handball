import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { clubId } = await context.params;
    const details = await services.club.getClubDetails(viewer, clubId);
    return jsonOk(details);
  } catch (error) {
    return handleApiError(error);
  }
}
