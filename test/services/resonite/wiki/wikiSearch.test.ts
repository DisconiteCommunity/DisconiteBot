import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWikiPageWikitextIfExists } from "../../../../src/services/resonite/wiki/wikiSearch.js";

describe("fetchWikiPageWikitextIfExists", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null on HTTP errors instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("error", { status: 503 })),
    );
    const page = await fetchWikiPageWikitextIfExists("User:Frooxius");
    expect(page).toBeNull();
  });

  it("returns null when fetch aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("Aborted", "AbortError");
      }),
    );
    const page = await fetchWikiPageWikitextIfExists("User:J4");
    expect(page).toBeNull();
  });
});
