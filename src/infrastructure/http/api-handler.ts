import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/domain/errors";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw DomainError.validation("Ungültiger JSON-Body in der Anfrage.");
  }
}

export function handleApiError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_")
  ) {
    throw error;
  }

  if (error instanceof DomainError) {
    return NextResponse.json(error.toApiPayload(), {
      status: error.httpStatus,
    });
  }

  if (error instanceof ZodError) {
    const domainErr = DomainError.validation(
      "Ungültige Eingabedaten.",
      error.flatten().fieldErrors
    );
    return NextResponse.json(domainErr.toApiPayload(), { status: 400 });
  }

  console.error("[API Error]", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Ein interner Serverfehler ist aufgetreten.",
      },
    },
    { status: 500 }
  );
}
