/**
 * Application constants
 * Centralized location for magic numbers and configuration values
 */

export const DiscordColors = {
  SUCCESS: 0x57f287,
  ERROR: 0xed4245,
  WARNING: 0xfee75c,
  INFO: 0x5865f2,
  DEFAULT: 0x2f3136,
} as const;

export const TimeConstants = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

export const ExceptionConstants = {
  MAX_UNCAUGHT_EXCEPTIONS: 5,
  EXCEPTION_RESET_TIME: 60 * 1000,
} as const;

export const VerificationConstants = {
  VERIFICATION_CODE_LENGTH: 6,
  USERNAME_CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
} as const;

export const ApiConstants = {
  DEFAULT_PORT: 3000,
  MAX_PORT: 65535,
  MIN_PORT: 1,
} as const;

export const RateLimitConstants = {
  DEFAULT_TIMEOUT: 1000,
} as const;

export const WebSocketConstants = {
  INITIAL_RECONNECT_DELAY: 1000,
  MAX_RECONNECT_DELAY: 60000,
  RECONNECT_DELAY_MULTIPLIER: 2,
  MAX_RECONNECT_ATTEMPTS: Infinity,
} as const;
