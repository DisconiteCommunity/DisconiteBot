import { getEnv } from "./env.js";

export type SocialApiConfig = {
  readonly youtubeApiKey?: string;
  readonly xApiBearerToken?: string;
  readonly twitchClientId?: string;
  readonly redditClientId?: string;
  readonly redditClientSecret?: string;
};

function envOrProcess(
  validated: string | undefined,
  key: string,
): string | undefined {
  const v = validated?.trim() || process.env[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

/** Optional credentials for rich `/resonite socials` profile previews. */
export function getSocialApiConfig(): SocialApiConfig {
  let validated: ReturnType<typeof getEnv> | undefined;
  try {
    validated = getEnv();
  } catch {
    validated = undefined;
  }
  return {
    youtubeApiKey: envOrProcess(validated?.YOUTUBE_API_KEY, "YOUTUBE_API_KEY"),
    xApiBearerToken: envOrProcess(
      validated?.X_API_BEARER_TOKEN,
      "X_API_BEARER_TOKEN",
    ),
    twitchClientId: envOrProcess(validated?.TWITCH_CLIENT_ID, "TWITCH_CLIENT_ID"),
    redditClientId: envOrProcess(validated?.REDDIT_CLIENT_ID, "REDDIT_CLIENT_ID"),
    redditClientSecret: envOrProcess(
      validated?.REDDIT_CLIENT_SECRET,
      "REDDIT_CLIENT_SECRET",
    ),
  };
}
