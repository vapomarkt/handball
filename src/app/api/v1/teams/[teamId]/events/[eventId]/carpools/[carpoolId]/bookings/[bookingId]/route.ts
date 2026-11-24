import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      teamId: string;
      eventId: string;
      carpoolId: string;
      bookingId: string;
    }>;
  }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, eventId, carpoolId, bookingId } = await context.params;
    await services.carpool.cancelBooking(
      viewer,
      teamId,
      eventId,
      carpoolId,
      bookingId
    );
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
