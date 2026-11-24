export type DomainErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INVITE_INVALID"
  | "INTERNAL_ERROR";

export interface ApiErrorPayload {
  error: {
    code: DomainErrorCode;
    message: string;
    details?: unknown;
  };
}

export class DomainError extends Error {
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
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }

  toApiPayload(): ApiErrorPayload {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }

  static unauthorized(message = "Nicht angemeldet.") {
    return new DomainError("UNAUTHORIZED", message, 401);
  }

  static forbidden(message = "Keine Berechtigung für diese Aktion.") {
    return new DomainError("FORBIDDEN", message, 403);
  }

  static notFound(message = "Eintrag nicht gefunden.") {
    return new DomainError("NOT_FOUND", message, 404);
  }

  static validation(message: string, details?: unknown) {
    return new DomainError("VALIDATION_ERROR", message, 400, details);
  }

  static conflict(message: string, details?: unknown) {
    return new DomainError("CONFLICT", message, 409, details);
  }

  static inviteInvalid(message: string) {
    return new DomainError("INVITE_INVALID", message, 400);
  }
}
