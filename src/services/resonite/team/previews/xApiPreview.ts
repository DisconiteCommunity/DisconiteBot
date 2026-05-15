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

function parseXUsername(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "twitter.com" && host !== "x.com") {
      return null;
    }
    const seg = u.pathname.split("/").filter(Boolean)[0];
    return seg ? decodeURIComponent(seg.replace(/^@/, "")) : null;
  } catch {
    return null;
  }
}

function upsizeXAvatar(url: string): string {
  return url.replace(/_normal(\.(jpe?g|png|gif|webp))$/i, "_400x400$1");
}

export async function fetchXApiPreview(url: string): Promise<PlatformPreview | null> {
  const token = getSocialApiConfig().xApiBearerToken;
  const username = parseXUsername(url);
  if (!token || !username) {
    return null;
  }

  const params = new URLSearchParams({
    "user.fields":
      "description,profile_image_url,profile_banner_url,public_metrics",
  });
  const data = await fetchPlatformApiJson<XUserResponse>(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const user = data?.data;
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
