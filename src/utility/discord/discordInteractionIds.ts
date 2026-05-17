/**
 * Discord component custom IDs and embed-footer state prefixes.
 * Keep these human-readable; they appear in logs and debugging.
 */

/** Wiki search: string select to pick a page from multiple hits */
export const WIKI_PAGE_PICK_MENU_ID = "wiki_page_pick";

/** Base64 JSON state for wiki pick menu (stored in embed footer) */
export const WIKI_PAGE_PICK_STATE_PREFIX = "wiki_page_pick_state:";

/** Weblate translate: string select to pick a translation key */
export const WEBLATE_KEY_PICK_MENU_ID = "weblate_key_pick";

export const WEBLATE_KEY_PICK_STATE_PREFIX = "weblate_key_pick_state:";

/** Discourse forum: string select to pick a post from search */
export const FORUM_POST_PICK_MENU_ID = "forum_post_pick";

export const FORUM_POST_PICK_STATE_PREFIX = "forum_post_pick_state:";

/** Resonite metrics: confirm unregister subscription */
export const METRICS_UNREGISTER_CONFIRM_BUTTON_ID =
  "resonite_metrics_unregister_confirm";

/** Resonite metrics: cancel unregister */
export const METRICS_UNREGISTER_CANCEL_BUTTON_ID =
  "resonite_metrics_unregister_cancel";

/** Resonite metrics: paginated extra sessions (`resonite_metrics_sessions:0`, …) */
export const METRICS_SESSIONS_PAGE_PREFIX = "resonite_metrics_sessions:";

export const METRICS_SESSIONS_PAGE_PATTERN = /^resonite_metrics_sessions:\d+$/;

/** Resonite metrics: open “go to page” modal from pagination */
export const METRICS_SESSIONS_GOTO_BUTTON_ID = "resonite_metrics_sessions_goto";

export const METRICS_SESSIONS_GOTO_MODAL_ID = "resonite_metrics_sessions_goto_modal";

export const METRICS_SESSIONS_GOTO_INPUT_ID = "page";

/** Socials roster: open platform profile preview */
export const SOCIALS_PREVIEW_BUTTON_PREFIX = "socials_preview:";

/** Socials roster: return to link list */
export const SOCIALS_BACK_BUTTON_PREFIX = "socials_back:";

/** discordx @ButtonComponent regex matchers */
export const SOCIALS_PREVIEW_BUTTON_ID_PATTERN =
  /^socials_preview:[^:]+:[^:]+$/;

export const SOCIALS_BACK_BUTTON_ID_PATTERN = /^socials_back:[^:]+$/;
