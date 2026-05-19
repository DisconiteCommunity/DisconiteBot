import {
  isYdmProjectKey,
  parseYdmProjectBoardKey,
  type YdmProjectItem,
  type YdmProjectKey,
} from "./yellowDogManProjects.js";

/** Discord string selects allow at most 25 options; match page size to one menu per page. */
export const YDM_PROJECTS_PAGE_SIZE = 25;

/** Status filter menu: show all Kanban columns. */
export const YDM_PROJECTS_STATUS_FILTER_ALL = "_all";

/** Status filter menu: items with no GitHub Status set. */
export const YDM_PROJECTS_STATUS_FILTER_NONE = "_none_status";

export type YdmProjectsViewMode = "list" | "search";

export type YdmProjectsBoardParam = "all" | YdmProjectKey;

function isYdmProjectsBoardParam(b: string): b is YdmProjectsBoardParam {
  return b === "all" || isYdmProjectKey(b);
}

export type YdmProjectsPageState = {
  v: 1;
  m: YdmProjectsViewMode;
  b: YdmProjectsBoardParam;
  p: number;
  d?: 1;
  i?: 1;
  q?: string;
  /** GitHub project Status field; omit or empty = all columns. */
  statusFilter?: string;
};

/** Resolved from a “view issue” button (`ydmpi:board|number|repo|flags`). */
export type YdmProjectItemRef = {
  boardKey: YdmProjectKey;
  number: number;
  repo: string | null;
  includeDone: boolean;
  inProgressOnly: boolean;
};

export const YDM_PROJECT_ITEM_ID_MAX_LEN = 100;

export function ydmProjectsPageCount(itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }
  return Math.ceil(itemCount / YDM_PROJECTS_PAGE_SIZE);
}

export function ydmProjectsPageSlice(
  items: readonly YdmProjectItem[],
  pageIndex: number,
): YdmProjectItem[] {
  const start = pageIndex * YDM_PROJECTS_PAGE_SIZE;
  return items.slice(start, start + YDM_PROJECTS_PAGE_SIZE);
}

export function ydmProjectsHasPreviousPage(pageIndex: number): boolean {
  return pageIndex > 0;
}

export function ydmProjectsHasMorePages(
  items: readonly YdmProjectItem[],
  pageIndex: number,
): boolean {
  return (pageIndex + 1) * YDM_PROJECTS_PAGE_SIZE < items.length;
}

export function clampYdmProjectsPageIndex(
  pageIndex: number,
  totalPages: number,
): number {
  if (totalPages <= 0) {
    return 0;
  }
  return Math.min(Math.max(0, pageIndex), totalPages - 1);
}

function toBase64Url(json: string): string {
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(encoded: string): string {
  const pad = encoded.length % 4 === 0 ? "" : "=".repeat(4 - (encoded.length % 4));
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64").toString("utf8");
}

export function encodeYdmProjectsPageId(state: YdmProjectsPageState): string {
  const statusFilter =
    typeof state.statusFilter === "string" && state.statusFilter.trim()
      ? state.statusFilter.trim().slice(0, 100)
      : undefined;
  const compact: YdmProjectsPageState = {
    v: 1,
    m: state.m,
    b: state.b,
    p: state.p,
    ...(state.d ? { d: 1 } : {}),
    ...(state.i ? { i: 1 } : {}),
    ...(state.q ? { q: state.q.slice(0, 48) } : {}),
    ...(statusFilter ? { statusFilter } : {}),
  };
  return `ydmp:${toBase64Url(JSON.stringify(compact))}`;
}

export function parseYdmProjectsPageId(customId: string): YdmProjectsPageState | null {
  if (!customId.startsWith("ydmp:")) {
    return null;
  }
  try {
    const raw = JSON.parse(fromBase64Url(customId.slice(5))) as YdmProjectsPageState;
    if (raw.v !== 1 || (raw.m !== "list" && raw.m !== "search")) {
      return null;
    }
    if (!isYdmProjectsBoardParam(raw.b)) {
      return null;
    }
    if (!Number.isFinite(raw.p)) {
      return null;
    }
    const statusRaw =
      typeof raw.statusFilter === "string" ? raw.statusFilter.trim() : "";
    return {
      v: 1,
      m: raw.m,
      b: raw.b,
      p: Math.max(0, Math.floor(raw.p)),
      ...(raw.d ? { d: 1 } : {}),
      ...(raw.i ? { i: 1 } : {}),
      ...(raw.q ? { q: raw.q } : {}),
      ...(statusRaw ? { statusFilter: statusRaw.slice(0, 100) } : {}),
    };
  } catch {
    return null;
  }
}

export function encodeYdmProjectItemId(ref: YdmProjectItemRef): string {
  const d = ref.includeDone ? "1" : "0";
  const i = ref.inProgressOnly ? "1" : "0";
  const id = `ydmpi:${ref.boardKey}|${ref.number}|${ref.repo ?? ""}|${d}${i}`;
  if (id.length > YDM_PROJECT_ITEM_ID_MAX_LEN) {
    throw new Error(
      `YDM project item custom_id exceeds ${YDM_PROJECT_ITEM_ID_MAX_LEN} characters`,
    );
  }
  return id;
}

export function parseYdmProjectItemId(
  customId: string,
): YdmProjectItemRef | null {
  if (!customId.startsWith("ydmpi:")) {
    return null;
  }
  const parts = customId.slice(6).split("|");
  if (parts.length !== 4) {
    return null;
  }
  const [boardKey, numberRaw, repoRaw, flags] = parts;
  if (!boardKey || !isYdmProjectKey(boardKey) || !flags || flags.length !== 2) {
    return null;
  }
  const number = parseInt(numberRaw!, 10);
  if (!Number.isFinite(number) || number < 1) {
    return null;
  }
  if (flags[0] !== "0" && flags[0] !== "1") {
    return null;
  }
  if (flags[1] !== "0" && flags[1] !== "1") {
    return null;
  }
  return {
    boardKey,
    number,
    repo: repoRaw ? repoRaw : null,
    includeDone: flags[0] === "1",
    inProgressOnly: flags[1] === "1",
  };
}

export function parseYdmProjectsBoardParam(
  raw: string | null | undefined,
): YdmProjectsBoardParam | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "all") {
    return "all";
  }
  return parseYdmProjectBoardKey(raw);
}

/** Narrow board items by GitHub project Status (Kanban column). */
export function filterYdmProjectItemsByStatusColumn(
  items: readonly YdmProjectItem[],
  statusFilter: string | undefined,
): YdmProjectItem[] {
  if (
    !statusFilter ||
    statusFilter === YDM_PROJECTS_STATUS_FILTER_ALL
  ) {
    return [...items];
  }
  if (statusFilter === YDM_PROJECTS_STATUS_FILTER_NONE) {
    return items.filter((item) => !item.status?.trim());
  }
  return items.filter(
    (item) => (item.status?.trim() ?? "") === statusFilter,
  );
}
