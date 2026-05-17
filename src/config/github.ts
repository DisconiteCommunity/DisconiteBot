import { getEnv } from "./env.js";

function tokenFromEnv(): string | undefined {
  let validated: ReturnType<typeof getEnv> | undefined;
  try {
    validated = getEnv();
  } catch {
    validated = undefined;
  }
  const v =
    validated?.GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
  return v && v.length > 0 ? v : undefined;
}

/** GitHub personal access token (classic or fine-grained) for org Project v2 reads. */
export function getGitHubToken(): string | undefined {
  return tokenFromEnv();
}

export function isGitHubConfigured(): boolean {
  return Boolean(getGitHubToken());
}

const DEFAULT_GITHUB_CACHE_TTL_MS = 5 * 60_000;
const MIN_GITHUB_CACHE_TTL_MS = 60_000;
const MAX_GITHUB_CACHE_TTL_MS = 60 * 60_000;

/** Shared TTL for GraphQL response cache and assembled project-board cache. */
export function getGitHubCacheTtlMs(): number {
  try {
    const raw = getEnv().GITHUB_CACHE_TTL_SECONDS?.trim();
    if (raw) {
      const sec = parseInt(raw, 10);
      if (Number.isFinite(sec)) {
        const ms = sec * 1000;
        return Math.min(
          MAX_GITHUB_CACHE_TTL_MS,
          Math.max(MIN_GITHUB_CACHE_TTL_MS, ms),
        );
      }
    }
  } catch {
    /* env not validated yet */
  }
  return DEFAULT_GITHUB_CACHE_TTL_MS;
}
