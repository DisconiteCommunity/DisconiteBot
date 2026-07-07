import { describe, it, expect } from "vitest";
import {
  clearRolePingSpamConfig,
  mergeRolePingSpamConfig,
  readRolePingSpamConfig,
} from "../../../src/services/guildSettings/rolePingSpamExtras.js";

describe("rolePingSpamExtras", () => {
  it("returns null when extras absent", () => {
    expect(readRolePingSpamConfig(null)).toBeNull();
    expect(readRolePingSpamConfig(undefined)).toBeNull();
  });

  it("merges config with defaults", () => {
    const { extras, config } = mergeRolePingSpamConfig(null, {
      modLogChannelId: "123",
      enabled: true,
    });

    expect(config.enabled).toBe(true);
    expect(config.modLogChannelId).toBe("123");
    expect(config.minChannels).toBe(2);
    expect(config.timeoutMinutes).toBe(1440);
    expect(readRolePingSpamConfig(extras)).toEqual(config);
  });

  it("preserves other extras keys when clearing security config", () => {
    const extras = { foo: true, rolePingSpamProtection: { enabled: true, modLogChannelId: "1" } };
    const cleared = clearRolePingSpamConfig(extras);
    expect(cleared).toEqual({ foo: true });
  });

  it("returns null when clearing leaves empty extras", () => {
    const extras = { rolePingSpamProtection: { enabled: true, modLogChannelId: "1" } };
    expect(clearRolePingSpamConfig(extras)).toBeNull();
  });

  it("patches existing config", () => {
    const initial = mergeRolePingSpamConfig(null, {
      modLogChannelId: "123",
      enabled: true,
    });
    const { config } = mergeRolePingSpamConfig(initial.extras, {
      modLogChannelId: "123",
      minImages: 4,
      modPingRoleId: "999",
    });

    expect(config.minImages).toBe(4);
    expect(config.modPingRoleId).toBe("999");
    expect(config.minChannels).toBe(2);
  });

  it("defaults dryRunUserIds to empty array", () => {
    const { config } = mergeRolePingSpamConfig(null, {
      modLogChannelId: "123",
      enabled: true,
    });
    expect(config.dryRunUserIds).toEqual([]);
    expect(config.debugLogging).toBe(false);
  });

  it("preserves dryRunUserIds when patching", () => {
    const initial = mergeRolePingSpamConfig(null, {
      modLogChannelId: "123",
      enabled: true,
      dryRunUserIds: ["u1", "u2"],
    });
    const { config } = mergeRolePingSpamConfig(initial.extras, {
      modLogChannelId: "123",
      minImages: 4,
    });
    expect(config.dryRunUserIds).toEqual(["u1", "u2"]);
  });
});
