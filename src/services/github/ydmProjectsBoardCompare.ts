import {
  filterYdmProjectItems,
  isDoneItem,
  isInProgressItem,
  isYdmProjectKey,
  sortYdmProjectItemsForDisplay,
  ydmBoardDisplayName,
  type YdmProjectBoard,
  type YdmProjectItem,
  type YdmProjectKey,
} from "./yellowDogManProjects.js";
import { YDM_PROJECTS_PAGE_SIZE } from "./ydmProjectsPages.js";

export type YdmBoardCompareRow = {
  board: YdmProjectBoard;
  visibleCount: number;
  inProgressCount: number;
  doneHidden: number;
};

export function computeYdmBoardCompareRows(
  boards: readonly YdmProjectBoard[],
  allItems: readonly YdmProjectItem[],
  opts: {
    includeDone?: boolean;
    inProgressOnly?: boolean;
  },
): YdmBoardCompareRow[] {
  return boards.map((board) => {
    const boardItems = allItems.filter((i) => i.projectKey === board.key);
    const visible = filterYdmProjectItems(boardItems, {
      includeDone: opts.includeDone,
      inProgressOnly: opts.inProgressOnly,
    });
    const doneHidden =
      opts.includeDone === true
        ? 0
        : boardItems.filter((i) => isDoneItem(i)).length;
    return {
      board,
      visibleCount: visible.length,
      inProgressCount: visible.filter(isInProgressItem).length,
      doneHidden,
    };
  });
}

export type YdmIssueSelectOption = {
  boardKey: YdmProjectKey;
  number: number;
  repo: string | null;
  item: YdmProjectItem;
};

/** Discord string selects allow at most 25 options per menu. */
export const YDM_ISSUE_PICKER_OPTION_LIMIT = YDM_PROJECTS_PAGE_SIZE;

export function encodeYdmIssueSelectValue(
  boardKey: YdmProjectKey,
  number: number,
  repo: string | null,
): string {
  if (repo) {
    return `${boardKey}|${repo}|${number}`;
  }
  return `${boardKey}|${number}`;
}

export function parseYdmIssueSelectValue(
  value: string,
): { boardKey: YdmProjectKey; number: number; repo: string | null } | null {
  const parts = value.split("|");
  if (parts.length === 2) {
    const boardKey = parts[0]!;
    if (!isYdmProjectKey(boardKey)) {
      return null;
    }
    const number = parseInt(parts[1]!, 10);
    if (!Number.isFinite(number) || number < 1) {
      return null;
    }
    return { boardKey, number, repo: null };
  }
  if (parts.length === 3) {
    const boardKey = parts[0]!;
    const repo = parts[1]!;
    if (!isYdmProjectKey(boardKey) || !repo) {
      return null;
    }
    const number = parseInt(parts[2]!, 10);
    if (!Number.isFinite(number) || number < 1) {
      return null;
    }
    return { boardKey, number, repo };
  }
  return null;
}

export function pickYdmIssueSelectOptions(
  boards: readonly YdmProjectBoard[],
  allItems: readonly YdmProjectItem[],
  opts: {
    includeDone?: boolean;
    inProgressOnly?: boolean;
  },
  limit = YDM_ISSUE_PICKER_OPTION_LIMIT,
): YdmIssueSelectOption[] {
  const perBoard = boards.map((board) => ({
    board,
    items: itemsForYdmBoardMenu(allItems, board.key, opts),
  }));
  const picked: YdmIssueSelectOption[] = [];
  for (let round = 0; picked.length < limit; round++) {
    let added = false;
    for (const { board, items } of perBoard) {
      const item = items[round];
      if (!item || item.number == null) {
        continue;
      }
      picked.push({
        boardKey: board.key,
        number: item.number,
        repo: item.repo,
        item,
      });
      added = true;
      if (picked.length >= limit) {
        break;
      }
    }
    if (!added) {
      break;
    }
  }
  return picked;
}

export function formatYdmBoardCompareMarkdown(
  rows: readonly YdmBoardCompareRow[],
  opts: { includeDone?: boolean; inProgressOnly?: boolean },
): string {
  const lines = [
    "# Team project boards",
    "Use the menu below to preview an issue (board name in each label), or **Browse** for the full paginated list.",
    "",
    ...rows.map(
      (r) =>
        `- **${ydmBoardDisplayName(r.board)}** — ${r.visibleCount} shown · ${r.inProgressCount} in progress`,
    ),
  ];
  if (opts.inProgressOnly) {
    lines.push("", "_Filtered to in-progress items only._");
  }
  if (!opts.includeDone) {
    lines.push("", "_Done / closed items are hidden. Use **`done: true`** on the command to include them._");
  } else {
    lines.push("", "_Including done / closed items._");
  }
  return lines.join("\n");
}

export function itemsForYdmBoardMenu(
  allItems: readonly YdmProjectItem[],
  boardKey: YdmProjectKey,
  opts: {
    includeDone?: boolean;
    inProgressOnly?: boolean;
  },
): YdmProjectItem[] {
  return sortYdmProjectItemsForDisplay(
    filterYdmProjectItems(
      allItems.filter((i) => i.projectKey === boardKey),
      {
        includeDone: opts.includeDone,
        inProgressOnly: opts.inProgressOnly,
      },
    ),
  );
}
