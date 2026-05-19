import {
  isYdmProjectKey,
  parseYdmProjectBoardKey,
  type YdmProjectItem,
  type YdmProjectKey,
} from "./yellowDogManProjects.js";

/** Discord string selects allow at most 25 options; match page size to one menu per page. */
export const YDM_PROJECTS_PAGE_SIZE = 25;

/**
 * Page size when the board list is opened from **`/resonite search` `github`** (boards scope).
 * Smaller than {@link YDM_PROJECTS_PAGE_SIZE} so each message stays readable.
 */
export const YDM_ISSUES_SEARCH_BOARDS_PAGE_SIZE = 10;

/**
 * Max base64url payload length after the `ydmp:` prefix so the full string fits Discord’s
 * 100-char `custom_id` limit (used by page buttons and by `yi:` / `ys:` string selects).
 */
export const YDM_PROJECTS_PAGE_ID_B64_MAX = 95;

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
  /**
   * Items per page when rendering board list/search (default {@link YDM_PROJECTS_PAGE_SIZE}).
   * Serialized as `ps` in `ydmp:` wire when not the default.
   */
  pageSize?: number;
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

export function ydmProjectsPageCount(
  itemCount: number,
  pageSize: number = YDM_PROJECTS_PAGE_SIZE,
): number {
  if (itemCount <= 0 || pageSize <= 0) {
    return 0;
  }
  return Math.ceil(itemCount / pageSize);
}

export function ydmProjectsPageSlice(
  items: readonly YdmProjectItem[],
  pageIndex: number,
  pageSize: number = YDM_PROJECTS_PAGE_SIZE,
): YdmProjectItem[] {
  const start = pageIndex * pageSize;
  return items.slice(start, start + pageSize);
}

export function ydmProjectsHasPreviousPage(pageIndex: number): boolean {
  return pageIndex > 0;
}

export function ydmProjectsHasMorePages(
  items: readonly YdmProjectItem[],
  pageIndex: number,
  pageSize: number = YDM_PROJECTS_PAGE_SIZE,
): boolean {
  return (pageIndex + 1) * pageSize < items.length;
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

/** Wire JSON uses short keys so `ydmp:` + base64 stays within Discord’s 100-char limit. */
type YdmProjectsPageWire = {
  v: 1;
  /** `"l"` = list, `"s"` = search */
  m: "l" | "s";
  b: YdmProjectsBoardParam;
  p: number;
  d?: 1;
  i?: 1;
  q?: string;
  /** Status column filter (short for `statusFilter`) */
  f?: string;
  /** Page size when not {@link YDM_PROJECTS_PAGE_SIZE} */
  ps?: number;
};

function wireToBase64(wire: YdmProjectsPageWire): string {
  return toBase64Url(JSON.stringify(wire));
}

export function encodeYdmProjectsPageId(state: YdmProjectsPageState): string {
  let q =
    state.m === "search" && typeof state.q === "string" && state.q.trim()
      ? state.q.trim().slice(0, 48)
      : undefined;
  let f =
    typeof state.statusFilter === "string" && state.statusFilter.trim()
      ? state.statusFilter.trim().slice(0, 100)
      : undefined;

  const pageSizeWire =
    typeof state.pageSize === "number" &&
    Number.isFinite(state.pageSize) &&
    state.pageSize > 0 &&
    state.pageSize <= YDM_PROJECTS_PAGE_SIZE &&
    state.pageSize !== YDM_PROJECTS_PAGE_SIZE
      ? Math.floor(state.pageSize)
      : undefined;

  const baseWire = (): YdmProjectsPageWire => ({
    v: 1,
    m: state.m === "list" ? "l" : "s",
    b: state.b,
    p: state.p,
    ...(state.d ? { d: 1 as const } : {}),
    ...(state.i ? { i: 1 as const } : {}),
    ...(q ? { q } : {}),
    ...(f ? { f } : {}),
    ...(pageSizeWire ? { ps: pageSizeWire } : {}),
  });

  for (;;) {
    const b64 = wireToBase64(baseWire());
    if (b64.length <= YDM_PROJECTS_PAGE_ID_B64_MAX) {
      return `ydmp:${b64}`;
    }
    if (q && q.length > 0) {
      q = q.slice(0, Math.max(0, q.length - 8));
      continue;
    }
    q = undefined;
    if (f && f.length > 0) {
      f = f.slice(0, Math.max(0, f.length - 8));
      continue;
    }
    f = undefined;
    const minimal = wireToBase64({
      v: 1,
      m: state.m === "list" ? "l" : "s",
      b: state.b,
      p: state.p,
      ...(state.d ? { d: 1 as const } : {}),
      ...(state.i ? { i: 1 as const } : {}),
      ...(pageSizeWire ? { ps: pageSizeWire } : {}),
    });
    if (minimal.length > YDM_PROJECTS_PAGE_ID_B64_MAX) {
      throw new Error(
        "YDM projects page state cannot be encoded within Discord custom_id limits",
      );
    }
    return `ydmp:${minimal}`;
  }
}

export function parseYdmProjectsPageId(customId: string): YdmProjectsPageState | null {
  if (!customId.startsWith("ydmp:")) {
    return null;
  }
  try {
    const raw = JSON.parse(fromBase64Url(customId.slice(5))) as
      | YdmProjectsPageState
      | YdmProjectsPageWire
      | Record<string, unknown>;
    if (raw.v !== 1) {
      return null;
    }
    const modeRaw = raw.m;
    const m =
      modeRaw === "list" || modeRaw === "l"
        ? "list"
        : modeRaw === "search" || modeRaw === "s"
          ? "search"
          : null;
    if (!m) {
      return null;
    }
    const b = (raw as { b?: unknown }).b;
    if (typeof b !== "string" || !isYdmProjectsBoardParam(b)) {
      return null;
    }
    const pRaw = (raw as { p?: unknown }).p;
    if (!Number.isFinite(pRaw)) {
      return null;
    }
    const wire = raw as { q?: unknown; f?: unknown; statusFilter?: unknown };
    const q =
      typeof wire.q === "string" && wire.q.length > 0 ? wire.q : undefined;
    const statusFromF = typeof wire.f === "string" ? wire.f.trim() : "";
    const statusLegacy =
      typeof wire.statusFilter === "string" ? wire.statusFilter.trim() : "";
    const statusRaw = (statusFromF || statusLegacy).trim();
    const psRaw = (raw as { ps?: unknown }).ps;
    let pageSize: number | undefined;
    if (
      typeof psRaw === "number" &&
      Number.isFinite(psRaw) &&
      psRaw > 0 &&
      psRaw <= YDM_PROJECTS_PAGE_SIZE
    ) {
      const ps = Math.floor(psRaw);
      if (ps !== YDM_PROJECTS_PAGE_SIZE) {
        pageSize = ps;
      }
    }
    return {
      v: 1,
      m,
      b,
      p: Math.max(0, Math.floor(Number(pRaw))),
      ...(raw.d ? { d: 1 } : {}),
      ...(raw.i ? { i: 1 } : {}),
      ...(q ? { q } : {}),
      ...(statusRaw ? { statusFilter: statusRaw.slice(0, 100) } : {}),
      ...(pageSize !== undefined ? { pageSize } : {}),
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
