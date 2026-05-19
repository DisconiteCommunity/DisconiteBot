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
});
