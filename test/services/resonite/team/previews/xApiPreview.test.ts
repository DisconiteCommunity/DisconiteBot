import { describe, expect, it } from "vitest";
import { parseXUsername } from "../../../../../src/services/resonite/team/previews/xApiPreview.js";

describe("parseXUsername", () => {
  it("parses x.com profile URLs", () => {
    expect(parseXUsername("https://x.com/Frooxius")).toBe("Frooxius");
  });

  it("parses mobile.twitter.com profile URLs", () => {
    expect(parseXUsername("https://mobile.twitter.com/ProbablePrime")).toBe(
      "ProbablePrime",
    );
  });

  it("parses mobile.x.com profile URLs", () => {
    expect(parseXUsername("https://mobile.x.com/j4lcoder")).toBe("j4lcoder");
  });

  it("returns null for non-profile hosts", () => {
    expect(parseXUsername("https://example.com/user")).toBeNull();
  });
});
