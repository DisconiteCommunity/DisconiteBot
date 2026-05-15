import { getSocialApiConfig } from "../../../../config/socialApis.js";
import { RESONITE_API_USER_AGENT } from "../../api/api.js";
import { truncateEllipsis } from "../../../../utility/text/truncate.js";
import type { PlatformPreview, PlatformPreviewImage } from "../platformPreview.js";
import { fetchPlatformApiJson } from "./apiFetch.js";

type RedditTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type RedditAboutResponse = {
  data?: {
    name?: string;
    title?: string;
    icon_img?: string;
    subreddit?: {
      banner_img?: string;
      public_description?: string;
      subscribers?: number;
    };
    link_karma?: number;
    comment_karma?: number;
  };
};

let redditTokenCache: { token: string; expiresAt: number } | null = null;

async function redditAccessToken(): Promise<string | null> {
  const { redditClientId, redditClientSecret } = getSocialApiConfig();
  if (!redditClientId || !redditClientSecret) {
    return null;
  }
  if (redditTokenCache && redditTokenCache.expiresAt > Date.now() + 60_000) {
    return redditTokenCache.token;
  }

  const basic = Buffer.from(`${redditClientId}:${redditClientSecret}`).toString(
    "base64",
  );
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": RESONITE_API_USER_AGENT,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    return null;
  }
  const json = (await res.json()) as RedditTokenResponse;
  if (!json.access_token) {
    return null;
  }
  redditTokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

function parseRedditUsername(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p.toLowerCase() === "user");
    if (i >= 0) {
      const name = parts[i + 1];
      if (name) {
        return decodeURIComponent(name);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchRedditApiPreview(
  url: string,
): Promise<PlatformPreview | null> {
  const username = parseRedditUsername(url);
  const token = await redditAccessToken();
  if (!username || !token) {
    return null;
  }

  const data = await fetchPlatformApiJson<RedditAboutResponse>(
    `https://oauth.reddit.com/user/${encodeURIComponent(username)}/about`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": RESONITE_API_USER_AGENT,
      },
    },
  );
  const d = data?.data;
  if (!d) {
    return null;
  }

  const images: PlatformPreviewImage[] = [];
  const banner = d.subreddit?.banner_img?.trim();
  if (banner) {
    images.push({ url: banner.replace(/&amp;/g, "&"), description: "Banner" });
  }
  if (d.icon_img) {
    images.push({
      url: d.icon_img.replace(/&amp;/g, "&"),
      description: "Avatar",
    });
  }

  const stats: string[] = [];
  if (typeof d.subreddit?.subscribers === "number") {
    stats.push(
      `**Subreddit subscribers:** ${d.subreddit.subscribers.toLocaleString()}`,
    );
  }
  const karma = (d.link_karma ?? 0) + (d.comment_karma ?? 0);
  if (karma > 0) {
    stats.push(`**Karma:** ${karma.toLocaleString()}`);
  }

  return {
    platformLabel: "Reddit",
    title: d.title ?? username,
    subtitle: `u/${username}`,
    description: d.subreddit?.public_description
      ? truncateEllipsis(d.subreddit.public_description, 900)
      : undefined,
    stats,
    url,
    images,
  };
}
