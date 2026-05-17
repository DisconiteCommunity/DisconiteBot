const MARKDOWN_IMAGE_RE = /!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMG_SRC_RE = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
const HTML_IMG_TAG_RE = /<img\b[^>]*>/gi;

/** Discord media gallery item limit per message. */
export const GITHUB_MARKDOWN_IMAGE_LIMIT = 4;

export function normalizeGitHubMarkdownImageUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) {
    return null;
  }
  if (url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  if (url.startsWith("/user-attachments/")) {
    return `https://github.com${url}`;
  }
  if (url.startsWith("/")) {
    return `https://github.com${url}`;
  }
  return null;
}

export function extractGitHubMarkdownImageUrls(
  markdown: string | null | undefined,
  limit = GITHUB_MARKDOWN_IMAGE_LIMIT,
): string[] {
  if (!markdown?.trim()) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];

  const collect = (raw: string) => {
    const normalized = normalizeGitHubMarkdownImageUrl(raw);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push(normalized);
  };

  for (const re of [MARKDOWN_IMAGE_RE, HTML_IMG_SRC_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) {
      collect(m[2] ?? m[1] ?? "");
      if (out.length >= limit) {
        return out;
      }
    }
  }

  return out;
}

/** Remove image syntax so the gallery is not duplicated in plain text. */
export function stripGitHubMarkdownImages(text: string): string {
  return text
    .replace(MARKDOWN_IMAGE_RE, "")
    .replace(HTML_IMG_TAG_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
