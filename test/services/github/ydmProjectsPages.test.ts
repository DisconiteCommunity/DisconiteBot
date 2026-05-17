import { describe, expect, it } from "vitest";
import {
  encodeYdmProjectItemId,
  encodeYdmProjectsPageId,
  parseYdmProjectItemId,
  parseYdmProjectsPageId,
  ydmProjectsPageCount,
  ydmProjectsPageSlice,
} from "../../../src/services/github/ydmProjectsPages.js";
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
  it("pages five items at a time", () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`n${i}`, 100 + i));
    expect(ydmProjectsPageSlice(items, 0)).toHaveLength(5);
    expect(ydmProjectsPageSlice(items, 1)).toHaveLength(5);
    expect(ydmProjectsPageSlice(items, 2)).toHaveLength(2);
    expect(ydmProjectsPageCount(12)).toBe(3);
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
});
