import { describe, expect, it } from "vitest";
import {
  filterYdmProjectItems,
  formatProjectItemLine,
  isDoneItem,
  isInProgressItem,
  parseYdmProjectBoardKey,
  parseYdmProjectBoardKeyWithBoards,
  searchYdmProjectItems,
  ydmBoardDisplayName,
  YDM_PROJECT_BOARDS,
  type YdmProjectBoard,
  type YdmProjectItem,
} from "../../../src/services/github/yellowDogManProjects.js";

function sampleItem(overrides: Partial<YdmProjectItem> = {}): YdmProjectItem {
  return {
    projectKey: "froox",
    projectTitle: "Frooxius",
    memberLabel: "Frooxius",
    title: "IK system rewrite",
    number: 612,
    url: "https://github.com/Yellow-Dog-Man/Resonite-Issues/issues/612",
    status: "In Progress",
    state: "OPEN",
    repo: "Yellow-Dog-Man/Resonite-Issues",
    body: "Full body IK",
    ...overrides,
  };
}

describe("isDoneItem", () => {
  it("detects done status and closed state", () => {
    expect(isDoneItem(sampleItem({ status: "Done" }))).toBe(true);
    expect(isDoneItem(sampleItem({ state: "CLOSED", status: null }))).toBe(true);
    expect(isDoneItem(sampleItem({ status: "In Progress" }))).toBe(false);
  });
});

describe("filterYdmProjectItems done", () => {
  it("excludes done items by default", () => {
    const items = [
      sampleItem({ status: "In Progress" }),
      sampleItem({ title: "Old", status: "Done" }),
    ];
    expect(filterYdmProjectItems(items, {})).toHaveLength(1);
    expect(filterYdmProjectItems(items, { includeDone: true })).toHaveLength(2);
  });
});

describe("isInProgressItem", () => {
  it("matches common in-progress status labels", () => {
    expect(isInProgressItem(sampleItem({ status: "In Progress" }))).toBe(true);
    expect(isInProgressItem(sampleItem({ status: "Doing" }))).toBe(true);
  });

  it("rejects done or empty status", () => {
    expect(isInProgressItem(sampleItem({ status: "Done" }))).toBe(false);
    expect(isInProgressItem(sampleItem({ status: null }))).toBe(false);
  });
});

describe("searchYdmProjectItems", () => {
  const items = [
    sampleItem({ title: "Alpha feature" }),
    sampleItem({ projectKey: "prime", memberLabel: "ProbablePrime", title: "Beta" }),
  ];

  it("finds items by title keyword", () => {
    const hits = searchYdmProjectItems(items, "alpha");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.title).toBe("Alpha feature");
  });
});

describe("filterYdmProjectItems", () => {
  it("filters by project key", () => {
    const items = [
      sampleItem({ projectKey: "froox" }),
      sampleItem({ projectKey: "j4", memberLabel: "J4" }),
    ];
    const filtered = filterYdmProjectItems(items, { projectKey: "j4" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.projectKey).toBe("j4");
  });
});

describe("formatProjectItemLine", () => {
  it("uses the GitHub issue number", () => {
    const line = formatProjectItemLine(sampleItem());
    expect(line).toContain("#612");
    expect(line).toContain("IK system rewrite");
    expect(line).toContain("In Progress");
  });
});

describe("YDM_PROJECT_BOARDS", () => {
  it("includes community and gawdl3y org projects", () => {
    const keys = YDM_PROJECT_BOARDS.map((b) => b.key);
    expect(keys).toContain("gawdl3y");
    expect(keys).toContain("community");
    expect(YDM_PROJECT_BOARDS.find((b) => b.number === 45)?.boardUrl).toContain(
      "/projects/45",
    );
    expect(YDM_PROJECT_BOARDS.find((b) => b.number === 30)?.boardUrl).toContain(
      "/projects/30",
    );
  });
});

describe("ydmBoardDisplayName", () => {
  it("prefers GitHub project title over static member label", () => {
    const b = { ...YDM_PROJECT_BOARDS[0], title: "Jae's Tasks" } as YdmProjectBoard;
    expect(ydmBoardDisplayName(b)).toBe("Jae's Tasks");
  });

  it("falls back to memberLabel when title is the placeholder", () => {
    const b = { ...YDM_PROJECT_BOARDS[0], title: "Frooxius board" } as YdmProjectBoard;
    expect(ydmBoardDisplayName(b)).toBe("Frooxius");
  });
});

describe("parseYdmProjectBoardKeyWithBoards", () => {
  it("resolves board by GitHub title or substring", () => {
    const boards = [
      { ...YDM_PROJECT_BOARDS[0], title: "Jae's Tasks" },
      { ...YDM_PROJECT_BOARDS[1], title: "Prime backlog" },
    ] as YdmProjectBoard[];
    expect(parseYdmProjectBoardKeyWithBoards(boards, "Jae's Tasks")).toBe("froox");
    expect(parseYdmProjectBoardKeyWithBoards(boards, "jae")).toBe("froox");
  });
});

describe("parseYdmProjectBoardKey", () => {
  it("accepts keys and member labels", () => {
    expect(parseYdmProjectBoardKey("gawdl3y")).toBe("gawdl3y");
    expect(parseYdmProjectBoardKey("Community Help")).toBe("community");
  });
});
