import { getDisconiteForumBaseUrl } from "../../../config/disconite.js";

const DEFAULT_TIMEOUT_MS = 15_000;

export const DISCOURSE_USER_AGENT =
  "DisconiteBot/1.0 (Discord; Disconite forum search)";

export class DiscourseApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "DiscourseApiError";
    this.status = status;
    this.url = url;
  }
}

function resolveForumUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const base = getDisconiteForumBaseUrl();
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

export async function fetchDiscourseJson<T>(
  pathOrUrl: string,
  init?: RequestInit,
): Promise<T> {
  const url = resolveForumUrl(pathOrUrl);
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
        "User-Agent": DISCOURSE_USER_AGENT,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const bodyPreview = await res.text().catch(() => "");
      throw new DiscourseApiError(
        `Discourse API ${res.status}: ${bodyPreview.slice(0, 200)}`,
        res.status,
        url,
      );
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
