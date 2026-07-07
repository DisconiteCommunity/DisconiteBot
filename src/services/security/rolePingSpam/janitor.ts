import { pruneExpiredEntries } from "./messageCache.js";

const JANITOR_INTERVAL_MS = 30_000;
let janitorHandle: ReturnType<typeof setInterval> | null = null;

export function startRolePingSpamCacheJanitor(): void {
  if (janitorHandle !== null) {
    return;
  }
  janitorHandle = setInterval(() => {
    pruneExpiredEntries();
  }, JANITOR_INTERVAL_MS);
}

export function stopRolePingSpamCacheJanitor(): void {
  if (janitorHandle !== null) {
    clearInterval(janitorHandle);
    janitorHandle = null;
  }
}
