import {
  SOCIALS_BACK_BUTTON_PREFIX,
  SOCIALS_PREVIEW_BUTTON_PREFIX,
} from "../../../utility/discord/discordInteractionIds.js";
import { normalizePlatformInput } from "./resoniteTeamSocials.js";

export function encodeSocialPreviewButtonId(
  memberId: string,
  platformId: string,
): string {
  const platform = normalizePlatformInput(platformId);
  return `${SOCIALS_PREVIEW_BUTTON_PREFIX}${memberId}:${platform}`;
}

export function encodeSocialBackButtonId(memberId: string): string {
  return `${SOCIALS_BACK_BUTTON_PREFIX}${memberId}`;
}

export function parseSocialPreviewButtonId(
  customId: string,
): { memberId: string; platformId: string } | null {
  if (!customId.startsWith(SOCIALS_PREVIEW_BUTTON_PREFIX)) {
    return null;
  }
  const rest = customId.slice(SOCIALS_PREVIEW_BUTTON_PREFIX.length);
  const separatorIndex = rest.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }
  return {
    memberId: rest.slice(0, separatorIndex),
    platformId: rest.slice(separatorIndex + 1),
  };
}

export function parseSocialBackButtonId(customId: string): string | null {
  if (!customId.startsWith(SOCIALS_BACK_BUTTON_PREFIX)) {
    return null;
  }
  const memberId = customId.slice(SOCIALS_BACK_BUTTON_PREFIX.length);
  return memberId.length > 0 ? memberId : null;
}
