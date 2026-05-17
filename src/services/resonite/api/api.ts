/**
 * Minimal JSON fetch helper for https://api.resonite.com
 * Public open handlers (HTTPS GET, 302 to resonite:): `/open/world/{owner}/{recordId}`
 * for records (worlds, objects, folders, …) and `/open/session/{sessionId}` for sessions.
 */

const API_BASE = "https://api.resonite.com";
const DEFAULT_TIMEOUT_MS = 15_000;

/** Identifies this bot in Resonite API requests (no secrets). */
export const RESONITE_API_USER_AGENT =
  "DisconiteBot/1.0 (Discord; unauthenticated record/wiki helpers)";

export class ResoniteApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "ResoniteApiError";
    this.status = status;
    this.url = url;
  }
}

function resolveUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE}${path}`;
}

export async function fetchResoniteJson<T>(
  pathOrUrl: string,
  init?: RequestInit,
): Promise<T> {
  const url = resolveUrl(pathOrUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, DEFAULT_TIMEOUT_MS);

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
      const bodyPreview = await res.text().catch(() => "");
      throw new ResoniteApiError(
        `Resonite API ${res.status}: ${bodyPreview.slice(0, 200)}`,
        res.status,
        url,
      );
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
