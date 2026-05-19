import { describe, expect, it } from "vitest";
import {
  defaultYdmIssuesSearchState,
  encodeYdmIssuesSearchDashboardId,
  parseYdmIssuesSearchDashboardId,
  ydmIssuesSearchStateWithAuthor,
  ydmIssuesSearchStateWithQuery,
} from "../../../src/services/github/ydmIssuesSearchDashboard.js";

describe("YDM issues search dashboard state", () => {
  it("round-trips compact dashboard custom ids", () => {
    const state = ydmIssuesSearchStateWithAuthor(
      ydmIssuesSearchStateWithQuery(
        {
          ...defaultYdmIssuesSearchState(),
          scope: "repo",
          repo: "Yellow-Dog-Man/Resonite-Issues",
          labels: ["bug", "needs triage"],
        },
        "headless",
      ),
      "Frooxius",
    );

    const id = encodeYdmIssuesSearchDashboardId("run", state);

    expect(id.startsWith("ydmis:run:")).toBe(true);
    expect(id.length).toBeLessThanOrEqual(100);
    expect(parseYdmIssuesSearchDashboardId(id)).toEqual({
      action: "run",
      state,
    });
  });

  it("never exceeds Discord custom_id length for heavy state (all actions)", () => {
    const heavy = ydmIssuesSearchStateWithAuthor(
      ydmIssuesSearchStateWithQuery(
        {
          ...defaultYdmIssuesSearchState(),
          scope: "repo",
          repo: "Yellow-Dog-Man/Resonite-Issues",
          labels: ["x".repeat(40), "y".repeat(40), "z".repeat(40)],
          labelPage: 2,
        },
        "q".repeat(120),
      ),
      "a".repeat(120),
    );
    const actions = [
      "run",
      "labels",
      "label_page_next",
      "repo",
      "clear_labels",
    ] as const;
    for (const action of actions) {
      const id = encodeYdmIssuesSearchDashboardId(action, heavy);
      expect(id.length).toBeLessThanOrEqual(100);
      expect(parseYdmIssuesSearchDashboardId(id)?.action).toBe(action);
    }
  });
});
