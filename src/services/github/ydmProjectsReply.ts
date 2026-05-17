import type {
  CommandInteraction,
  InteractionEditReplyOptions,
  MessageComponentInteraction,
} from "discord.js";
import { findProjectBoard } from "./yellowDogManProjects.js";
import { getFilteredYdmProjectItems } from "./ydmProjectsCache.js";
import {
  buildYdmProjectsPageComponents,
  ydmProjectsMessagePayload,
} from "./ydmProjectsComponentsV2.js";
import {
  clampYdmProjectsPageIndex,
  type YdmProjectsBoardParam,
  type YdmProjectsPageState,
  ydmProjectsPageCount,
} from "./ydmProjectsPages.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";

function boardHeader(
  board: YdmProjectsBoardParam,
  boards: Awaited<ReturnType<typeof getFilteredYdmProjectItems>>["boards"],
  mode: "list" | "search",
  query?: string,
): { title: string; boardUrl: string | null } {
  if (board === "all") {
    const title =
      mode === "search" && query
        ? `All boards · “${query}”`
        : "All team boards";
    return { title, boardUrl: null };
  }
  const hit = findProjectBoard(boards, board);
  const title =
    mode === "search" && query
      ? `${hit?.memberLabel ?? board} · “${query}”`
      : `${hit?.memberLabel ?? board} — ${hit?.title ?? "board"}`;
  return { title, boardUrl: hit?.boardUrl ?? null };
}

export async function renderYdmProjectsPage(
  interaction:
    | CommandInteraction
    | MessageComponentInteraction,
  state: YdmProjectsPageState,
  editOpts?: { fromDeferUpdate?: boolean },
): Promise<void> {
  const includeDone = state.d === 1;
  const inProgressOnly = state.i === 1;
  const { boards, items } = await getFilteredYdmProjectItems({
    board: state.b,
    includeDone,
    inProgressOnly,
    query: state.m === "search" ? state.q : undefined,
  });

  const totalPages = ydmProjectsPageCount(items.length);
  const pageIndex = clampYdmProjectsPageIndex(state.p, totalPages);
  const pageState = { ...state, p: pageIndex };

  const { title, boardUrl } = boardHeader(
    state.b,
    boards,
    state.m,
    state.q,
  );

  if (items.length === 0) {
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
      buildYdmProjectsPageComponents(empty, [], pageState, boardUrl),
    );
    if (editOpts?.fromDeferUpdate && interaction.isMessageComponent()) {
      await interaction.editReply(payload as InteractionEditReplyOptions);
    } else {
      await interaction.editReply(payload as InteractionEditReplyOptions);
    }
    return;
  }

  const header = `# ${title}`;
  const components = buildYdmProjectsPageComponents(
    header,
    items,
    pageState,
    boardUrl,
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
