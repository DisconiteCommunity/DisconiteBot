import { getSocialApiConfig } from "../../../../config/socialApis.js";
import { truncateEllipsis } from "../../../../utility/text/truncate.js";
import type { PlatformPreview, PlatformPreviewImage } from "../platformPreview.js";
import { fetchPlatformApiJson } from "./apiFetch.js";

type YoutubeChannelsResponse = {
  items?: {
    snippet?: {
      title?: string;
      description?: string;
      customUrl?: string;
      thumbnails?: { high?: { url?: string }; default?: { url?: string } };
    };
    statistics?: {
      subscriberCount?: string;
      videoCount?: string;
    };
    brandingSettings?: {
      image?: { bannerExternalUrl?: string };
    };
  }[];
};

export function parseYoutubeChannelRef(url: string): {
  forHandle?: string;
  channelId?: string;
  forUsername?: string;
} | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0]?.startsWith("@")) {
      return { forHandle: parts[0].slice(1) };
    }
    if (parts[0] === "channel" && parts[1]) {
      return { channelId: parts[1] };
    }
    if (parts[0] === "user" && parts[1]) {
      return { forUsername: parts[1] };
    }
    if (parts[0] === "c" && parts[1]) {
      return { forUsername: parts[1] };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchYoutubeOEmbed(url: string): Promise<PlatformPreview | null> {
  const oembed = await fetchPlatformApiJson<{
    author_name?: string;
    title?: string;
    thumbnail_url?: string;
  }>(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  );
  if (!oembed) {
    return null;
  }
  return {
    platformLabel: "YouTube",
    title: oembed.author_name ?? oembed.title ?? "YouTube",
    subtitle: oembed.title,
    stats: [],
    url,
    images: oembed.thumbnail_url
      ? [{ url: oembed.thumbnail_url, description: "Channel" }]
      : [],
  };
}

export async function fetchYoutubeApiPreview(
  url: string,
): Promise<PlatformPreview | null> {
  const apiKey = getSocialApiConfig().youtubeApiKey;
  if (!apiKey) {
    return fetchYoutubeOEmbed(url);
  }

  const ref = parseYoutubeChannelRef(url);
  if (!ref) {
    return fetchYoutubeOEmbed(url);
  }

  const params = new URLSearchParams({
    part: "snippet,statistics,brandingSettings",
    key: apiKey,
  });
  if (ref.forHandle) {
    params.set("forHandle", ref.forHandle);
  } else if (ref.channelId) {
    params.set("id", ref.channelId);
  } else if (ref.forUsername) {
    params.set("forUsername", ref.forUsername);
  }

  const data = await fetchPlatformApiJson<YoutubeChannelsResponse>(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
  );
  const ch = data?.items?.[0];
  if (!ch?.snippet) {
    return fetchYoutubeOEmbed(url);
  }

  const images: PlatformPreviewImage[] = [];
  const banner = ch.brandingSettings?.image?.bannerExternalUrl;
  if (banner) {
    images.push({ url: banner, description: "Banner" });
  }
  const avatar =
    ch.snippet.thumbnails?.high?.url ?? ch.snippet.thumbnails?.default?.url;
  if (avatar) {
    images.push({ url: avatar, description: "Avatar" });
  }

  const stats: string[] = [];
  if (ch.statistics?.subscriberCount) {
    stats.push(
      `**Subscribers:** ${Number(ch.statistics.subscriberCount).toLocaleString()}`,
    );
  }
  if (ch.statistics?.videoCount) {
    stats.push(
      `**Videos:** ${Number(ch.statistics.videoCount).toLocaleString()}`,
    );
  }

  const handle = ch.snippet.customUrl;
  return {
    platformLabel: "YouTube",
    title: ch.snippet.title ?? "YouTube channel",
    subtitle: handle ?? undefined,
    description: ch.snippet.description
      ? truncateEllipsis(ch.snippet.description, 900)
      : undefined,
    stats,
    url,
    images,
  };
}
