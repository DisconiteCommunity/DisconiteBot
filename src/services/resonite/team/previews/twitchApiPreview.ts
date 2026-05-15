import { getSocialApiConfig } from "../../../../config/socialApis.js";
import { truncateEllipsis } from "../../../../utility/text/truncate.js";
import type { PlatformPreview, PlatformPreviewImage } from "../platformPreview.js";
import { fetchPlatformApiJson } from "./apiFetch.js";

type TwitchUsersResponse = {
  data?: {
    id?: string;
    login?: string;
    display_name?: string;
    description?: string;
    profile_image_url?: string;
    offline_image_url?: string;
  }[];
};

type TwitchFollowersResponse = {
  total?: number;
};

function parseTwitchLogin(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.replace(/^www\./, "").toLowerCase().endsWith("twitch.tv")) {
      return null;
    }
    const login = u.pathname.split("/").filter(Boolean)[0];
    return login ? decodeURIComponent(login.toLowerCase()) : null;
  } catch {
    return null;
  }
}

export async function fetchTwitchApiPreview(
  url: string,
): Promise<PlatformPreview | null> {
  const clientId = getSocialApiConfig().twitchClientId;
  const login = parseTwitchLogin(url);
  if (!clientId || !login) {
    return null;
  }

  const headers = { "Client-Id": clientId };

  const users = await fetchPlatformApiJson<TwitchUsersResponse>(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
    { headers },
  );
  const user = users?.data?.[0];
  if (!user?.id) {
    return null;
  }

  let followerTotal: number | undefined;
  const followers = await fetchPlatformApiJson<TwitchFollowersResponse>(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(user.id)}&first=1`,
    { headers },
  );
  if (typeof followers?.total === "number") {
    followerTotal = followers.total;
  }

  const images: PlatformPreviewImage[] = [];
  if (user.offline_image_url) {
    images.push({ url: user.offline_image_url, description: "Banner" });
  }
  if (user.profile_image_url) {
    images.push({ url: user.profile_image_url, description: "Avatar" });
  }

  const stats: string[] = [];
  if (typeof followerTotal === "number") {
    stats.push(`**Followers:** ${followerTotal.toLocaleString()}`);
  }

  return {
    platformLabel: "Twitch",
    title: user.display_name ?? user.login ?? login,
    subtitle: user.login ? `twitch.tv/${user.login}` : undefined,
    description: user.description
      ? truncateEllipsis(user.description, 900)
      : undefined,
    stats,
    url,
    images,
  };
}
