import { getWeblateProjectSlug } from "../../../config/disconite.js";
import { fetchWeblateJson } from "./client.js";

type WeblateLanguage = {
  readonly code: string;
  readonly name: string;
};

type WeblateLanguagesPage = {
  readonly results?: WeblateLanguage[];
};

let cachedLanguages: WeblateLanguage[] | null = null;
let cacheAt = 0;
const CACHE_MS = 10 * 60 * 1000;

function normalizeLanguagesPage(
  data: WeblateLanguagesPage | WeblateLanguage[],
): WeblateLanguage[] {
  if (Array.isArray(data)) {
    return data;
  }
  return data.results ?? [];
}

/** Languages enabled on the configured Weblate project (not the global language catalog). */
async function loadProjectLanguages(): Promise<WeblateLanguage[]> {
  const now = Date.now();
  if (cachedLanguages && now - cacheAt < CACHE_MS) {
    return cachedLanguages;
  }

  const slug = getWeblateProjectSlug();
  const data = await fetchWeblateJson<WeblateLanguagesPage | WeblateLanguage[]>(
    `/api/projects/${encodeURIComponent(slug)}/languages/?format=json&page_size=500`,
  );

  const langs = normalizeLanguagesPage(data)
    .filter((l) => l.code?.trim())
    .sort((a, b) => a.code.localeCompare(b.code));

  cachedLanguages = langs;
  cacheAt = now;
  return langs;
}

export async function weblateLanguagesAutocomplete(
  query: string,
): Promise<{ name: string; value: string }[]> {
  const segment = query.split(",").pop()?.trim().toLowerCase() ?? "";
  const q = segment;
  const langs = await loadProjectLanguages();
  const filtered = langs.filter((l) => {
    if (!q) {
      return true;
    }
    return (
      l.code.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q)
    );
  });
  return filtered.slice(0, 25).map((l) => ({
    name: `${l.code} — ${l.name}`.slice(0, 100),
    value: l.code,
  }));
}

/** Parse comma/space-separated language codes from slash option text. */
export function parseLanguageFilter(raw: string | undefined): string[] | null {
  if (!raw?.trim()) {
    return null;
  }
  const codes = raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return codes.length > 0 ? [...new Set(codes)] : null;
}

export function filterTranslationsByLanguages<
  T extends { readonly languageCode: string },
>(rows: readonly T[], languages: string[] | null): T[] {
  if (!languages || languages.length === 0) {
    return [...rows];
  }
  const want = new Set(languages);
  return rows.filter((r) => want.has(r.languageCode.toLowerCase()));
}
