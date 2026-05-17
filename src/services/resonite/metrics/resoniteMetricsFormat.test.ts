import { describe, expect, it } from "vitest";
import {
  bucketNumeric,
  formatMetricsMarkdown,
  pickTopSessionsForEmbeds,
  sessionMetricsDisplay,
  sumNumericRecord,
} from "./resoniteMetricsFormat.js";
import type {
  ResoniteCloudStatsDto,
  ResoniteOnlineStatsDto,
  ResoniteSessionDto,
} from "./resoniteMetricsFetch.js";

describe("sumNumericRecord", () => {
  it("sums numeric values regardless of key casing", () => {
    expect(sumNumericRecord({ a: 1, B: 2, x: "no" as unknown as number })).toBe(
      3,
    );
  });
});

describe("bucketNumeric", () => {
  it("reads PascalCase keys", () => {
    expect(
      bucketNumeric({ Anyone: 3, junk: 9 }, "Anyone", "anyone"),
    ).toBe(3);
  });
});

describe("pickTopSessionsForEmbeds", () => {
  it("orders by totalActiveUsers and excludes zero activeUsers", () => {
    const sessions: ResoniteSessionDto[] = [
      { sessionId: "a", activeUsers: 0, totalActiveUsers: 99 },
      { sessionId: "b", activeUsers: 2, totalActiveUsers: 10 },
      { sessionId: "c", activeUsers: 1, totalActiveUsers: 50 },
    ];
    const top = pickTopSessionsForEmbeds(sessions, 10);
    expect(top.map((s) => s.sessionId)).toEqual(["c", "b"]);
  });
});

describe("formatMetricsMarkdown", () => {
  it("includes cloud jobs and online aggregates", () => {
    const sessions: ResoniteSessionDto[] = [
      { appVersion: "1.0.0", activeUsers: 1 },
      { appVersion: "1.0.0", activeUsers: 1 },
      { appVersion: "2.0.0", activeUsers: 1 },
    ];
    const cloud: ResoniteCloudStatsDto = {
      uploadJobs: 10,
      recordPreprocessJobs: 3,
      assetVariantJobs: 99,
      captureTimestamp: "2026-01-01T00:00:00Z",
    };
    const online: ResoniteOnlineStatsDto = {
      captureTimestamp: "2026-01-02T00:00:00Z",
      registeredUsers: 100,
      instanceCount: 40,
      usersInVR: 10,
      usersOnDesktop: 90,
      usersBySessionAccessLevel: {
        Anyone: 20,
        RegisteredUsers: 30,
        Private: 5,
        ContactsPlus: 7,
      },
      usersByClientType: {
        Headless: 12,
        ChatClient: 3,
        Bot: 1,
      },
      activeHiddenSessionsByAccessLevel: { Anyone: 1 },
      activeVisibleSessionsByAccessLevel: { Anyone: 2 },
    };
    const md = formatMetricsMarkdown({ sessions, cloud, online });
    expect(md).toContain("**Online Users:** 100");
    expect(md).toContain("**Upload jobs:** 10");
    expect(md).toContain("1.0.0 (2)");
    expect(md).toContain("**Active sessions:** 3");
    expect(md).toContain("<t:");
  });
});

describe("sessionMetricsDisplay", () => {
  it("mirrors v1 embed fields and includes api open-session link", () => {
    const display = sessionMetricsDisplay({
      sessionId: "S-abc",
      name: "Test World",
      hostUsername: "HostUser",
      activeUsers: 2,
      joinedUsers: 5,
      appVersion: "2026.5.1.1",
      headlessHost: false,
      mobileFriendly: true,
      tags: ["social"],
      sessionUsers: [{ username: "Alice" }],
      sessionBeginTime: new Date(Date.now() - 90 * 60_000).toISOString(),
    });
    expect(display.textContent).toContain("# Test World");
    expect(display.textContent).toContain("**Host:** HostUser");
    expect(display.textContent).toContain("**Users:** 2 (5)");
    expect(display.textContent).toContain("**Tags:**");
    expect(display.textContent).toContain("social");
    expect(display.textContent).toContain("**Users:**");
    expect(display.textContent).toContain("Alice");
    expect(display.textContent).toContain(
      "https://api.resonite.com/open/session/S-abc",
    );
    expect(display.sessionOrbUrl).toBe(
      "https://api.resonite.com/open/session/S-abc",
    );
    expect(display.sessionSiteUrl).toBe(
      "https://session.resonite.com/session/S-abc",
    );
    expect(display.accentColor).toBe(0x2ecc71);
  });

  it("uses headless accent color", () => {
    const display = sessionMetricsDisplay({
      sessionId: "x",
      activeUsers: 1,
      headlessHost: true,
    });
    expect(display.accentColor).toBe(0x3498db);
  });
});
