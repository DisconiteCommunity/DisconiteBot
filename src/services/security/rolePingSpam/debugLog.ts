import { loggers } from "../../../utility/logging/logger.js";

/** Emits verbose tracking logs when guild debug logging is enabled (INFO level for visibility). */
export function rolePingSpamDebug(
  enabled: boolean | undefined,
  message: string,
  data?: unknown,
): void {
  if (!enabled) {
    return;
  }
  loggers.moderation.info(`RolePingSpam: ${message}`, data);
}
