import { describe, it, expect } from "vitest";
import { truncateEllipsis } from "../../../src/utility/text/truncate.js";

describe("truncateEllipsis", () => {
  it("leaves short strings unchanged", () => {
    expect(truncateEllipsis("hi", 10)).toBe("hi");
  });

  it("truncates with ellipsis", () => {
    expect(truncateEllipsis("abcdef", 4)).toBe("abc…");
  });
});
