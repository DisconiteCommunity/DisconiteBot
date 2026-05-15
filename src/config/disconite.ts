import { getEnv } from "./env.js";

export const DEFAULT_WEBLATE_BASE_URL = "https://translate.disconite.net";
export const DEFAULT_WEBLATE_PROJECT_SLUG = "resonite";
export const DEFAULT_DISCONITE_FORUM_BASE_URL = "https://disconite.net";

export function getWeblateBaseUrl(): string {
  const raw = getEnv().WEBLATE_BASE_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_WEBLATE_BASE_URL).replace(
    /\/$/,
    "",
  );
}

export function getWeblateApiToken(): string | undefined {
  const raw = getEnv().WEBLATE_API_TOKEN?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function getWeblateProjectSlug(): string {
  const raw = getEnv().WEBLATE_PROJECT_SLUG?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_WEBLATE_PROJECT_SLUG;
}

export function getDisconiteForumBaseUrl(): string {
  const raw = getEnv().DISCONITE_FORUM_BASE_URL?.trim();
  return (
    raw && raw.length > 0 ? raw : DEFAULT_DISCONITE_FORUM_BASE_URL
  ).replace(/\/$/, "");
}

/** Welcome topic on the Disconite forum (Announcements). */
export const DISCONITE_FORUM_WELCOME_POST_PATH =
  "/t/welcome-to-the-disconite-forum/53/5";

export function getDisconiteForumWelcomePostUrl(): string {
  return `${getDisconiteForumBaseUrl()}${DISCONITE_FORUM_WELCOME_POST_PATH}`;
}
