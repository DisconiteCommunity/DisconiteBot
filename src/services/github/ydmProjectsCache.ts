import { getGitHubCacheTtlMs } from "../../config/github.js";
import { clearGitHubGraphqlCache } from "./githubGraphql.js";
import {
  fetchYdmProjectsBundle,
  filterYdmProjectItems,
  findYdmProjectItem,
  searchYdmProjectItems,
  sortYdmProjectItemsForDisplay,
  type YdmProjectBoard,
  type YdmProjectItem,
  type YdmProjectKey,
} from "./yellowDogManProjects.js";
import type { YdmProjectItemRef } from "./ydmProjectsPages.js";

type CacheEntry = {
  at: number;
  boards: YdmProjectBoard[];
  items: YdmProjectItem[];
};

let cache: CacheEntry | null = null;
let refreshInflight: Promise<CacheEntry> | null = null;

function cacheTtlMs(): number {
  return getGitHubCacheTtlMs();
}

function isCacheFresh(entry: CacheEntry, now = Date.now()): boolean {
  return now - entry.at < cacheTtlMs();
}

async function refreshCache(): Promise<CacheEntry> {
  const { boards, items } = await fetchYdmProjectsBundle();
  const entry: CacheEntry = { at: Date.now(), boards, items };
  cache = entry;
  return entry;
}

async function loadCache(): Promise<CacheEntry> {
  const now = Date.now();
  if (cache && isCacheFresh(cache, now)) {
    return cache;
  }
  if (refreshInflight) {
    return refreshInflight;
  }
  refreshInflight = refreshCache().finally(() => {
    refreshInflight = null;
  });
  return refreshInflight;
}

export function clearYdmProjectsCache(): void {
  cache = null;
  refreshInflight = null;
  clearGitHubGraphqlCache();
}

export async function getYdmProjectBoardsCached(): Promise<YdmProjectBoard[]> {
  return (await loadCache()).boards;
}

export async function getYdmProjectsCacheSnapshot(): Promise<{
  boards: YdmProjectBoard[];
  items: YdmProjectItem[];
}> {
  const { boards, items } = await loadCache();
  return { boards, items };
}

export async function getFilteredYdmProjectItems(opts: {
  board: YdmProjectKey | "all";
  includeDone?: boolean;
  doneOnly?: boolean;
  inProgressOnly?: boolean;
  query?: string;
}): Promise<{ boards: YdmProjectBoard[]; items: YdmProjectItem[] }> {
  const { boards, items: raw } = await loadCache();
  let items = filterYdmProjectItems(raw, {
    projectKey: opts.board === "all" ? null : opts.board,
    includeDone: opts.includeDone,
    doneOnly: opts.doneOnly,
    inProgressOnly: opts.inProgressOnly,
  });
  if (opts.query?.trim()) {
    items = searchYdmProjectItems(items, opts.query);
  }
  items = sortYdmProjectItemsForDisplay(items);
  return { boards, items };
}

export async function resolveYdmProjectItemByRef(
  ref: YdmProjectItemRef,
): Promise<YdmProjectItem | null> {
  const { items } = await getFilteredYdmProjectItems({
    board: ref.boardKey,
    includeDone: ref.includeDone,
    inProgressOnly: ref.inProgressOnly,
  });
  return findYdmProjectItem(
    items,
    ref.boardKey,
    ref.number,
    ref.repo,
  );
}

export async function resolveYdmProjectItemForBoardMenu(
  boardKey: YdmProjectKey,
  number: number,
  repo: string | null,
  opts: { includeDone?: boolean; inProgressOnly?: boolean },
): Promise<YdmProjectItem | null> {
  const { items: raw } = await loadCache();
  const items = sortYdmProjectItemsForDisplay(
    filterYdmProjectItems(
      raw.filter((i) => i.projectKey === boardKey),
      {
        includeDone: opts.includeDone,
        inProgressOnly: opts.inProgressOnly,
      },
    ),
  );
  return findYdmProjectItem(items, boardKey, number, repo);
}

/** Titles for slash autocomplete (active items only unless includeDone). */
export async function ydmProjectTitleAutocomplete(
  board: YdmProjectKey | "all",
  query: string,
  includeDone: boolean,
): Promise<string[]> {
  const q = query.trim().toLowerCase();
  const { items } = await getFilteredYdmProjectItems({
    board,
    includeDone,
    doneOnly: false,
  });
  const titles = items.map((i) => i.title);
  if (!q) {
    return titles.slice(0, 25);
  }
  return titles.filter((t) => t.toLowerCase().includes(q)).slice(0, 25);
}
