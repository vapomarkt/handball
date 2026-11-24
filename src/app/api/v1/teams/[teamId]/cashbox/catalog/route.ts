import { NextResponse } from "next/server";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { teamId } = await context.params;
    const body = await request.json();
    const item = await services.cashbox.createCatalogItem(viewer, teamId, body);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
