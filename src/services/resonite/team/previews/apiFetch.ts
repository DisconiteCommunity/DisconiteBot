import { RESONITE_API_USER_AGENT } from "../../api/api.js";

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
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
