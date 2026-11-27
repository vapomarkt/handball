import { DomainError } from "@/domain/errors";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await context.params;
    const logo = await services.club.getClubLogoBinary(clubId);
    if (!logo) {
      return new Response("Vereinslogo nicht gefunden.", { status: 404 });
    }

    const body = Buffer.from(logo.data);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": logo.mimeType,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
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

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      throw DomainError.validation("Bitte wähle eine Bilddatei aus.", {
        file: ["Es wurde keine Bilddatei hochgeladen."],
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const club = await services.club.uploadClubLogo(viewer, clubId, bytes);
    return jsonOk({ club });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const { clubId } = await context.params;
    const club = await services.club.removeClubLogo(viewer, clubId);
    return jsonOk({ club });
  } catch (error) {
    return handleApiError(error);
  }
}
