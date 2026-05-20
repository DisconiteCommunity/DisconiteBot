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

import { YDM_BOARD_KEY_PATTERN_SOURCE } from "../../services/github/yellowDogManProjects.js";

/** YDM GitHub projects: pick a board (`ydm_projects_pick:froox`, …) */
export const YDM_PROJECTS_PICK_BOARD_PREFIX = "ydm_projects_pick:";

/** Optional `:doneBit:inProgressBit` suffixes (0 or 1) from `/projects list`. */
export const YDM_PROJECTS_PICK_BOARD_PATTERN = new RegExp(
  `^ydm_projects_pick:(${YDM_BOARD_KEY_PATTERN_SOURCE})(?::[01])?(?::[01])?$`,
);

/** YDM GitHub projects: paginated list/search (`ydmp:` + base64url state) */
export const YDM_PROJECTS_PAGE_PREFIX = "ydmp:";

export const YDM_PROJECTS_PAGE_PATTERN = /^ydmp:[A-Za-z0-9_-]+$/;

/** YDM GitHub projects: select one issue from a paginated list/search page. */
export const YDM_PROJECTS_ITEM_SELECT_PREFIX = "yi:";

export const YDM_PROJECTS_ITEM_SELECT_PATTERN = /^yi:[A-Za-z0-9_-]+$/;

/** YDM GitHub projects: select Status column filter on a board/list page. */
export const YDM_PROJECTS_STATUS_SELECT_PREFIX = "ys:";

export const YDM_PROJECTS_STATUS_SELECT_PATTERN = /^ys:[A-Za-z0-9_-]+$/;

/** Combined issue picker on board overview (`ydm_projects_sel:picker:0:0`) */
export const YDM_PROJECTS_BOARD_SELECT_PATTERN =
  /^ydm_projects_sel:picker:[01]:[01]$/;

/** View one issue in an embed (`ydmpi:board|number|repo|flags`) */
export const YDM_PROJECTS_ITEM_PATTERN =
  /^ydmpi:[^|]+\|\d+\|[^|]*\|[01]{2}$/;

/** Resonite issue search dashboard controls (`ydmis:action:state`). */
export const YDM_ISSUES_SEARCH_DASHBOARD_PREFIX = "ydmis:";

export const YDM_ISSUES_SEARCH_DASHBOARD_PATTERN =
  /^ydmis:[a-z_]+:[A-Za-z0-9_.-]+$/;

/** Resonite repo issue search results pagination (`ydmisr:` + base64url state). */
export const YDM_ISSUES_REPO_RESULTS_PREFIX = "ydmisr:";

export const YDM_ISSUES_REPO_RESULTS_PATTERN =
  /^ydmisr:[A-Za-z0-9_-]+$/;

/** Resonite repo issue search results: pick list row (`ygh:` + same base64 as `ydmisr:` payloads). */
export const YDM_ISSUES_REPO_PICK_MENU_PREFIX = "ygh:";

export const YDM_ISSUES_REPO_PICK_MENU_PATTERN = /^ygh:[A-Za-z0-9_-]+$/;

/** Return to `/resonite search github` dashboard from search results. */
export const YDM_ISSUES_SEARCH_RESET_BUTTON_ID = "ydm_issues_search_reset";
