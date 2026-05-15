import { describe, it, expect } from "vitest";
import { getPlatformAccentColor } from "./socialPlatformColors.js";

describe("getPlatformAccentColor", () => {
  it("maps known platforms", () => {
    expect(getPlatformAccentColor("twitter")).toBe(0x000000);
    expect(getPlatformAccentColor("x")).toBe(0x000000);
    expect(getPlatformAccentColor("youtube")).toBe(0xff0000);
    expect(getPlatformAccentColor("discord")).toBe(0x5865f2);
  });

  it("uses all color for combined list", () => {
    expect(getPlatformAccentColor("all")).toBe(0x6366f1);
  });
});
