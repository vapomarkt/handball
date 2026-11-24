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
    const viewer = await requireViewerContext(request.headers);
    const clubs = await services.club.listClubsForUser(viewer);
    return jsonOk({ clubs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireViewerContext();
    const body = await parseJsonBody(request);
    const created = await services.club.createClub(body);
    return jsonCreated(created);
  } catch (error) {
    return handleApiError(error);
  }
}
