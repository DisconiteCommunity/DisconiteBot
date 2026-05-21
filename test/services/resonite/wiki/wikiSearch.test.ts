import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  buildWikiTableTextSections,
  extractInfoboxImageFileTitle,
  extractWikitableSectionsFromHtml,
  extractWikiImageFileTitleFromWikitext,
  fetchWikiPageWikitextIfExists,
  formatWikiTableAsDiscordCodeBlock,
  wikitextNeedsParsedTables,
} from "../../../../src/services/resonite/wiki/wikiSearch.js";
import { loggers } from "../../../../src/utility/logging/logger.js";

const AVATAR_TOOL_ANCHOR_WIKITEXT = `{{SHORTDESC:Avatar Tool anchor is a component}}
{{stub}}
{{Infobox Component
|Image=AvatarToolAnchorComponent.png
|Name=AvatarToolAnchor
}}
Avatar Tool anchor is a component.

== Usage ==
{{Table ComponentFields
|AnchorPoint|'''[[#Point|AvatarToolAnchor.Point]]'''|TypeAdv0=true| The type of tool anchor.
}}

== Point ==
{{Table EnumValues
|Tool|0| Place the tooltip anchor for this hand here.
|GrabArea|1| Place the grabber sphere anchor for this hand here.
}}
`;

const USAGE_TABLE_HTML = `<table class="wikitable">
<tbody>
<tr><th>Name</th><th>Type</th><th>Description</th></tr>
<tr><td>persistent</td><td><a href="/Type:Bool">Bool</a></td><td>Determines whether or not this item will be saved to the server.</td></tr>
<tr><td>AnchorPoint</td><td>AvatarToolAnchor.Point</td><td>The type of tool anchor to place under the slot this component is on for this hand.</td></tr>
</tbody>
</table>`;

const POINT_TABLE_HTML = `<table class="wikitable">
<tbody>
<tr><th>Name</th><th>Value</th><th>Description</th></tr>
<tr><td>Tool</td><td>0</td><td>Place the tooltip anchor for this hand here.</td></tr>
<tr><td>Menu</td><td>3</td><td>Position the context menu here when it is opened on this hand here.</td></tr>
</tbody>
</table>`;

describe("fetchWikiPageWikitextIfExists", () => {
  beforeEach(() => {
    vi.spyOn(loggers.resonite, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

describe("wiki image extraction", () => {
  it("extracts Infobox Image= filename", () => {
    expect(extractInfoboxImageFileTitle(AVATAR_TOOL_ANCHOR_WIKITEXT)).toBe(
      "AvatarToolAnchorComponent.png",
    );
  });

  it("prefers [[File:…]] over Infobox when both present", () => {
    const wt = "[[File:First.png]]\n{{Infobox Component|Image=Second.png}}";
    expect(extractWikiImageFileTitleFromWikitext(wt)).toBe("First.png");
  });

  it("falls back to Infobox when no file link", () => {
    expect(extractWikiImageFileTitleFromWikitext(AVATAR_TOOL_ANCHOR_WIKITEXT)).toBe(
      "AvatarToolAnchorComponent.png",
    );
  });
});

describe("wikitextNeedsParsedTables", () => {
  it("is true for Table templates", () => {
    expect(wikitextNeedsParsedTables(AVATAR_TOOL_ANCHOR_WIKITEXT)).toBe(true);
  });

  it("is false for plain prose pages", () => {
    expect(wikitextNeedsParsedTables("A '''bool''' value.\n\n== Usage ==\n")).toBe(
      false,
    );
  });

  it("is true for wikitext table syntax", () => {
    expect(wikitextNeedsParsedTables("{|\n| cell\n|}")).toBe(true);
  });
});

describe("wikitable HTML parsing", () => {
  it("extracts rows from wikitable HTML", () => {
    const sections = extractWikitableSectionsFromHtml(USAGE_TABLE_HTML);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.rows[0]).toEqual(["Name", "Type", "Description"]);
    expect(sections[0]?.rows[1]?.[0]).toBe("persistent");
    expect(sections[0]?.rows[1]?.[1]).toBe("Bool");
  });

  it("formats a table as a fenced code block", () => {
    const sections = extractWikitableSectionsFromHtml(USAGE_TABLE_HTML);
    const block = formatWikiTableAsDiscordCodeBlock(sections[0]?.rows ?? []);
    expect(block).toMatch(/^```\n/);
    expect(block).toContain("persistent");
    expect(block).toContain("Bool");
    expect(block).toMatch(/\n```$/);
  });

  it("builds labeled table sections from wikitext + HTML", () => {
    const html = `${USAGE_TABLE_HTML}${POINT_TABLE_HTML}`;
    const displays = buildWikiTableTextSections(
      AVATAR_TOOL_ANCHOR_WIKITEXT,
      html,
      1200,
    );
    expect(displays.length).toBeGreaterThanOrEqual(2);
    expect(displays[0]).toContain("**Usage");
    expect(displays[0]).toContain("persistent");
    expect(displays[1]).toContain("**Point");
    expect(displays[1]).toContain("Tool");
  });
});
