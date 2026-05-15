import type { Client } from "discord.js";
import {
  fetchWikiPageWikitextIfExists,
  resolveWikiImageUrlFromWikitext,
  wikitextToDiscordMarkdown,
} from "../wiki/wikiSearch.js";
import { truncateEllipsis } from "../../../utility/text/truncate.js";
import type { TeamMember } from "./resoniteTeamSocials.js";
import { normalizePlatformInput } from "./resoniteTeamSocials.js";
import { fetchPlatformApiJson } from "./previews/apiFetch.js";
import { fetchMastodonApiPreview } from "./previews/mastodonApiPreview.js";
import { fetchRedditApiPreview } from "./previews/redditApiPreview.js";
import { fetchTwitchApiPreview } from "./previews/twitchApiPreview.js";
import { fetchXApiPreview } from "./previews/xApiPreview.js";
import { fetchYoutubeApiPreview } from "./previews/youtubeApiPreview.js";

export type PlatformPreviewImage = {
  readonly url: string;
  readonly description?: string;
};

export type PlatformPreview = {
  readonly platformLabel: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly stats: readonly string[];
  readonly url: string;
  readonly images: readonly PlatformPreviewImage[];
};

const PLATFORM_LABELS: Record<string, string> = {
  wiki: "Resonite Wiki",
  discord: "Discord",
  twitter: "Twitter / X",
  youtube: "YouTube",
  github: "GitHub",
  reddit: "Reddit",
  bluesky: "BlueSky",
  twitch: "Twitch",
  tiktok: "TikTok",
  fediverse: "Fediverse",
  carrd: "Carrd",
  website: "Website",
  blog: "Blog",
};

function platformLabel(platformId: string): string {
  return PLATFORM_LABELS[platformId] ?? platformId;
}

function usernameOnHost(url: string, hosts: readonly string[]): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return null;
    }
    const seg = u.pathname.split("/").filter(Boolean)[0];
    return seg ? decodeURIComponent(seg.replace(/^@/, "")) : null;
  } catch {
    return null;
  }
}

function parseBlueskyActor(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("bsky.app")) {
      return null;
    }
    const m = u.pathname.match(/\/profile\/([^/]+)/i);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

async function fetchGitHubPreview(
  url: string,
): Promise<PlatformPreview | null> {
  const user = usernameOnHost(url, ["github.com"]);
  if (!user) {
    return null;
  }
  const row = await fetchPlatformApiJson<{
    name?: string | null;
    login?: string;
    bio?: string | null;
    avatar_url?: string;
    followers?: number;
    public_repos?: number;
    html_url?: string;
  }>(`https://api.github.com/users/${encodeURIComponent(user)}`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!row) {
    return null;
  }
  const stats: string[] = [];
  if (typeof row.public_repos === "number") {
    stats.push(`**Public repos:** ${row.public_repos.toLocaleString()}`);
  }
  if (typeof row.followers === "number") {
    stats.push(`**Followers:** ${row.followers.toLocaleString()}`);
  }
  return {
    platformLabel: platformLabel("github"),
    title: row.name ?? row.login ?? user,
    subtitle: row.login ? `@${row.login}` : undefined,
    description: row.bio ? truncateEllipsis(row.bio, 900) : undefined,
    stats,
    url: row.html_url ?? url,
    images: row.avatar_url
      ? [{ url: row.avatar_url, description: "Avatar" }]
      : [],
  };
}

async function fetchBlueskyPreview(
  url: string,
): Promise<PlatformPreview | null> {
  const actor = parseBlueskyActor(url);
  if (!actor) {
    return null;
  }
  const row = await fetchPlatformApiJson<{
    displayName?: string;
    handle?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    postsCount?: number;
  }>(
    `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`,
  );
  if (!row) {
    return null;
  }
  const images: PlatformPreviewImage[] = [];
  if (row.banner) {
    images.push({ url: row.banner, description: "Banner" });
  }
  if (row.avatar) {
    images.push({ url: row.avatar, description: "Avatar" });
  }
  const stats: string[] = [];
  if (typeof row.followersCount === "number") {
    stats.push(`**Followers:** ${row.followersCount.toLocaleString()}`);
  }
  if (typeof row.postsCount === "number") {
    stats.push(`**Posts:** ${row.postsCount.toLocaleString()}`);
  }
  return {
    platformLabel: platformLabel("bluesky"),
    title: row.displayName ?? row.handle ?? actor,
    subtitle: row.handle ? `@${row.handle}` : undefined,
    description: row.description
      ? truncateEllipsis(row.description, 900)
      : undefined,
    stats,
    url,
    images,
  };
}

async function fetchDiscordPreview(
  url: string,
  member: TeamMember,
  client?: Client,
): Promise<PlatformPreview | null> {
  const userId = member.discord?.userId?.trim();
  if (!client || !userId) {
    return null;
  }
  try {
    const user = await client.users.fetch(userId, { force: true });
    const images: PlatformPreviewImage[] = [];
    const banner = user.bannerURL({ size: 1024 });
    if (banner) {
      images.push({ url: banner, description: "Banner" });
    }
    images.push({
      url: user.displayAvatarURL({ size: 512 }),
      description: "Avatar",
    });
    const display =
      user.globalName && user.globalName !== user.username
        ? `${user.globalName} (@${user.username})`
        : `@${user.username}`;
    return {
      platformLabel: platformLabel("discord"),
      title: display,
      subtitle: userId ? `User ID \`${userId}\`` : undefined,
      stats: [],
      url,
      images,
    };
  } catch {
    return null;
  }
}

async function fetchWikiPreview(
  member: TeamMember,
  url: string,
): Promise<PlatformPreview | null> {
  const title = member.wikiPath.replace(/^User:/i, "User:").trim();
  const page = await fetchWikiPageWikitextIfExists(title);
  if (!page) {
    return null;
  }
  const imageUrl = await resolveWikiImageUrlFromWikitext(page.wikitext);
  const body = wikitextToDiscordMarkdown(page.wikitext, 700);
  return {
    platformLabel: platformLabel("wiki"),
    title: page.title,
    subtitle: member.role,
    description: body ? truncateEllipsis(body, 900) : undefined,
    stats: [`**Team:** ${member.section}`],
    url,
    images: imageUrl
      ? [{ url: imageUrl, description: page.title }]
      : [],
  };
}

export async function fetchPlatformPreview(opts: {
  platformId: string;
  url: string;
  member: TeamMember;
  discordClient?: Client;
}): Promise<PlatformPreview | null> {
  const platformId = normalizePlatformInput(opts.platformId);
  const { url, member, discordClient } = opts;

  switch (platformId) {
    case "twitter":
      return fetchXApiPreview(url);
    case "github":
      return fetchGitHubPreview(url);
    case "bluesky":
      return fetchBlueskyPreview(url);
    case "reddit":
      return fetchRedditApiPreview(url);
    case "youtube":
      return fetchYoutubeApiPreview(url);
    case "discord":
      return fetchDiscordPreview(url, member, discordClient);
    case "wiki":
      return fetchWikiPreview(member, url);
    case "twitch":
      return fetchTwitchApiPreview(url);
    case "fediverse":
      return fetchMastodonApiPreview(url);
    case "tiktok":
    case "carrd":
    case "website":
    case "blog":
      return null;
    default:
      return null;
  }
}
