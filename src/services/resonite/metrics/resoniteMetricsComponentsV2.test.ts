import { MessageFlags } from "discord.js";
import { describe, expect, it } from "vitest";
import { metricsMessageNeedsReplace } from "./resoniteMetricsComponentsV2.js";

describe("metricsMessageNeedsReplace", () => {
  it("detects legacy content and embeds", () => {
    expect(
      metricsMessageNeedsReplace({
        flags: { has: () => true },
        content: "stats",
        embeds: [],
      } as never),
    ).toBe(true);
    expect(
      metricsMessageNeedsReplace({
        flags: { has: () => true },
        content: "",
        embeds: [{}],
      } as never),
    ).toBe(true);
    expect(
      metricsMessageNeedsReplace({
        flags: { has: (f: unknown) => f === MessageFlags.IsComponentsV2 },
        content: "",
        embeds: [],
      } as never),
    ).toBe(false);
  });
});
