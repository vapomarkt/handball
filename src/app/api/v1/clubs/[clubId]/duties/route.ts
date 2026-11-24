import { DutyScopeSchema } from "@/domain/schemas/duty";
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
    const matchdayId = url.searchParams.get("matchdayId") ?? undefined;
    const scopeParam = url.searchParams.get("scope");
    const parsedScope = scopeParam ? DutyScopeSchema.safeParse(scopeParam) : null;

    const duties = await services.duty.listDuties(viewer, clubId, {
      teamId,
      matchdayId,
      ...(parsedScope?.success ? { scope: parsedScope.data } : {}),
    });
    return jsonOk({ duties });
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
    const duty = await services.duty.createDuty(viewer, clubId, body);
    return jsonCreated({ duty });
  } catch (error) {
    return handleApiError(error);
  }
}
