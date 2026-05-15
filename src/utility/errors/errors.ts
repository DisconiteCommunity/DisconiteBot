/**
 * Custom error classes for better error handling and type safety
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class VRChatError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, "VRCHAT_ERROR", { ...context, statusCode });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "DATABASE_ERROR", context);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", context);
  }
}

export class PermissionError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "PERMISSION_ERROR", context);
  }
}

export class ConfigError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "CONFIG_ERROR", context);
  }
}

export class DiscordError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, "DISCORD_ERROR", { ...context, statusCode });
  }
}

export class WhitelistError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "WHITELIST_ERROR", context);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

export function getErrorCode(error: unknown): string | undefined {
  if (isAppError(error)) {
    return error.code;
  }
  return undefined;
}
