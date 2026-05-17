import { getGitHubCacheTtlMs, getGitHubToken } from "../../config/github.js";
import { loggers } from "../../utility/logging/logger.js";
import { withGitHubGraphqlCache } from "./githubGraphqlCache.js";

export { clearGitHubGraphqlCache } from "./githubGraphqlCache.js";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const FETCH_TIMEOUT_MS = 20_000;

export type GitHubGraphqlError = {
  readonly message: string;
};

export type GitHubGraphqlResponse<T> = {
  readonly data?: T;
  readonly errors?: readonly GitHubGraphqlError[];
};

export class GitHubApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

async function githubGraphqlUncached<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = getGitHubToken();
  if (!token) {
    throw new GitHubApiError("GITHUB_TOKEN is not configured", 0);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "DisconiteBot/1.0 (Discord; GitHub Projects v2)",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      loggers.resonite.warn("GitHub GraphQL HTTP error", {
        status: res.status,
        body: body.slice(0, 300),
      });
      throw new GitHubApiError(
        `GitHub API HTTP ${res.status}`,
        res.status,
      );
    }

    const payload = (await res.json()) as GitHubGraphqlResponse<T>;
    if (payload.errors?.length) {
      const msg = payload.errors.map((e) => e.message).join("; ");
      loggers.resonite.warn("GitHub GraphQL errors", { errors: payload.errors });
      throw new GitHubApiError(msg, 200);
    }
    if (!payload.data) {
      throw new GitHubApiError("GitHub GraphQL returned no data", 200);
    }
    return payload.data;
  } finally {
    clearTimeout(timer);
  }
}

export async function githubGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return withGitHubGraphqlCache<T>(
    githubGraphqlUncached,
    query,
    variables,
    getGitHubCacheTtlMs(),
  );
}
