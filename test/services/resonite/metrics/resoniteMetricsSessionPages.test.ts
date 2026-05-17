import { describe, expect, it } from "vitest";
import {
  METRICS_MAIN_SESSION_COUNT,
  METRICS_PAGE_SESSION_COUNT,
  encodeMetricsSessionsPageId,
  metricsHasExtraSessions,
  metricsSessionsHasMorePages,
  metricsSessionsPageCount,
  metricsSessionsPageSlice,
  parseMetricsSessionsPageId,
  parseMetricsSessionsPageInput,
} from "../../../../src/services/resonite/metrics/resoniteMetricsSessionPages.js";

describe("metricsSessionsPageSlice", () => {
  const ranked = Array.from({ length: 13 }, (_, i) => ({
    sessionId: `s-${i}`,
    activeUsers: 13 - i,
  }));

  it("skips the main-message sessions", () => {
    const page0 = metricsSessionsPageSlice(ranked, 0);
    expect(page0).toHaveLength(METRICS_PAGE_SESSION_COUNT);
    expect(page0[0]?.sessionId).toBe(`s-${METRICS_MAIN_SESSION_COUNT}`);

    const page1 = metricsSessionsPageSlice(ranked, 1);
    expect(page1).toHaveLength(3);
    expect(page1[0]?.sessionId).toBe(
      `s-${METRICS_MAIN_SESSION_COUNT + METRICS_PAGE_SESSION_COUNT}`,
    );
  });
});

describe("metrics session page ids", () => {
  it("round-trips page index", () => {
    const id = encodeMetricsSessionsPageId(2);
    expect(parseMetricsSessionsPageId(id)).toBe(2);
  });
});

describe("metricsHasExtraSessions", () => {
  it("is true when more than main count", () => {
    expect(
      metricsHasExtraSessions(
        Array.from({ length: METRICS_MAIN_SESSION_COUNT + 1 }, () => ({
          activeUsers: 1,
        })),
      ),
    ).toBe(true);
  });
});

describe("metricsSessionsHasMorePages", () => {
  it("detects another page", () => {
    const ranked = Array.from({ length: 12 }, () => ({ activeUsers: 1 }));
    expect(metricsSessionsHasMorePages(ranked, 0)).toBe(true);
    expect(metricsSessionsHasMorePages(ranked, 1)).toBe(false);
  });
});

describe("parseMetricsSessionsPageInput", () => {
  it("parses 1-based page numbers", () => {
    expect(parseMetricsSessionsPageInput("1", 3)).toBe(0);
    expect(parseMetricsSessionsPageInput(" 3 ", 3)).toBe(2);
    expect(parseMetricsSessionsPageInput("0", 3)).toBeNull();
    expect(parseMetricsSessionsPageInput("4", 3)).toBeNull();
    expect(parseMetricsSessionsPageInput("x", 3)).toBeNull();
  });
});

describe("metricsSessionsPageCount", () => {
  it("counts extra-session pages", () => {
    expect(metricsSessionsPageCount([])).toBe(0);
    expect(
      metricsSessionsPageCount(
        Array.from({ length: METRICS_MAIN_SESSION_COUNT }, () => ({
          activeUsers: 1,
        })),
      ),
    ).toBe(0);
    expect(
      metricsSessionsPageCount(
        Array.from({ length: METRICS_MAIN_SESSION_COUNT + 6 }, () => ({
          activeUsers: 1,
        })),
      ),
    ).toBe(2);
  });
});
