import { describe, expect, it } from "vitest";
import {
  extractGitHubMarkdownImageUrls,
  normalizeGitHubMarkdownImageUrl,
  stripGitHubMarkdownImages,
} from "../../../src/services/github/githubMarkdownImages.js";

describe("normalizeGitHubMarkdownImageUrl", () => {
  it("resolves github user-attachment paths", () => {
    expect(
      normalizeGitHubMarkdownImageUrl("/user-attachments/assets/abc-123"),
    ).toBe("https://github.com/user-attachments/assets/abc-123");
  });
});

describe("extractGitHubMarkdownImageUrls", () => {
  it("finds markdown and HTML images", () => {
    const body = [
      "See screenshot:",
      "![demo](https://example.com/a.png)",
      '<img src="https://example.com/b.jpg" alt="b">',
    ].join("\n");
    expect(extractGitHubMarkdownImageUrls(body)).toEqual([
      "https://example.com/a.png",
      "https://example.com/b.jpg",
    ]);
  });

  it("dedupes and caps count", () => {
    const body = [
      "![](https://example.com/same.png)",
      "![](https://example.com/same.png)",
      "![](https://example.com/2.png)",
      "![](https://example.com/3.png)",
      "![](https://example.com/4.png)",
      "![](https://example.com/5.png)",
    ].join("\n");
    expect(extractGitHubMarkdownImageUrls(body, 3)).toHaveLength(3);
  });
});

describe("stripGitHubMarkdownImages", () => {
  it("removes image lines from body text", () => {
    const body = "Hello\n\n![x](https://example.com/a.png)\n\nWorld";
    expect(stripGitHubMarkdownImages(body)).toBe("Hello\n\nWorld");
  });
});
