import { RESONITE_API_USER_AGENT } from "../../api/api.js";
import { loggers } from "../../../../utility/logging/logger.js";

const FETCH_TIMEOUT_MS = 12_000;

export async function fetchPlatformApiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": RESONITE_API_USER_AGENT,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const level = res.status === 429 ? "warn" : "debug";
      loggers.resonite[level]("platform API request failed", {
        url: url.replace(/Bearer\s+\S+/i, "Bearer [redacted]"),
        status: res.status,
      });
      return null;
    }
    const data = (await res.json()) as T & {
      errors?: { message?: string }[];
    };
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      loggers.resonite.debug("platform API returned errors", {
        url,
        errors: data.errors.map((e) => e.message).slice(0, 3),
      });
      return null;
    }
    return data;
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    loggers.resonite.debug("platform API fetch error", { url, name });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
