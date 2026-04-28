export class EditUpError extends Error {
  override readonly name: string = "EditUpError";
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

export class SchemaValidationError extends EditUpError {
  override readonly name = "SchemaValidationError";
  constructor(
    message: string,
    public readonly issues: unknown,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

export class AdapterNotFoundError extends EditUpError {
  override readonly name = "AdapterNotFoundError";
}

export class AdapterDetectionError extends EditUpError {
  override readonly name = "AdapterDetectionError";
}

export class PlanFailedError extends EditUpError {
  override readonly name = "PlanFailedError";
  constructor(
    message: string,
    public readonly attempts: number,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

export class ExecuteFailedError extends EditUpError {
  override readonly name = "ExecuteFailedError";
}

export class VerificationFailedError extends EditUpError {
  override readonly name = "VerificationFailedError";
  constructor(
    message: string,
    public readonly attempts: number,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

export class SecurityViolationError extends EditUpError {
  override readonly name = "SecurityViolationError";
}

export class SessionConflictError extends EditUpError {
  override readonly name = "SessionConflictError";
  constructor(
    message: string,
    public readonly existingPid?: number,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

export class RateLimitError extends EditUpError {
  override readonly name = "RateLimitError";
  constructor(
    message: string,
    public readonly resetsAt: Date,
    cause?: unknown
  ) {
    super(message, cause);
  }
}
