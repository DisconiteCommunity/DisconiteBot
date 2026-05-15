import { getWeblateApiToken, getWeblateBaseUrl } from "../../../config/disconite.js";

const DEFAULT_TIMEOUT_MS = 15_000;

export const WEBLATE_USER_AGENT =
  "DisconiteBot/1.0 (Discord; Weblate translation lookup)";

export class WeblateApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "WeblateApiError";
    this.status = status;
    this.url = url;
  }
}

function resolveWeblateUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const base = getWeblateBaseUrl();
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

export async function fetchWeblateJson<T>(
  pathOrUrl: string,
  init?: RequestInit,
): Promise<T> {
  const url = resolveWeblateUrl(pathOrUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, DEFAULT_TIMEOUT_MS);

  const token = getWeblateApiToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": WEBLATE_USER_AGENT,
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers,
    });

    if (!res.ok) {
      const bodyPreview = await res.text().catch(() => "");
      throw new WeblateApiError(
        `Weblate API ${res.status}: ${bodyPreview.slice(0, 200)}`,
        res.status,
        url,
      );
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
