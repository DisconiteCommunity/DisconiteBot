import { getSocialApiConfig } from "../../../../config/socialApis.js";
import { truncateEllipsis } from "../../../../utility/text/truncate.js";
import type { PlatformPreview, PlatformPreviewImage } from "../platformPreview.js";
import { fetchPlatformApiJson } from "./apiFetch.js";

type XUserResponse = {
  data?: {
    name?: string;
    username?: string;
    description?: string;
    profile_image_url?: string;
    profile_banner_url?: string;
    public_metrics?: { followers_count?: number };
  };
};

const X_API_BASES = [
  "https://api.twitter.com",
  "https://api.x.com",
] as const;

/** Hostnames accepted for X / Twitter profile URLs in the team roster. */
export function parseXUsername(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const isTwitter =
      host === "twitter.com" ||
      host === "x.com" ||
      host === "mobile.twitter.com" ||
      host === "mobile.x.com" ||
      host.endsWith(".twitter.com") ||
      host.endsWith(".x.com");
    if (!isTwitter) {
      return null;
    }

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "i" && parts[1] === "user" && parts[2]) {
      return decodeURIComponent(parts[2].replace(/^@/, ""));
    }

    const seg = parts[0];
    if (
      !seg ||
      seg === "home" ||
      seg === "search" ||
      seg === "intent" ||
      seg === "share" ||
      seg === "hashtag"
    ) {
      return null;
    }
    return decodeURIComponent(seg.replace(/^@/, ""));
  } catch {
    return null;
  }
}

function upsizeXAvatar(url: string): string {
  return url.replace(/_normal(\.(jpe?g|png|gif|webp))$/i, "_400x400$1");
}

async function fetchXUserByUsername(
  username: string,
  token: string,
): Promise<XUserResponse["data"] | null> {
  const params = new URLSearchParams({
    "user.fields":
      "description,profile_image_url,profile_banner_url,public_metrics",
  });
  const path = `/2/users/by/username/${encodeURIComponent(username)}?${params.toString()}`;

  for (const base of X_API_BASES) {
    const data = await fetchPlatformApiJson<XUserResponse>(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data?.data) {
      return data.data;
    }
  }
  return null;
}

export async function fetchXApiPreview(url: string): Promise<PlatformPreview | null> {
  const token = getSocialApiConfig().xApiBearerToken;
  const username = parseXUsername(url);
  if (!token || !username) {
    return null;
  }

  const user = await fetchXUserByUsername(username, token);
  if (!user) {
    return null;
  }

  const images: PlatformPreviewImage[] = [];
  if (user.profile_banner_url) {
    images.push({ url: user.profile_banner_url, description: "Banner" });
  }
  if (user.profile_image_url) {
    images.push({
      url: upsizeXAvatar(user.profile_image_url),
      description: "Avatar",
    });
  }

  const stats: string[] = [];
  if (typeof user.public_metrics?.followers_count === "number") {
    stats.push(
      `**Followers:** ${user.public_metrics.followers_count.toLocaleString()}`,
    );
  }

  return {
    platformLabel: "Twitter / X",
    title: user.name ?? user.username ?? username,
    subtitle: user.username ? `@${user.username}` : undefined,
    description: user.description
      ? truncateEllipsis(user.description, 900)
      : undefined,
    stats,
    url,
    images,
  };
}
