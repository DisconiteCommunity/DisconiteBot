import { describe, it, expect, vi } from "vitest";

vi.mock("../../../config/disconite.js", () => ({
  getDisconiteForumBaseUrl: () => "https://disconite.net",
}));

import {
  buildForumPostUrl,
  formatForumAuthorLine,
  trustLevelLabel,
} from "./searchPosts.js";

describe("buildForumPostUrl", () => {
  it("builds topic post URLs", () => {
    expect(buildForumPostUrl("my-topic", 32, 1)).toBe(
      "https://disconite.net/t/my-topic/32/1",
    );
  });
});

describe("trustLevelLabel", () => {
  it("maps known trust levels", () => {
    expect(trustLevelLabel(4)).toBe("Leader");
    expect(trustLevelLabel(0)).toBe("New User");
  });

  it("returns null for undefined", () => {
    expect(trustLevelLabel(undefined)).toBeNull();
  });
});

describe("formatForumAuthorLine", () => {
  it("prefixes forum account and shows trust and roles", () => {
    const line = formatForumAuthorLine(
      { username: "gloopy", name: "Gloopy" },
      {
        trust_level: 4,
        moderator: true,
        title: "Volunteer Moderator",
      },
      ["Leader", "Editor"],
    );
    expect(line).toContain("Forum account");
    expect(line).toContain("@gloopy");
    expect(line).toContain("Leader");
    expect(line).toContain("Moderator");
    expect(line).toContain("Volunteer Moderator");
    expect(line).toContain("Badges:");
  });
});
