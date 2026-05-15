import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPlatformPreview } from "./platformPreview.js";
import { RESONITE_TEAM_ROSTER } from "./resoniteTeamSocials.js";

describe("fetchPlatformPreview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("parses GitHub profile via REST API", async () => {
    const froox = RESONITE_TEAM_ROSTER.find((m) => m.id === "frooxius");
    if (!froox) {
      throw new Error("frooxius missing");
    }
    const gh = froox.socials.find((s) => s.platform === "github");
    if (!gh) {
      throw new Error("github link missing");
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("api.github.com/users/Frooxius")) {
          return new Response(
            JSON.stringify({
              login: "Frooxius",
              name: "Frooxius Dev",
              bio: "Building Resonite",
              avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
              followers: 100,
              public_repos: 42,
              html_url: gh.url,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const preview = await fetchPlatformPreview({
      platformId: "github",
      url: gh.url,
      member: froox,
    });

    expect(preview?.title).toBe("Frooxius Dev");
    expect(preview?.images[0]?.url).toContain("avatars.githubusercontent.com");
    expect(preview?.stats.some((s) => s.includes("repos"))).toBe(true);
  });

  it("parses X profile via API v2 when bearer token is set", async () => {
    vi.stubEnv("X_API_BEARER_TOKEN", "test-bearer");

    const froox = RESONITE_TEAM_ROSTER.find((m) => m.id === "frooxius");
    if (!froox) {
      throw new Error("frooxius missing");
    }
    const tw = froox.socials.find((s) => s.platform === "twitter");
    if (!tw) {
      throw new Error("twitter link missing");
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("api.x.com/2/users/by/username/Frooxius")) {
          return new Response(
            JSON.stringify({
              data: {
                name: "Frooxius",
                username: "Frooxius",
                description: "Yellow Dog Man",
                profile_image_url:
                  "https://pbs.twimg.com/profile_images/1/x_normal.png",
                profile_banner_url:
                  "https://pbs.twimg.com/profile_banners/1/2",
                public_metrics: { followers_count: 5000 },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const preview = await fetchPlatformPreview({
      platformId: "twitter",
      url: tw.url,
      member: froox,
    });

    expect(preview?.title).toBe("Frooxius");
    const avatar = preview?.images.find((i) => i.description === "Avatar");
    expect(avatar?.url).toContain("_400x400");
    expect(preview?.stats[0]).toContain("Followers");
  });

  it("returns null for twitter without API token", async () => {
    const froox = RESONITE_TEAM_ROSTER.find((m) => m.id === "frooxius");
    if (!froox) {
      throw new Error("frooxius missing");
    }
    const tw = froox.socials.find((s) => s.platform === "twitter");
    if (!tw) {
      throw new Error("twitter link missing");
    }

    const preview = await fetchPlatformPreview({
      platformId: "twitter",
      url: tw.url,
      member: froox,
    });
    expect(preview).toBeNull();
  });
});
