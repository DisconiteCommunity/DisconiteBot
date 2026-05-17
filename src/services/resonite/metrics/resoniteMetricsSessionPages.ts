import type { ResoniteSessionDto } from "./resoniteMetricsFetch.js";

export const METRICS_MAIN_SESSION_COUNT = 5;
export const METRICS_PAGE_SESSION_COUNT = 5;

export const METRICS_SESSIONS_PAGE_PREFIX = "resonite_metrics_sessions:";

export const METRICS_SESSIONS_PAGE_PATTERN = /^resonite_metrics_sessions:(\d+)$/;

export function encodeMetricsSessionsPageId(pageIndex: number): string {
  return `${METRICS_SESSIONS_PAGE_PREFIX}${pageIndex}`;
}

export function parseMetricsSessionsPageId(customId: string): number | null {
  const m = customId.match(METRICS_SESSIONS_PAGE_PATTERN);
  if (!m) {
    return null;
  }
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function metricsHasExtraSessions(ranked: ResoniteSessionDto[]): boolean {
  return ranked.length > METRICS_MAIN_SESSION_COUNT;
}

export function metricsSessionsPageSlice(
  ranked: ResoniteSessionDto[],
  pageIndex: number,
): ResoniteSessionDto[] {
  const start =
    METRICS_MAIN_SESSION_COUNT + pageIndex * METRICS_PAGE_SESSION_COUNT;
  return ranked.slice(start, start + METRICS_PAGE_SESSION_COUNT);
}

export function metricsSessionsHasPreviousPage(pageIndex: number): boolean {
  return pageIndex > 0;
}

export function metricsSessionsHasMorePages(
  ranked: ResoniteSessionDto[],
  pageIndex: number,
): boolean {
  const nextStart =
    METRICS_MAIN_SESSION_COUNT + (pageIndex + 1) * METRICS_PAGE_SESSION_COUNT;
  return nextStart < ranked.length;
}

/** Number of ephemeral “more sessions” pages (after the 5 on the live metrics post). */
/** Parse 1-based page number from modal input; returns 0-based page index or null. */
export function parseMetricsSessionsPageInput(
  raw: string,
  totalPages: number,
): number | null {
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > totalPages) {
    return null;
  }
  return n - 1;
}

export function metricsSessionsPageCount(ranked: ResoniteSessionDto[]): number {
  const extra = Math.max(0, ranked.length - METRICS_MAIN_SESSION_COUNT);
  if (extra === 0) {
    return 0;
  }
  return Math.ceil(extra / METRICS_PAGE_SESSION_COUNT);
}
