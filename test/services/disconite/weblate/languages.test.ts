import { describe, it, expect } from "vitest";
import {
  filterTranslationsByLanguages,
  parseLanguageFilter,
} from "../../../../src/services/disconite/weblate/languages.js";

describe("parseLanguageFilter", () => {
  it("returns null when empty", () => {
    expect(parseLanguageFilter(undefined)).toBeNull();
    expect(parseLanguageFilter("  ")).toBeNull();
  });

  it("parses comma and space separated codes", () => {
    expect(parseLanguageFilter("en, nl de")).toEqual(["en", "nl", "de"]);
  });
});

describe("filterTranslationsByLanguages", () => {
  const rows = [
    { languageCode: "en", x: 1 },
    { languageCode: "nl", x: 2 },
    { languageCode: "de", x: 3 },
  ];

  it("returns all when filter is null", () => {
    expect(filterTranslationsByLanguages(rows, null)).toHaveLength(3);
  });

  it("filters to selected codes", () => {
    expect(filterTranslationsByLanguages(rows, ["nl", "de"])).toEqual([
      { languageCode: "nl", x: 2 },
      { languageCode: "de", x: 3 },
    ]);
  });
});
