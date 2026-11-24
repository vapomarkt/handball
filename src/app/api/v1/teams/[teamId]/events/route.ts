import { EventTypeSchema } from "@/domain/schemas/event";
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
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId } = await context.params;
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const parsedType = typeParam ? EventTypeSchema.safeParse(typeParam) : null;

    const events = await services.event.listEvents(viewer, teamId, {
      ...(parsedType?.success ? { type: parsedType.data } : {}),
      ...(fromParam ? { from: new Date(fromParam) } : {}),
      ...(toParam ? { to: new Date(toParam) } : {}),
    });

    return jsonOk({ events });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId } = await context.params;
    const body = await parseJsonBody(request);

    if (
      typeof body === "object" &&
      body !== null &&
      "recurring" in body &&
      (body as { recurring?: unknown }).recurring === true
    ) {
      const series = await services.event.createRecurringEvents(
        viewer,
        teamId,
        body
      );
      return jsonCreated(series);
    }

    const event = await services.event.createSingleEvent(viewer, teamId, body);
    return jsonCreated({ event });
  } catch (error) {
    return handleApiError(error);
  }
}
