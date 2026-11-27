import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId } = await context.params;

    let body: unknown = {};
    const contentLength = request.headers.get("content-length");
    if (contentLength !== "0") {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }

    const result = await services.club.importClubLogoFromNuliga(
      viewer,
      clubId,
      body
    );
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
