import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonCreated,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { clubId } = await context.params;
    const teams = await services.club.listTeamsInClub(viewer, clubId);
    return jsonOk({ teams });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { clubId } = await context.params;
    const body = await parseJsonBody(request);
    const team = await services.club.createTeam(viewer, clubId, body);
    return jsonCreated({ team });
  } catch (error) {
    return handleApiError(error);
  }
}
