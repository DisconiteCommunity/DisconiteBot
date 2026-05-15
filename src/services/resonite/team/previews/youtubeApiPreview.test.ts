import { describe, it, expect } from "vitest";
import { parseYoutubeChannelRef } from "./youtubeApiPreview.js";

describe("parseYoutubeChannelRef", () => {
  it("parses @handle URLs", () => {
    expect(
      parseYoutubeChannelRef("https://www.youtube.com/@Frooxius/videos"),
    ).toEqual({ forHandle: "Frooxius" });
  });

  it("parses channel id URLs", () => {
    expect(
      parseYoutubeChannelRef(
        "https://www.youtube.com/channel/UCxPXPA8QPbuI5FyHL9_FGwQ",
      ),
    ).toEqual({ channelId: "UCxPXPA8QPbuI5FyHL9_FGwQ" });
  });
});
