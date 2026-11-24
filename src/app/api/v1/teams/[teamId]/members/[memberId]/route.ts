import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string; memberId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { teamId, memberId } = await context.params;
    const member = await services.roster.getMember(viewer, teamId, memberId);
    return jsonOk({ member });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; memberId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { teamId, memberId } = await context.params;
    const body = await parseJsonBody(request);
    const member = await services.roster.updateMember(
      viewer,
      teamId,
      memberId,
      body
    );
    return jsonOk({ member });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ teamId: string; memberId: string }> }
) {
  try {
    const viewer = await requireViewerContext();
    const { teamId, memberId } = await context.params;
    await services.roster.deleteMember(viewer, teamId, memberId);
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
