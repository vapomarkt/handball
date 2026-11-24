import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonCreated,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ teamId: string; eventId: string; carpoolId: string }>;
  }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, eventId, carpoolId } = await context.params;
    const body = await parseJsonBody(request);
    const booking = await services.carpool.bookSeat(
      viewer,
      teamId,
      eventId,
      carpoolId,
      body
    );
    return jsonCreated({ booking });
  } catch (error) {
    return handleApiError(error);
  }
}
