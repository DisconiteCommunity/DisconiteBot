type CacheEntry = {
  at: number;
  data: unknown;
};

const entries = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function stableVariablesKey(variables?: Record<string, unknown>): string {
  if (!variables || Object.keys(variables).length === 0) {
    return "";
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(variables).sort()) {
    sorted[key] = variables[key];
  }
  return JSON.stringify(sorted);
}

export function githubGraphqlCacheKey(
  query: string,
  variables?: Record<string, unknown>,
): string {
  return `${query.trim()}::${stableVariablesKey(variables)}`;
}

export function clearGitHubGraphqlCache(): void {
  entries.clear();
  inflight.clear();
}

export function getGitHubGraphqlCacheSize(): number {
  return entries.size;
}

/**
 * TTL cache + in-flight dedupe for identical GraphQL requests (e.g. paginated cursors).
 */
export async function withGitHubGraphqlCache<T>(
  fetcher: (
    query: string,
    variables?: Record<string, unknown>,
  ) => Promise<T>,
  query: string,
  variables: Record<string, unknown> | undefined,
  ttlMs: number,
): Promise<T> {
  const key = githubGraphqlCacheKey(query, variables);
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && now - hit.at < ttlMs) {
    return hit.data as T;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = fetcher(query, variables)
    .then((data) => {
      entries.set(key, { at: Date.now(), data });
      inflight.delete(key);
      return data;
    })
    .catch((err: unknown) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}
