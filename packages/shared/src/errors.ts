export type DomainErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INVITE_INVALID"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR";

export interface ApiErrorPayload {
  error: {
    code: DomainErrorCode;
    message: string;
    details?: unknown;
  };
}

export class ThrowOffApiError extends Error {
  public readonly code: DomainErrorCode;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(
    code: DomainErrorCode,
    message: string,
    httpStatus: number,
    details?: unknown
  ) {
    super(message);
    this.name = "ThrowOffApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }

  static fromResponse(status: number, body: unknown): ThrowOffApiError {
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as ApiErrorPayload).error === "object" &&
      (body as ApiErrorPayload).error !== null
    ) {
      const err = (body as ApiErrorPayload).error;
      return new ThrowOffApiError(
        err.code ?? "INTERNAL_ERROR",
        err.message ?? "Unbekannter API-Fehler.",
        status,
        err.details
      );
    }

    if (status === 401) {
      return new ThrowOffApiError(
        "UNAUTHORIZED",
        "Bitte melde dich erneut an.",
        401
      );
    }
    if (status === 403) {
      return new ThrowOffApiError(
        "FORBIDDEN",
        "Keine Berechtigung für diese Aktion.",
        403
      );
    }
    if (status === 404) {
      return new ThrowOffApiError("NOT_FOUND", "Eintrag nicht gefunden.", 404);
    }

    return new ThrowOffApiError(
      "INTERNAL_ERROR",
      `Serverfehler (HTTP ${status}).`,
      status
    );
  }
}
