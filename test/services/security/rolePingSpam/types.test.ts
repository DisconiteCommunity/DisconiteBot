import { describe, it, expect } from "vitest";
import {
  isDryRunUser,
  type RolePingSpamConfig,
} from "../../../../src/services/security/rolePingSpam/types.js";

function baseConfig(overrides: Partial<RolePingSpamConfig> = {}): RolePingSpamConfig {
  return {
    enabled: true,
    modLogChannelId: "mod",
    minChannels: 2,
    minImages: 2,
    minMessages: 3,
    windowMs: 3000,
    cacheRetentionMs: 60_000,
    timeoutMinutes: 1440,
    dryRunUserIds: [],
    ...overrides,
  };
}

describe("isDryRunUser", () => {
  it("returns false when user not listed", () => {
    expect(isDryRunUser(baseConfig(), "u1")).toBe(false);
  });

  it("returns true when user is on dry-run list", () => {
    expect(
      isDryRunUser(baseConfig({ dryRunUserIds: ["u1", "u2"] }), "u2"),
    ).toBe(true);
  });
});
