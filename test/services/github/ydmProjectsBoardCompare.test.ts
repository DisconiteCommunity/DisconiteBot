import { describe, expect, it } from "vitest";
import {
  computeYdmBoardCompareRows,
  encodeYdmIssueSelectValue,
  formatYdmBoardCompareMarkdown,
  parseYdmIssueSelectValue,
  pickYdmIssueSelectOptions,
} from "../../../src/services/github/ydmProjectsBoardCompare.js";
import type { YdmProjectBoard, YdmProjectItem } from "../../../src/services/github/yellowDogManProjects.js";

const boards: YdmProjectBoard[] = [
  {
    key: "froox",
    number: 47,
    memberLabel: "Frooxius",
    boardUrl: "https://example.com/f",
    title: "Froox board",
  },
  {
    key: "prime",
    number: 17,
    memberLabel: "ProbablePrime",
    boardUrl: "https://example.com/p",
    title: "Prime board",
  },
];

let issueSeq = 100;

function item(
  projectKey: YdmProjectItem["projectKey"],
  title: string,
  status: string,
): YdmProjectItem {
  const number = issueSeq++;
  return {
    projectKey,
    projectTitle: "T",
    memberLabel: projectKey,
    title,
    number,
    url: `https://github.com/o/r/issues/${number}`,
    status,
    state: status === "Done" ? "CLOSED" : "OPEN",
    repo: "o/r",
    body: null,
  };
}

describe("pickYdmIssueSelectOptions", () => {
  it("round-robins across boards up to the limit", () => {
    const all = [
      item("froox", "A1", "Open"),
      item("froox", "A2", "Open"),
      item("prime", "B1", "Open"),
    ];
    const picked = pickYdmIssueSelectOptions(boards, all, {}, 4);
    expect(picked.map((p) => p.item.title)).toEqual(["A1", "B1", "A2"]);
  });
});

describe("parseYdmIssueSelectValue", () => {
  it("round-trips with encode", () => {
    const value = encodeYdmIssueSelectValue("gawdl3y", 42, "o/r");
    expect(parseYdmIssueSelectValue(value)).toEqual({
      boardKey: "gawdl3y",
      number: 42,
      repo: "o/r",
    });
  });
});

describe("computeYdmBoardCompareRows", () => {
  it("counts per board and hides done by default", () => {
    const all = [
      item("froox", "Active", "In Progress"),
      item("froox", "Old", "Done"),
      item("prime", "Other", "Doing"),
    ];
    const rows = computeYdmBoardCompareRows(boards, all, {});
    expect(rows[0]?.visibleCount).toBe(1);
    expect(rows[0]?.inProgressCount).toBe(1);
    expect(rows[1]?.visibleCount).toBe(1);
    const text = formatYdmBoardCompareMarkdown(rows, {});
    expect(text).toContain("Frooxius");
    expect(text).toContain("1 shown · 1 in progress");
    expect(text).not.toContain("| --- |");
  });
});
