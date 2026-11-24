import { EventTypeSchema } from "@/domain/schemas/event";
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
    const typeParam = url.searchParams.get("type");
    const parsedType = typeParam ? EventTypeSchema.safeParse(typeParam) : null;

    const stats = await services.event.getAttendanceStats(
      viewer,
      teamId,
      parsedType?.success ? parsedType.data : undefined
    );
    return jsonOk({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}
