import { describe, expect, it } from "vitest";
import {
  encodeYdmProjectItemId,
  encodeYdmProjectsPageId,
  filterYdmProjectItemsByStatusColumn,
  parseYdmProjectItemId,
  parseYdmProjectsPageId,
  YDM_PROJECTS_PAGE_ID_B64_MAX,
  YDM_PROJECTS_STATUS_FILTER_NONE,
  ydmProjectsPageCount,
  ydmProjectsPageSlice,
} from "../../../src/services/github/ydmProjectsPages.js";
import {
  YDM_PROJECTS_ITEM_SELECT_PREFIX,
  YDM_PROJECTS_STATUS_SELECT_PREFIX,
} from "../../../src/utility/discord/discordInteractionIds.js";
import type { YdmProjectItem } from "../../../src/services/github/yellowDogManProjects.js";

function item(title: string, number: number): YdmProjectItem {
  return {
    projectKey: "froox",
    projectTitle: "T",
    memberLabel: "Frooxius",
    title,
    number,
    url: `https://github.com/Yellow-Dog-Man/Resonite-Issues/issues/${number}`,
    status: "In Progress",
    state: "OPEN",
    repo: "Yellow-Dog-Man/Resonite-Issues",
    body: null,
  };
}

describe("ydmProjectsPageSlice", () => {
  it("pages twenty-five items at a time by default", () => {
    const items = Array.from({ length: 60 }, (_, i) => item(`n${i}`, 100 + i));
    expect(ydmProjectsPageSlice(items, 0)).toHaveLength(25);
    expect(ydmProjectsPageSlice(items, 1)).toHaveLength(25);
    expect(ydmProjectsPageSlice(items, 2)).toHaveLength(10);
    expect(ydmProjectsPageCount(60)).toBe(3);
  });

  it("accepts a custom page size", () => {
    const items = Array.from({ length: 25 }, (_, i) => item(`n${i}`, 200 + i));
    expect(ydmProjectsPageSlice(items, 0, 10)).toHaveLength(10);
    expect(ydmProjectsPageSlice(items, 1, 10)).toHaveLength(10);
    expect(ydmProjectsPageSlice(items, 2, 10)).toHaveLength(5);
    expect(ydmProjectsPageCount(25, 10)).toBe(3);
  });
});

describe("encodeYdmProjectItemId", () => {
  it("round-trips item ref", () => {
    const id = encodeYdmProjectItemId({
      boardKey: "froox",
      number: 612,
      repo: "Yellow-Dog-Man/Resonite-Issues",
      includeDone: false,
      inProgressOnly: true,
    });
    expect(id).toBe("ydmpi:froox|612|Yellow-Dog-Man/Resonite-Issues|01");
    expect(id.length).toBeLessThanOrEqual(100);
    expect(parseYdmProjectItemId(id)).toEqual({
      boardKey: "froox",
      number: 612,
      repo: "Yellow-Dog-Man/Resonite-Issues",
      includeDone: false,
      inProgressOnly: true,
    });
  });
});

describe("encodeYdmProjectsPageId", () => {
  it("round-trips optional page size for GitHub search boards view", () => {
    const id = encodeYdmProjectsPageId({
      v: 1,
      m: "search",
      b: "all",
      p: 0,
      pageSize: 10,
      q: "bug",
    });
    expect(parseYdmProjectsPageId(id)).toEqual({
      v: 1,
      m: "search",
      b: "all",
      p: 0,
      pageSize: 10,
      q: "bug",
    });
  });

  it("round-trips list state", () => {
    const id = encodeYdmProjectsPageId({
      v: 1,
      m: "search",
      b: "all",
      p: 2,
      d: 1,
      q: "avatar",
    });
    expect(id.startsWith("ydmp:")).toBe(true);
    expect(parseYdmProjectsPageId(id)).toEqual({
      v: 1,
      m: "search",
      b: "all",
      p: 2,
      d: 1,
      q: "avatar",
    });
  });

  it("clamps negative page index in custom id to zero", () => {
    const prevStub = encodeYdmProjectsPageId({
      v: 1,
      m: "search",
      b: "all",
      p: -1,
      q: "x",
    });
    const currentPage = encodeYdmProjectsPageId({
      v: 1,
      m: "search",
      b: "all",
      p: 0,
      q: "x",
    });
    expect(prevStub).not.toBe(currentPage);
    expect(parseYdmProjectsPageId(prevStub)).toEqual({
      v: 1,
      m: "search",
      b: "all",
      p: 0,
      q: "x",
    });
  });

  it("round-trips status filter on page state", () => {
    const id = encodeYdmProjectsPageId({
      v: 1,
      m: "list",
      b: "froox",
      p: 0,
      statusFilter: "In Progress",
    });
    expect(parseYdmProjectsPageId(id)).toEqual({
      v: 1,
      m: "list",
      b: "froox",
      p: 0,
      statusFilter: "In Progress",
    });
  });

  it("fits Discord custom_id limits even with long search + status filter", () => {
    const id = encodeYdmProjectsPageId({
      v: 1,
      m: "search",
      b: "all",
      p: 0,
      d: 1,
      i: 1,
      q: "q".repeat(48),
      statusFilter: "s".repeat(100),
    });
    const b64 = id.slice("ydmp:".length);
    expect(b64.length).toBeLessThanOrEqual(YDM_PROJECTS_PAGE_ID_B64_MAX);
    expect(
      `${YDM_PROJECTS_STATUS_SELECT_PREFIX}${b64}`.length,
    ).toBeLessThanOrEqual(100);
    expect(`${YDM_PROJECTS_ITEM_SELECT_PREFIX}${b64}`.length).toBeLessThanOrEqual(
      100,
    );
    const parsed = parseYdmProjectsPageId(id);
    expect(parsed).not.toBeNull();
    expect(parsed?.m).toBe("search");
    expect(parsed?.b).toBe("all");
  });
});

describe("filterYdmProjectItemsByStatusColumn", () => {
  it("keeps only matching status or blank bucket", () => {
    const items = [
      item("a", 1),
      { ...item("b", 2), status: "Done" },
      { ...item("c", 3), status: null },
    ];
    expect(filterYdmProjectItemsByStatusColumn(items, "In Progress")).toHaveLength(
      1,
    );
    expect(
      filterYdmProjectItemsByStatusColumn(items, YDM_PROJECTS_STATUS_FILTER_NONE),
    ).toHaveLength(1);
  });
});
