import { normalizePlatformInput } from "../../services/resonite/team/resoniteTeamSocials.js";

/** RGB accent for Components v2 container sidebar (0xRRGGBB). */
const PLATFORM_ACCENT_COLORS: Record<string, number> = {
  all: 0x6366f1,
  wiki: 0xf97316,
  discord: 0x5865f2,
  twitter: 0x000000,
  youtube: 0xff0000,
  github: 0x24292f,
  reddit: 0xff4500,
  bluesky: 0x0085ff,
  twitch: 0x9146ff,
  tiktok: 0xfe2c55,
  fediverse: 0x6364ff,
  carrd: 0x202020,
  website: 0x64748b,
  blog: 0x64748b,
  default: 0x94a3b8,
};

export function getPlatformAccentColor(platformId: string): number {
  const id = normalizePlatformInput(platformId.trim());
  return PLATFORM_ACCENT_COLORS[id] ?? PLATFORM_ACCENT_COLORS.default;
}
