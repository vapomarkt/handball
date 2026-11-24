import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId } = await context.params;
    const url = new URL(request.url);
    const targetParam = url.searchParams.get("targetHours");
    const targetHours = targetParam ? Number(targetParam) : 8;
    const summary = await services.duty.getTeamWorkHours(
      viewer,
      teamId,
      Number.isFinite(targetHours) && targetHours > 0 ? targetHours : 8
    );
    return jsonOk({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
