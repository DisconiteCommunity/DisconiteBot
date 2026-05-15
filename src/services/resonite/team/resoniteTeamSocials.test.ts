import { describe, it, expect } from "vitest";
import {
  getAllMemberLinks,
  getAvailablePlatformsForMember,
  matchTeamMemberFromQuery,
  normalizePlatformInput,
  platformAutocompleteForUser,
  resolveMemberPlatformLinks,
  RESONITE_TEAM_ROSTER,
  teamMemberAutocomplete,
} from "./resoniteTeamSocials.js";

describe("normalizePlatformInput", () => {
  it("maps x to twitter and resonite to wiki", () => {
    expect(normalizePlatformInput("x")).toBe("twitter");
    expect(normalizePlatformInput("resonite")).toBe("wiki");
  });
});

describe("matchTeamMemberFromQuery", () => {
  it("matches roster id", () => {
    expect(matchTeamMemberFromQuery("frooxius")?.displayName).toBe("Frooxius");
  });

  it("returns null for unknown", () => {
    expect(matchTeamMemberFromQuery("not_a_person_xyz")).toBeNull();
  });
});

describe("getAvailablePlatformsForMember", () => {
  it("includes wiki only when member has no socials", () => {
    const chroma = RESONITE_TEAM_ROSTER.find((m) => m.id === "chroma");
    if (!chroma) {
      throw new Error("chroma not in test roster");
    }
    const platforms = getAvailablePlatformsForMember(chroma);
    const ids = platforms.map((p) => p.id);
    expect(ids).toContain("wiki");
    expect(ids).toContain("all");
    expect(ids).not.toContain("twitter");
  });

  it("includes twitter when member has twitter", () => {
    const froox = RESONITE_TEAM_ROSTER.find((m) => m.id === "frooxius");
    if (!froox) {
      throw new Error("frooxius not in test roster");
    }
    const ids = getAvailablePlatformsForMember(froox).map((p) => p.id);
    expect(ids).toContain("twitter");
    expect(ids).toContain("x");
  });

  it("includes discord when discord field is set", () => {
    const base = RESONITE_TEAM_ROSTER[0];
    if (!base) {
      throw new Error("empty test roster");
    }
    const member = {
      ...base,
      socials: [],
      discord: { userId: "123", username: "testuser" },
    };
    const ids = getAvailablePlatformsForMember(member).map((p) => p.id);
    expect(ids).toContain("discord");
    expect(ids).toContain("all");
    expect(ids).not.toContain("twitter");
  });
});

describe("teamMemberAutocomplete", () => {
  it("uses display name in name and roster id in value", () => {
    const froox = teamMemberAutocomplete("froox").find(
      (c) => c.value === "frooxius",
    );
    expect(froox?.name).toBe("Frooxius");
    expect(froox?.value).toBe("frooxius");
  });
});

describe("platformAutocompleteForUser", () => {
  it("returns empty without a valid user", () => {
    expect(platformAutocompleteForUser(null, "")).toEqual([]);
  });

  it("only suggests platforms the user has", () => {
    const choices = platformAutocompleteForUser("chroma", "");
    const values = choices.map((c) => c.value);
    expect(values).toContain("wiki");
    expect(values).not.toContain("twitter");
  });

  it("uses platform label in name and platform id in value", () => {
    const twitter = platformAutocompleteForUser("frooxius", "").find(
      (c) => c.value === "twitter",
    );
    expect(twitter?.name).toBe("Twitter / X");
    expect(twitter?.value).toBe("twitter");
  });
});

describe("resolveMemberPlatformLinks", () => {
  it("all includes wiki and social links", () => {
    const froox = RESONITE_TEAM_ROSTER.find((m) => m.id === "frooxius");
    if (!froox) {
      throw new Error("frooxius not in test roster");
    }
    const { links } = resolveMemberPlatformLinks(froox, "all");
    expect(links.length).toBeGreaterThan(1);
    expect(links.some((l) => l.url.includes("wiki.resonite.com"))).toBe(true);
  });

  it("wiki returns only wiki profile", () => {
    const chroma = RESONITE_TEAM_ROSTER.find((m) => m.id === "chroma");
    if (!chroma) {
      throw new Error("chroma not in test roster");
    }
    const { links, platformLabel } = resolveMemberPlatformLinks(chroma, "wiki");
    expect(platformLabel).toContain("Wiki");
    expect(links).toHaveLength(1);
    expect(links[0]?.url).toContain("wiki.resonite.com");
  });
});

describe("getAllMemberLinks", () => {
  it("deduplicates by url", () => {
    const froox = RESONITE_TEAM_ROSTER.find((m) => m.id === "frooxius");
    if (!froox) {
      throw new Error("frooxius not in test roster");
    }
    const links = getAllMemberLinks(froox);
    const urls = links.map((l) => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
