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
    const url = new URL(request.url);
    const teamId = url.searchParams.get("teamId") ?? undefined;
    const jerseySets = await services.jerseySet.listJerseySets(viewer, clubId, {
      teamId,
    });
    return jsonOk({ jerseySets });
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
    const jerseySet = await services.jerseySet.createJerseySet(
      viewer,
      clubId,
      body
    );
    return jsonCreated({ jerseySet });
  } catch (error) {
    return handleApiError(error);
  }
}
