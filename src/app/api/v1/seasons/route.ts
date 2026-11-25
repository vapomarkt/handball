import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonCreated,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    if (includeInactive) {
      const viewer = await requireViewerContext();
      const seasons = await services.seasonCatalog.listAllSeasons(viewer);
      return jsonOk({ seasons });
    }

    const seasons = await services.seasonCatalog.listPublicSeasons();
    return jsonOk({ seasons });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireViewerContext();
    const body = await parseJsonBody(request);
    const season = await services.seasonCatalog.createSeason(viewer, body);
    return jsonCreated({ season });
  } catch (error) {
    return handleApiError(error);
  }
}
