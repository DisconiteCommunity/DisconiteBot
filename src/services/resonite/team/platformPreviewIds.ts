import { normalizePlatformInput } from "./resoniteTeamSocials.js";

export const SOCIAL_PREVIEW_ID_PREFIX = "socpv:";
export const SOCIAL_BACK_ID_PREFIX = "socpb:";

export const SOCIAL_PREVIEW_BUTTON_ID = /^socpv:[^:]+:[^:]+$/;
export const SOCIAL_BACK_BUTTON_ID = /^socpb:[^:]+$/;

export function encodeSocialPreviewButtonId(
  memberId: string,
  platformId: string,
): string {
  const platform = normalizePlatformInput(platformId);
  return `${SOCIAL_PREVIEW_ID_PREFIX}${memberId}:${platform}`;
}

export function encodeSocialBackButtonId(memberId: string): string {
  return `${SOCIAL_BACK_ID_PREFIX}${memberId}`;
}

export function parseSocialPreviewButtonId(
  customId: string,
): { memberId: string; platformId: string } | null {
  if (!customId.startsWith(SOCIAL_PREVIEW_ID_PREFIX)) {
    return null;
  }
  const rest = customId.slice(SOCIAL_PREVIEW_ID_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0) {
    return null;
  }
  return {
    memberId: rest.slice(0, sep),
    platformId: rest.slice(sep + 1),
  };
}

export function parseSocialBackButtonId(customId: string): string | null {
  if (!customId.startsWith(SOCIAL_BACK_ID_PREFIX)) {
    return null;
  }
  const memberId = customId.slice(SOCIAL_BACK_ID_PREFIX.length);
  return memberId.length > 0 ? memberId : null;
}
