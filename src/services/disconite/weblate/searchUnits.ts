import { getWeblateBaseUrl } from "../../../config/disconite.js";
import { fetchWeblateJson } from "./client.js";

/** One string segment in Weblate unit source/target arrays. */
export type WeblateUnit = {
  readonly id: number;
  readonly context: string;
  readonly language_code: string;
  readonly source: readonly string[];
  readonly target: readonly string[];
  readonly web_url: string;
  readonly translated: boolean;
  readonly fuzzy: boolean;
  readonly location: string;
  readonly translation?: string;
};

type WeblateUnitsPage = {
  readonly count: number;
  readonly next: string | null;
  readonly results: WeblateUnit[];
};

export type WeblateTranslationRow = {
  readonly languageCode: string;
  readonly targetText: string;
  readonly sourceText: string;
  readonly translated: boolean;
  readonly fuzzy: boolean;
  readonly webUrl: string;
};

export type WeblateKeyGroup = {
  readonly context: string;
  readonly sourceText: string;
  readonly componentHint: string;
  readonly translations: readonly WeblateTranslationRow[];
  readonly totalMatches: number;
  readonly weblateSearchUrl: string;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_UNITS_FETCH = 100;

export function buildWeblateSearchQuery(key: string, rawQuery?: string): string {
  const custom = rawQuery?.trim();
  if (custom) {
    return custom;
  }
  const trimmed = key.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes(":")) {
    return trimmed;
  }
  return `context:${quoteWeblateTerm(trimmed)}`;
}

/** Quote terms that contain spaces or special characters for Weblate search. */
export function quoteWeblateTerm(term: string): string {
  if (/^[\w.-]+$/.test(term)) {
    return term;
  }
  return `"${term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function joinSegments(segments: readonly string[]): string {
  return segments.join("").trim() || "—";
}

function componentFromTranslationUrl(translationUrl: string): string {
  try {
    const u = new URL(translationUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const translateIdx = parts.indexOf("translate");
    if (translateIdx >= 0 && parts.length > translateIdx + 2) {
      return `${parts[translateIdx + 1]}/${parts[translateIdx + 2]}`;
    }
  } catch {
    /* ignore */
  }
  return "";
}

export async function searchWeblateUnits(
  key: string,
  rawQuery?: string,
): Promise<WeblateKeyGroup[]> {
  const q = buildWeblateSearchQuery(key, rawQuery);
  if (!q) {
    return [];
  }

  const params = new URLSearchParams({
    q,
    format: "json",
    page_size: String(DEFAULT_PAGE_SIZE),
  });

  const page = await fetchWeblateJson<WeblateUnitsPage>(
    `/api/units/?${params.toString()}`,
  );

  const units = page.results.slice(0, MAX_UNITS_FETCH);
  if (units.length === 0) {
    return [];
  }

  const byContext = new Map<string, WeblateUnit[]>();
  for (const unit of units) {
    const ctx = unit.context || "(no context)";
    const list = byContext.get(ctx) ?? [];
    list.push(unit);
    byContext.set(ctx, list);
  }

  const searchPath = `/search/?q=${encodeURIComponent(q)}`;

  const groups: WeblateKeyGroup[] = [];
  for (const [context, ctxUnits] of byContext) {
    const sorted = [...ctxUnits].sort((a, b) =>
      a.language_code.localeCompare(b.language_code),
    );
    const first = sorted[0];
    const sourceText = joinSegments(first?.source ?? []);
    const componentHint =
      componentFromTranslationUrl(first?.translation ?? "") ||
      first?.location?.trim() ||
      "resonite";

    const translations: WeblateTranslationRow[] = sorted.map((u) => ({
      languageCode: u.language_code,
      targetText: joinSegments(u.target),
      sourceText: joinSegments(u.source),
      translated: u.translated,
      fuzzy: u.fuzzy,
      webUrl: u.web_url,
    }));

    groups.push({
      context,
      sourceText,
      componentHint,
      translations,
      totalMatches: page.count,
      weblateSearchUrl: searchPath,
    });
  }

  groups.sort((a, b) => b.translations.length - a.translations.length);
  return groups;
}

export function buildWeblateBrowseUrl(searchPath: string): string {
  const base = getWeblateBaseUrl();
  const path = searchPath.startsWith("/") ? searchPath : `/${searchPath}`;
  return `${base}${path}`;
}

const AUTOCOMPLETE_PAGE_SIZE = 25;

/** Unique translation contexts matching a partial key (for slash autocomplete). */
export async function weblateKeyAutocomplete(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const q = trimmed.includes(":")
    ? trimmed
    : `context:${quoteWeblateTerm(trimmed)}`;

  const params = new URLSearchParams({
    q,
    format: "json",
    page_size: String(AUTOCOMPLETE_PAGE_SIZE),
  });

  const page = await fetchWeblateJson<WeblateUnitsPage>(
    `/api/units/?${params.toString()}`,
  );

  const seen = new Set<string>();
  const out: string[] = [];
  for (const unit of page.results) {
    const ctx = unit.context?.trim();
    if (!ctx || seen.has(ctx)) {
      continue;
    }
    seen.add(ctx);
    out.push(ctx);
    if (out.length >= 25) {
      break;
    }
  }
  return out;
}

export async function getWeblateKeyGroup(
  context: string,
  rawQuery?: string,
): Promise<WeblateKeyGroup | null> {
  const groups = await searchWeblateUnits(context, rawQuery);
  return groups.find((g) => g.context === context) ?? groups[0] ?? null;
}
