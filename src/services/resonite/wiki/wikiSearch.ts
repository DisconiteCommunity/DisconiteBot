import { resoniteRichTextToDiscordPlain } from "../../../utility/text/resoniteRichText.js";
import { truncateEllipsis } from "../../../utility/text/truncate.js";
import { loggers } from "../../../utility/logging/logger.js";

const WIKI_API = "https://wiki.resonite.com/api.php";
const WIKI_SEARCH_TIMEOUT_MS = 15_000;

export type WikiSearchHit = {
  title: string;
  snippet: string;
};

function stripWikiSnippet(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Article path segments (spaces → underscores), no `/wiki/` prefix — matches wiki.resonite.com URLs. */
function wikiArticlePath(title: string): string {
  return title
    .trim()
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/ /g, "_"))
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** Canonical reader URL for a wiki page title (same shape as MediaWiki opensearch links). */
export function wikiArticleUrl(title: string): string {
  return `https://wiki.resonite.com/${wikiArticlePath(title)}`;
}

type WikiQueryPage = {
  title?: string;
  missing?: boolean;
  revisions?: {
    slots?: {
      main?: Record<string, unknown>;
    };
  }[];
};

function mainSlotWikitext(page: WikiQueryPage): string | undefined {
  const main = page.revisions?.[0]?.slots?.main;
  if (!main || typeof main !== "object") {
    return undefined;
  }
  const raw = main["*"];
  if (typeof raw === "string") {
    return raw;
  }
  const c = main.content;
  return typeof c === "string" ? c : undefined;
}

/** If a page exists for this title (after redirects), return canonical title + wikitext source. */
export async function fetchWikiPageWikitextIfExists(
  titleQuery: string,
): Promise<{ title: string; wikitext: string } | null> {
  const t = titleQuery.trim();
  if (!t) {
    return null;
  }
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", t);
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvlimit", "1");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WIKI_SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "DisconiteBot/1.0 (Discord; MediaWiki read-only public API)",
      },
    });
    if (!res.ok) {
      loggers.resonite.warn("wiki page query HTTP error", {
        status: res.status,
        title: t,
      });
      return null;
    }
    const data = (await res.json()) as {
      query?: { pages?: Record<string, WikiQueryPage> };
    };
    const pages = data.query?.pages;
    if (!pages) {
      return null;
    }
    for (const p of Object.values(pages)) {
      if (!p.title || "missing" in p) {
        continue;
      }
      const wt = mainSlotWikitext(p);
      if (typeof wt === "string") {
        return { title: p.title, wikitext: wt };
      }
    }
    return null;
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    loggers.resonite.warn("wiki page query failed", { title: t, name });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** First `[[File:…]]` / `[[Image:…]]` file name segment from wikitext (before `|` / `]`). */
export function extractFirstWikiImageFileTitle(wikitext: string): string | null {
  const m = wikitext.match(/\[\[(?:File|Image):([^|\]#\n]+)/i);
  const raw = m?.[1]?.trim();
  return raw ? raw : null;
}

/** `|Image=` / `|image=` from the first `{{Infobox …}}` block (component pages). */
export function extractInfoboxImageFileTitle(wikitext: string): string | null {
  const m = wikitext.match(/\{\{Infobox[\s\S]*?\|Image\s*=\s*([^|\n}]+)/i);
  const raw = m?.[1]?.trim();
  return raw ? raw : null;
}

/** First wiki file reference: explicit `[[File:…]]`, else Infobox `|Image=`. */
export function extractWikiImageFileTitleFromWikitext(
  wikitext: string,
): string | null {
  return (
    extractFirstWikiImageFileTitle(wikitext) ??
    extractInfoboxImageFileTitle(wikitext)
  );
}

/** True when rendered tables should be fetched (templates or wikitext tables). */
export function wikitextNeedsParsedTables(wikitext: string): boolean {
  return /\{\{Table\s/i.test(wikitext) || /^\{\|/m.test(wikitext);
}

export type WikiTableSection = {
  heading?: string;
  rows: string[][];
};

function stripHtmlCell(html: string): string {
  return stripWikiSnippet(html.replace(/<br\s*\/?>/gi, " "));
}

/** Extract `table.wikitable` blocks from MediaWiki parse HTML. */
export function extractWikitableSectionsFromHtml(
  html: string,
): WikiTableSection[] {
  const sections: WikiTableSection[] = [];
  const tableRe = /<table[^>]*\bwikitable\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html)) !== null) {
    const tableHtml = tableMatch[1] ?? "";
    const rows: string[][] = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRe.exec(tableHtml)) !== null) {
      const cells: string[] = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(trMatch[1] ?? "")) !== null) {
        cells.push(stripHtmlCell(cellMatch[1] ?? ""));
      }
      if (cells.length > 0 && cells.some((c) => c.length > 0)) {
        rows.push(cells);
      }
    }
    if (rows.length === 0) {
      continue;
    }
    let heading: string | undefined;
    const first = rows[0]?.[0]?.trim() ?? "";
    if (rows[0]?.length === 1 && /^(Fields|Values)$/i.test(first)) {
      heading = first;
      rows.shift();
    }
    sections.push({ heading, rows });
  }
  return sections;
}

/** Monospace table inside a fenced code block for Discord text displays. */
export function formatWikiTableAsDiscordCodeBlock(
  rows: string[][],
  maxChars = 1800,
): string {
  if (rows.length === 0) {
    return "";
  }
  const colCount = Math.max(...rows.map((r) => r.length), 0);
  const widths = Array.from({ length: colCount }, (_, ci) =>
    Math.min(
      36,
      Math.max(3, ...rows.map((r) => (r[ci] ?? "").length)),
    ),
  );
  const lines = rows.map((row) =>
    row
      .map((cell, ci) => (cell ?? "").padEnd(widths[ci] ?? 3))
      .join("  ")
      .trimEnd(),
  );
  let body = lines.join("\n");
  const fenceOverhead = 8;
  if (body.length + fenceOverhead > maxChars) {
    const maxBody = Math.max(0, maxChars - fenceOverhead);
    body = truncateEllipsis(body, maxBody);
  }
  return `\`\`\`\n${body}\n\`\`\``;
}

export type WikitextSection = {
  heading: string;
  /** Number of `=` characters in the wikitext heading (2 → `##`, etc.). */
  level: number;
  body: string;
};

/** Split article wikitext into preamble and `== … ==` sections (document order). */
export function parseWikitextByHeadings(wikitext: string): {
  preamble: string;
  sections: WikitextSection[];
} {
  const normalized = wikitext.replace(/\r\n/g, "\n");
  const headingRe = /^\s*(={2,6})\s*([^=\n]+?)\s*\1\s*$/gm;
  const matches = [...normalized.matchAll(headingRe)];
  if (matches.length === 0) {
    return { preamble: normalized.trim(), sections: [] };
  }
  const first = matches[0];
  const preamble = normalized.slice(0, first?.index ?? 0).trim();
  const sections: WikitextSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m) {
      continue;
    }
    const eq = m[1] ?? "==";
    const start = (m.index ?? 0) + m[0].length;
    const next = matches[i + 1];
    const end = next?.index ?? normalized.length;
    sections.push({
      heading: (m[2] ?? "").trim(),
      level: eq.length,
      body: normalized.slice(start, end).trim(),
    });
  }
  return { preamble, sections };
}

function sectionBodyHasTableTemplate(body: string): boolean {
  return /\{\{Table\s/i.test(body) || /^\{\|/m.test(body);
}

function stripTableTemplatesFromSection(body: string): string {
  return body.replace(/\{\{Table[\s\S]*?\}\}/gi, "").trim();
}

function markdownHeading(level: number, title: string): string {
  const hashes = "#".repeat(Math.min(Math.max(level, 2), 6));
  return `${hashes} ${title}`;
}

/**
 * Components v2 text displays in reading order: title/intro, then each
 * `== Section ==` with its table immediately under that section's heading.
 */
export function buildOrderedWikiPreviewDisplays(
  title: string,
  wikitext: string,
  html: string | null,
  previewLimit: number,
): string[] {
  const tables = html ? extractWikitableSectionsFromHtml(html) : [];
  const { preamble, sections } = parseWikitextByHeadings(wikitext);
  const parts: string[] = [];
  let tableIdx = 0;

  const intro =
    preamble.length > 0
      ? wikitextToDiscordMarkdown(preamble, previewLimit)
      : "";
  const lead = intro.trim() ? `# ${title}\n\n${intro}` : `# ${title}`;
  parts.push(lead);

  for (const section of sections) {
    const hasTable = sectionBodyHasTableTemplate(section.body);
    const proseSource = stripTableTemplatesFromSection(section.body);
    const head = markdownHeading(section.level, section.heading);
    const chunks: string[] = [head];

    if (proseSource.length > 0) {
      const prose = wikitextToDiscordMarkdown(proseSource, previewLimit);
      if (prose.trim()) {
        chunks.push(prose);
      }
    }

    if (hasTable && tableIdx < tables.length) {
      const tbl = tables[tableIdx];
      tableIdx += 1;
      if (tbl) {
        if (tbl.heading) {
          chunks.push(`*${tbl.heading}*`);
        }
        const block = formatWikiTableAsDiscordCodeBlock(tbl.rows, previewLimit);
        if (block) {
          chunks.push(block);
        }
      }
    }

    parts.push(chunks.join("\n\n"));
  }

  const displays: string[] = [];
  let remaining = previewLimit;
  for (const part of parts) {
    if (remaining <= 0) {
      break;
    }
    const chunk = truncateEllipsis(part, Math.min(remaining, 4000));
    if (!chunk.trim()) {
      continue;
    }
    displays.push(chunk);
    remaining -= chunk.length;
  }
  return displays;
}

/** Rendered article HTML via MediaWiki `action=parse`. */
export async function fetchWikiPageParsedHtml(
  title: string,
): Promise<string | null> {
  const t = title.trim();
  if (!t) {
    return null;
  }
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "parse");
  url.searchParams.set("format", "json");
  url.searchParams.set("page", t);
  url.searchParams.set("prop", "text");
  url.searchParams.set("disableeditsection", "1");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WIKI_SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "DisconiteBot/1.0 (Discord; MediaWiki read-only public API)",
      },
    });
    if (!res.ok) {
      loggers.resonite.warn("wiki parse HTTP error", {
        status: res.status,
        title: t,
      });
      return null;
    }
    const data = (await res.json()) as {
      parse?: { text?: { "*"?: string } };
    };
    const html = data.parse?.text?.["*"];
    return typeof html === "string" ? html : null;
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    loggers.resonite.warn("wiki parse failed", { title: t, name });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeWikiFileQuery(fileTitle: string): string {
  let t = fileTitle.trim();
  if (/^image:/i.test(t)) {
    t = `File:${t.slice(6)}`;
  } else if (/^media:/i.test(t)) {
    t = `File:${t.slice(6)}`;
  } else if (!/^file:/i.test(t)) {
    t = `File:${t}`;
  }
  return t;
}

/** Direct `https://…` image URL for a wiki `File:…` page via MediaWiki `imageinfo`. */
export async function resolveWikiFileImageUrl(
  fileTitle: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const titles = normalizeWikiFileQuery(fileTitle);
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("titles", titles);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime");

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent":
        "DisconiteBot/1.0 (Discord; MediaWiki read-only public API)",
    },
  });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          imageinfo?: { url?: string; mime?: string }[];
        }
      >;
    };
  };
  const pages = data.query?.pages;
  if (!pages) {
    return null;
  }
  for (const p of Object.values(pages)) {
    const ii = p.imageinfo?.[0];
    const mime = ii?.mime;
    let u = ii?.url;
    if (
      typeof u !== "string" ||
      typeof mime !== "string" ||
      !mime.startsWith("image/") ||
      mime.includes("svg")
    ) {
      continue;
    }
    if (u.startsWith("http://")) {
      u = `https://${u.slice(7)}`;
    }
    if (u.startsWith("https://")) {
      return u;
    }
  }
  return null;
}

/** Resolve the first embedded wiki image in wikitext to a fetchable image URL. */
export async function resolveWikiImageUrlFromWikitext(
  wikitext: string,
): Promise<string | null> {
  const name = extractWikiImageFileTitleFromWikitext(wikitext);
  if (!name) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, WIKI_SEARCH_TIMEOUT_MS);
  try {
    return await resolveWikiFileImageUrl(name, controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rough wikitext → Discord-flavoured markdown for embed descriptions.
 * Not a full parser; aims for readable text and common patterns.
 */
export function wikitextToDiscordMarkdown(wikitext: string, maxLen: number): string {
  let s = wikitext.replace(/\r\n/g, "\n");

  // Strip categories and file-only lines early
  s = s.replace(/\[\[(?:Category|category):[^\]]+\]\]/g, "");

  // Remove HTML comments
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // [[File:...]] / [[Image:...]] — use last pipe segment as caption when present
  s = s.replace(
    /\[\[(?:File|Image|Media):([\s\S]*?)\]\]/gi,
    (_m, inner: string) => {
      const parts = inner.split("|").map((p) => p.trim());
      if (parts.length <= 1) {
        return "";
      }
      return parts[parts.length - 1] ?? "";
    },
  );

  // Collapse nested templates (shallow passes)
  for (let i = 0; i < 40; i++) {
    const next = s.replace(/\{\{[^{}]+\}\}/g, "");
    if (next === s) {
      break;
    }
    s = next;
  }
  s = s.replace(/\{\{[\s\S]*?\}\}/g, "");

  // Magic words / __NOTOC__ etc.
  s = s.replace(/__\w+__/g, "");

  // External links [url label] or [url]
  s = s.replace(/\[((https?:)[^\s\]]+)\s+([^\]]+)\]/gi, "[$3]($1)");
  s = s.replace(/\[((https?:)[^\]]+)\]/gi, "$1");

  // Internal links [[page|label]] / [[page]]
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2");
  s = s.replace(/\[\[([^\]]+)\]\]/g, "$1");

  // Bold / italic
  s = s.replace(/'''([^']+)'''/g, "**$1**");
  s = s.replace(/''([^']+)''/g, "*$1*");

  // Headings == ... == → ATX markdown (## …)
  s = s.replace(/^\s*(={2,6})\s*([^=\n]+?)\s*\1\s*$/gm, (_m, eq: string, inner: string) => {
    const level = Math.min(eq.length, 6);
    const hashes = "#".repeat(level);
    return `\n${hashes} ${String(inner).trim()}\n`;
  });

  // Table rows — drop noisy row syntax, keep cell text roughly
  s = s.replace(/^\{\|[^\n]*\n/gm, "");
  s = s.replace(/^\|\}/gm, "");
  s = s.replace(/^\|-\s*$/gm, "");
  s = s.replace(/^\|+/gm, "| ");

  // Ref tags
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  s = s.replace(/<ref[^/]*\/>/gi, "");

  // Resonite rich text (<color>, <b>, …) → Discord subset + strip unsupported tags
  s = resoniteRichTextToDiscordPlain(s);

  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return truncateEllipsis(s, maxLen);
}

async function fetchWikiOpenSearch(
  search: string,
  limit: number,
  signal: AbortSignal,
): Promise<{ titles: string[]; descriptions: string[] }> {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "opensearch");
  url.searchParams.set("search", search.trim());
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 25)));
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent":
        "DisconiteBot/1.0 (Discord; MediaWiki opensearch; read-only public API)",
    },
  });
  if (!res.ok) {
    throw new Error(`Wiki opensearch HTTP ${res.status}`);
  }
  const data = (await res.json()) as unknown[];
  const titles = Array.isArray(data[1])
    ? data[1].filter((t): t is string => typeof t === "string")
    : [];
  const descriptions = Array.isArray(data[2])
    ? data[2].filter((t): t is string => typeof t === "string")
    : [];
  return { titles, descriptions };
}

/** Titles for Discord autocomplete (MediaWiki opensearch). */
export async function wikiOpenSearchForAutocomplete(
  prefix: string,
  limit = 25,
): Promise<string[]> {
  const p = prefix.trim();
  if (!p) {
    return [];
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, WIKI_SEARCH_TIMEOUT_MS);
  try {
    const { titles } = await fetchWikiOpenSearch(p, limit, controller.signal);
    return titles.slice(0, limit);
  } finally {
    clearTimeout(timer);
  }
}

/** Wiki hits via MediaWiki `action=opensearch` (same source as autocomplete). */
export async function searchWikiTitles(
  query: string,
  limit = 5,
): Promise<WikiSearchHit[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, WIKI_SEARCH_TIMEOUT_MS);
  try {
    const { titles, descriptions } = await fetchWikiOpenSearch(
      q,
      Math.min(limit, 25),
      controller.signal,
    );
    return titles.slice(0, limit).map((title, i) => ({
      title,
      snippet: truncateEllipsis(
        stripWikiSnippet(descriptions[i] ?? ""),
        180,
      ),
    }));
  } finally {
    clearTimeout(timer);
  }
}
