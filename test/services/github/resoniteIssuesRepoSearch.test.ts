import { describe, expect, it } from "vitest";
import { YDM_ISSUES_REPO_RESULTS_PREFIX } from "../../../src/utility/discord/discordInteractionIds.js";
import {
  buildYdmIssuesRepoSearchQuery,
  encodeYdmIssueRepoResultsPageId,
  labelWindow,
  parseYdmIssueRepoResultsPageId,
} from "../../../src/services/github/resoniteIssuesRepoSearch.js";

describe("buildYdmIssuesRepoSearchQuery", () => {
  it("adds repo, issue, author, query, and label qualifiers", () => {
    expect(
      buildYdmIssuesRepoSearchQuery({
        repo: "Yellow-Dog-Man/Resonite-Issues",
        query: "avatar export",
        author: "Frooxius",
        labels: ["bug", "needs triage"],
      }),
    ).toBe(
      'repo:Yellow-Dog-Man/Resonite-Issues is:issue avatar export author:Frooxius label:"bug" label:"needs triage"',
    );
  });

  it("builds GitHub search qualifiers with a single label", () => {
    expect(
      buildYdmIssuesRepoSearchQuery({
        repo: "Yellow-Dog-Man/Resonite-Issues",
        query: "crash",
        author: "Frooxius",
        labels: ["Needs Triage"],
      }),
    ).toBe(
      'repo:Yellow-Dog-Man/Resonite-Issues is:issue crash author:Frooxius label:"Needs Triage"',
    );
  });
});

describe("YDM issues repo results state", () => {
  it("round-trips pagination state", () => {
    const id = encodeYdmIssueRepoResultsPageId({
      v: 1,
      p: 2,
      repo: "Yellow-Dog-Man/Resonite-Issues",
      query: "avatar",
      author: "Frooxius",
      labels: ["bug"],
    });

    expect(id.startsWith("ydmisr:")).toBe(true);
    expect(parseYdmIssueRepoResultsPageId(id)).toEqual({
      v: 1,
      p: 2,
      repo: "Yellow-Dog-Man/Resonite-Issues",
      query: "avatar",
      author: "Frooxius",
      labels: ["bug"],
    });
  });

  it("encodes negative page for disabled prev without colliding with page 0", () => {
    const base = {
      v: 1 as const,
      repo: "Yellow-Dog-Man/Resonite-Issues" as const,
      query: "x",
    };
    const prevId = encodeYdmIssueRepoResultsPageId({ ...base, p: -1 });
    const currId = encodeYdmIssueRepoResultsPageId({ ...base, p: 0 });
    expect(prevId).not.toBe(currId);
    expect(parseYdmIssueRepoResultsPageId(prevId)).toEqual({
      v: 1,
      p: 0,
      repo: "Yellow-Dog-Man/Resonite-Issues",
      query: "x",
    });
    expect(parseYdmIssueRepoResultsPageId(currId)).toEqual({
      v: 1,
      p: 0,
      repo: "Yellow-Dog-Man/Resonite-Issues",
      query: "x",
    });
  });

  it("keeps pagination custom ids within 100 chars for heavy search state", () => {
    const id = encodeYdmIssueRepoResultsPageId({
      v: 1,
      p: 4,
      repo: "Yellow-Dog-Man/Resonite-Issues",
      query: "q".repeat(200),
      author: "u".repeat(200),
      labels: ["L".repeat(40), "M".repeat(40), "N".repeat(40)],
    });
    expect(id.length).toBeLessThanOrEqual(100);
    const parsed = parseYdmIssueRepoResultsPageId(id);
    expect(parsed?.v).toBe(1);
    expect(parsed?.repo).toBe("Yellow-Dog-Man/Resonite-Issues");
    expect(parsed?.p).toBe(4);
  });

  it("parses legacy wire payloads that use full repo name in r", () => {
    const legacy = `${YDM_ISSUES_REPO_RESULTS_PREFIX}${Buffer.from(
      JSON.stringify({ v: 1, p: 2, r: "Yellow-Dog-Man/Locale", q: "locale" }),
      "utf8",
    ).toString("base64url")}`;
    expect(parseYdmIssueRepoResultsPageId(legacy)).toEqual({
      v: 1,
      p: 2,
      repo: "Yellow-Dog-Man/Locale",
      query: "locale",
    });
  });
});

describe("labelWindow", () => {
  it("returns capped label pages and clamps out-of-range pages", () => {
    const labels = Array.from({ length: 23 }, (_, i) => `label-${i}`);

    expect(labelWindow(labels, 0)).toEqual({
      labels: labels.slice(0, 23),
      page: 0,
      totalPages: 1,
    });
    expect(labelWindow(labels, 99)).toEqual({
      labels: labels.slice(0, 23),
      page: 0,
      totalPages: 1,
    });
  });

  it("returns a label window plus pagination metadata", () => {
    const labels = Array.from({ length: 50 }, (_, i) => `label-${i}`);
    const window = labelWindow(labels, 1);
    expect(window.labels).toHaveLength(25);
    expect(window.labels[0]).toBe("label-25");
    expect(window.page).toBe(1);
    expect(window.totalPages).toBe(2);
  });
});
