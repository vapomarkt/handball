import { NextResponse } from "next/server";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string; pollId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId, pollId } = await context.params;
    const body = await request.json();
    const poll = await services.community.votePoll(
      viewer,
      teamId,
      pollId,
      body
    );
    return NextResponse.json({ poll });
  } catch (error) {
    return handleApiError(error);
  }
}
