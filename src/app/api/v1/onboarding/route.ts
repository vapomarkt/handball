import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonCreated,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(request: Request) {
  try {
    const viewer = await requireViewerContext();
    const body = await parseJsonBody(request);
    const result = await services.onboarding.completeOnboarding(viewer, body);
    return jsonCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
