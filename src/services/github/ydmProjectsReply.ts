import type {
  CommandInteraction,
  InteractionEditReplyOptions,
  MessageComponentInteraction,
} from "discord.js";
import { findProjectBoard, ydmBoardDisplayName } from "./yellowDogManProjects.js";
import type { YdmProjectItem } from "./yellowDogManProjects.js";
import { getFilteredYdmProjectItems } from "./ydmProjectsCache.js";
import {
  buildYdmProjectsPageComponents,
  ydmProjectsMessagePayload,
} from "./ydmProjectsComponentsV2.js";
import {
  clampYdmProjectsPageIndex,
  filterYdmProjectItemsByStatusColumn,
  YDM_PROJECTS_PAGE_SIZE,
  YDM_PROJECTS_STATUS_FILTER_NONE,
  type YdmProjectsBoardParam,
  type YdmProjectsPageState,
  ydmProjectsPageCount,
} from "./ydmProjectsPages.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";

function collectStatusColumnChoices(items: readonly YdmProjectItem[]): {
  namedStatuses: string[];
  includeNoStatus: boolean;
} {
  const namedStatuses = new Set<string>();
  let includeNoStatus = false;
  for (const item of items) {
    const status = item.status?.trim();
    if (status) {
      if (status.length <= 100) {
        namedStatuses.add(status);
      }
    } else {
      includeNoStatus = true;
    }
  }
  return {
    namedStatuses: [...namedStatuses].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    ),
    includeNoStatus,
  };
}

function boardHeader(
  board: YdmProjectsBoardParam,
  boards: Awaited<ReturnType<typeof getFilteredYdmProjectItems>>["boards"],
  mode: "list" | "search",
  query?: string,
  statusFilter?: string,
): { title: string; boardUrl: string | null } {
  const statusSuffix =
    statusFilter === YDM_PROJECTS_STATUS_FILTER_NONE
      ? " · Status: _(none)_"
      : statusFilter
        ? ` · Status: ${statusFilter}`
        : "";
  if (board === "all") {
    const titleBase =
      mode === "search" && query
        ? `All boards · “${query}”`
        : "All team boards";
    return { title: titleBase + statusSuffix, boardUrl: null };
  }
  const hit = findProjectBoard(boards, board);
  const display = hit ? ydmBoardDisplayName(hit) : String(board);
  const titleBase =
    mode === "search" && query
      ? `${display} · “${query}”`
      : display;
  return { title: titleBase + statusSuffix, boardUrl: hit?.boardUrl ?? null };
}

export async function renderYdmProjectsPage(
  interaction:
    | CommandInteraction
    | MessageComponentInteraction,
  state: YdmProjectsPageState,
  editOpts?: { fromDeferUpdate?: boolean; pageSize?: number },
): Promise<void> {
  const resolvedPageSize =
    state.pageSize ?? editOpts?.pageSize ?? YDM_PROJECTS_PAGE_SIZE;
  const includeDone = state.d === 1;
  const inProgressOnly = state.i === 1;
  const { boards, items: itemsBeforeStatus } = await getFilteredYdmProjectItems({
    board: state.b,
    includeDone,
    inProgressOnly,
    query: state.m === "search" ? state.q : undefined,
  });

  const statusColumnMenu = collectStatusColumnChoices(itemsBeforeStatus);
  const statusMenuPayload =
    statusColumnMenu.namedStatuses.length > 0 || statusColumnMenu.includeNoStatus
      ? statusColumnMenu
      : null;

  const items = filterYdmProjectItemsByStatusColumn(
    itemsBeforeStatus,
    state.statusFilter,
  );

  const totalPages = ydmProjectsPageCount(items.length, resolvedPageSize);
  const pageIndex = clampYdmProjectsPageIndex(state.p, totalPages);
  const pageState = { ...state, p: pageIndex, pageSize: resolvedPageSize };

  const { title, boardUrl } = boardHeader(
    state.b,
    boards,
    state.m,
    state.q,
    state.statusFilter,
  );

  if (itemsBeforeStatus.length === 0) {
    const empty = [
      `# ${title}`,
      state.m === "search"
        ? "_No matching items. Try another keyword or board._"
        : includeDone
          ? "_No done items on this board._"
          : inProgressOnly
            ? "_No in-progress items. Set **done** to true to include completed work._"
            : "_No active items (done items are hidden unless **done** is true)._",
    ].join("\n");
    const payload = ydmProjectsMessagePayload(
      buildYdmProjectsPageComponents(
        empty,
        [],
        pageState,
        boardUrl,
        null,
        resolvedPageSize,
      ),
    );
    if (editOpts?.fromDeferUpdate && interaction.isMessageComponent()) {
      await interaction.editReply(payload as InteractionEditReplyOptions);
    } else {
      await interaction.editReply(payload as InteractionEditReplyOptions);
    }
    return;
  }

  if (items.length === 0) {
    const empty = [
      `# ${title}`,
      "_No items match this **Status** filter. Choose **All columns** in the menu below._",
    ].join("\n");
    const payload = ydmProjectsMessagePayload(
      buildYdmProjectsPageComponents(
        empty,
        [],
        pageState,
        boardUrl,
        statusMenuPayload,
        resolvedPageSize,
      ),
    );
    await interaction.editReply(payload as InteractionEditReplyOptions);
    return;
  }

  const header = `# ${title}`;
  const components = buildYdmProjectsPageComponents(
    header,
    items,
    pageState,
    boardUrl,
    statusMenuPayload,
    resolvedPageSize,
  );
  const payload = ydmProjectsMessagePayload(components);
  await interaction.editReply(payload as InteractionEditReplyOptions);
}

export function missingGitHubTokenMessage(): string {
  return truncateEllipsis(
    "GitHub project boards are not configured on this bot. " +
      "An operator must set **`GITHUB_TOKEN`** (scopes: `read:project`, `read:org`).",
    300,
  );
}
