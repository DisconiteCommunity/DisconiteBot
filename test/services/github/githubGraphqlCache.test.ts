import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearGitHubGraphqlCache,
  githubGraphqlCacheKey,
  withGitHubGraphqlCache,
} from "../../../src/services/github/githubGraphqlCache.js";

afterEach(() => {
  clearGitHubGraphqlCache();
  vi.restoreAllMocks();
});

describe("withGitHubGraphqlCache", () => {
  it("returns cached data within TTL without calling fetcher again", async () => {
    const fetcher = vi.fn(async () => ({ ok: true }));
    const query = "query { x }";
    const vars = { org: "Yellow-Dog-Man", number: 47 };

    await withGitHubGraphqlCache(fetcher, query, vars, 60_000);
    await withGitHubGraphqlCache(fetcher, query, vars, 60_000);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent requests for the same key", async () => {
    let resolve!: (v: { n: number }) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<{ n: number }>((r) => {
          resolve = r;
        }),
    );

    const p1 = withGitHubGraphqlCache(fetcher, "q", { n: 1 }, 60_000);
    const p2 = withGitHubGraphqlCache(fetcher, "q", { n: 1 }, 60_000);
    resolve({ n: 42 });

    await expect(Promise.all([p1, p2])).resolves.toEqual([
      { n: 42 },
      { n: 42 },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses stable cache keys regardless of variable key order", () => {
    const a = githubGraphqlCacheKey("q", { org: "o", number: 1, cursor: null });
    const b = githubGraphqlCacheKey("q", { cursor: null, number: 1, org: "o" });
    expect(a).toBe(b);
  });
});
