import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const links = await services.guardian.listMyLinkedChildren(viewer);
    return jsonOk({ links });
  } catch (error) {
    return handleApiError(error);
  }
}
