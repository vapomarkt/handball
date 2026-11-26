import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { auth } from "@/infrastructure/auth/auth";
import { requireViewerContext } from "@/infrastructure/auth/session";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";

const SetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein.")
    .max(128, "Das Passwort darf maximal 128 Zeichen lang sein."),
});

export async function POST(request: Request) {
  try {
    await requireViewerContext(request.headers);
    const body = await parseJsonBody(request);
    const parsed = SetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültiges Passwort.",
        parsed.error.flatten().fieldErrors
      );
    }

    await auth.api.setPassword({
      headers: request.headers,
      body: {
        newPassword: parsed.data.newPassword,
      },
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
