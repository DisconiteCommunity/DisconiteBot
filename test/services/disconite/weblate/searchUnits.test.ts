import { describe, it, expect } from "vitest";
import { formatWeblateTranslationLangBlock } from "../../../../src/utility/discord/translationComponentsV2.js";
import {
  buildWeblateSearchQuery,
  quoteWeblateTerm,
} from "../../../../src/services/disconite/weblate/searchUnits.js";

describe("buildWeblateSearchQuery", () => {
  it("uses raw query when provided", () => {
    expect(buildWeblateSearchQuery("ignored", "source:hello")).toBe(
      "source:hello",
    );
  });

  it("wraps plain keys as context search", () => {
    expect(buildWeblateSearchQuery("localeCode")).toBe("context:localeCode");
  });

  it("passes through queries that already contain a field", () => {
    expect(buildWeblateSearchQuery("context:foo")).toBe("context:foo");
  });

  it("quotes terms with spaces", () => {
    expect(buildWeblateSearchQuery("my key")).toBe('context:"my key"');
  });
});

describe("quoteWeblateTerm", () => {
  it("leaves simple identifiers unquoted", () => {
    expect(quoteWeblateTerm("localeCode")).toBe("localeCode");
  });

  it("quotes phrases with spaces", () => {
    expect(quoteWeblateTerm("hello world")).toBe('"hello world"');
  });
});

describe("formatWeblateTranslationLangBlock", () => {
  it("shows language once as heading with target below", () => {
    const out = formatWeblateTranslationLangBlock(
      {
        languageCode: "de",
        targetText: "Untertitel: Ein",
        sourceText: "Subtitles: On",
        translated: true,
        fuzzy: false,
        webUrl: "https://example.com",
      },
      200,
    );
    expect(out).toMatch(/^### de\n/);
    expect(out).toContain("Untertitel: Ein");
    expect(out.match(/\bde\b/g)?.length).toBe(1);
  });

  it("marks fuzzy and untranslated", () => {
    const out = formatWeblateTranslationLangBlock({
      languageCode: "et",
      targetText: "—",
      sourceText: "Hi",
      translated: false,
      fuzzy: true,
      webUrl: "https://example.com",
    });
    expect(out).toContain("fuzzy");
    expect(out).toContain("untranslated");
  });
});
