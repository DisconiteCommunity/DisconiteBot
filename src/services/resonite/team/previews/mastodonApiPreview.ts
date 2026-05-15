import { truncateEllipsis } from "../../../../utility/text/truncate.js";
import type { PlatformPreview, PlatformPreviewImage } from "../platformPreview.js";
import { fetchPlatformApiJson } from "./apiFetch.js";

type MastodonAccount = {
  display_name?: string;
  acct?: string;
  url?: string;
  note?: string;
  avatar?: string;
  header?: string;
  followers_count?: number;
  statuses_count?: number;
};

export function parseMastodonAcct(url: string): {
  instance: string;
  acct: string;
} | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/@([^/]+)/);
    if (!m?.[1]) {
      return null;
    }
    const local = decodeURIComponent(m[1]);
    return {
      instance: u.hostname,
      acct: `${local}@${u.hostname}`,
    };
  } catch {
    return null;
  }
}

export async function fetchMastodonApiPreview(
  url: string,
): Promise<PlatformPreview | null> {
  const ref = parseMastodonAcct(url);
  if (!ref) {
    return null;
  }

  const account = await fetchPlatformApiJson<MastodonAccount>(
    `https://${ref.instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(ref.acct)}`,
  );
  if (!account) {
    return null;
  }

  const images: PlatformPreviewImage[] = [];
  if (account.header) {
    images.push({ url: account.header, description: "Banner" });
  }
  if (account.avatar) {
    images.push({ url: account.avatar, description: "Avatar" });
  }

  const stats: string[] = [];
  if (typeof account.followers_count === "number") {
    stats.push(`**Followers:** ${account.followers_count.toLocaleString()}`);
  }
  if (typeof account.statuses_count === "number") {
    stats.push(`**Posts:** ${account.statuses_count.toLocaleString()}`);
  }

  const note = account.note?.replace(/<[^>]+>/g, "").trim();

  return {
    platformLabel: "Fediverse",
    title: account.display_name?.trim() || ref.acct,
    subtitle: account.acct ? `@${account.acct}` : undefined,
    description: note ? truncateEllipsis(note, 900) : undefined,
    stats,
    url: account.url ?? url,
    images,
  };
}
