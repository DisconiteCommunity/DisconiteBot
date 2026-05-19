import { githubGraphql } from "./githubGraphql.js";

export const YDM_ORG_LOGIN = "Yellow-Dog-Man";

/** Org project numbers linked from team showcase URLs (titles resolved via API). */
export const YDM_PROJECT_BOARDS = [
  {
    key: "froox",
    number: 47,
    memberLabel: "Frooxius",
    boardUrl: `https://github.com/orgs/${YDM_ORG_LOGIN}/projects/47`,
  },
  {
    key: "prime",
    number: 17,
    memberLabel: "ProbablePrime",
    boardUrl: `https://github.com/orgs/${YDM_ORG_LOGIN}/projects/17`,
  },
  {
    key: "j4",
    number: 18,
    memberLabel: "J4",
    boardUrl: `https://github.com/orgs/${YDM_ORG_LOGIN}/projects/18`,
  },
  {
    key: "gawdl3y",
    number: 45,
    memberLabel: "Gawdl3y",
    boardUrl: `https://github.com/orgs/${YDM_ORG_LOGIN}/projects/45`,
  },
  {
    key: "community",
    number: 30,
    memberLabel: "Community Help",
    boardUrl: `https://github.com/orgs/${YDM_ORG_LOGIN}/projects/30`,
  },
] as const;

export type YdmProjectKey = (typeof YDM_PROJECT_BOARDS)[number]["key"];

export const YDM_PROJECT_BOARD_KEYS: readonly YdmProjectKey[] =
  YDM_PROJECT_BOARDS.map((b) => b.key);

/** For Discord `custom_id` regex alternation (`froox|prime|…`). */
export const YDM_BOARD_KEY_PATTERN_SOURCE =
  YDM_PROJECT_BOARD_KEYS.join("|");

export function isYdmProjectKey(key: string): key is YdmProjectKey {
  return (YDM_PROJECT_BOARD_KEYS as readonly string[]).includes(key);
}

export function parseYdmProjectBoardKey(
  raw: string | null | undefined,
): YdmProjectKey | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (isYdmProjectKey(v)) {
    return v;
  }
  const hit = YDM_PROJECT_BOARDS.find(
    (b) =>
      b.memberLabel.toLowerCase() === v ||
      b.memberLabel.toLowerCase().replace(/\s/g, "") === v,
  );
  return hit?.key ?? null;
}

/** Human-facing board name: GitHub project title when known, else configured label. */
export function ydmBoardDisplayName(
  board: Pick<YdmProjectBoard, "title" | "memberLabel">,
): string {
  const placeholder = `${board.memberLabel} board`;
  const t = board.title?.trim();
  if (t && t !== placeholder) {
    return t;
  }
  return board.memberLabel;
}

/**
 * Resolve board key from user input using static aliases plus cached GitHub project titles.
 */
export function parseYdmProjectBoardKeyWithBoards(
  boards: readonly YdmProjectBoard[],
  raw: string | null | undefined,
): YdmProjectKey | null {
  const fromStatic = parseYdmProjectBoardKey(raw);
  if (fromStatic) {
    return fromStatic;
  }
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) {
    return null;
  }
  const exact = boards.filter(
    (b) =>
      ydmBoardDisplayName(b).toLowerCase() === v ||
      (b.title?.trim().toLowerCase() ?? "") === v,
  );
  if (exact.length === 1) {
    const only = exact[0];
    if (only) {
      return only.key;
    }
  }
  const partial = boards.filter((b) =>
    ydmBoardDisplayName(b).toLowerCase().includes(v),
  );
  if (partial.length === 1) {
    const only = partial[0];
    if (only) {
      return only.key;
    }
  }
  return null;
}

export type YdmProjectBoard = (typeof YDM_PROJECT_BOARDS)[number] & {
  readonly title: string;
};

export type YdmProjectItem = {
  readonly projectKey: YdmProjectKey;
  readonly projectTitle: string;
  readonly memberLabel: string;
  readonly title: string;
  /** GitHub issue/PR number when content is linked; null for draft-only items. */
  readonly number: number | null;
  readonly url: string | null;
  readonly status: string | null;
  readonly state: string | null;
  readonly repo: string | null;
  readonly body: string | null;
};

const PROJECT_ITEMS_QUERY = `
query($org: String!, $number: Int!, $cursor: String) {
  organization(login: $org) {
    projectV2(number: $number) {
      title
      url
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          fieldValues(first: 24) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
          content {
            __typename
            ... on Issue {
              number
              title
              url
              state
              body
              repository { nameWithOwner }
            }
            ... on PullRequest {
              number
              title
              url
              state
              body
              repository { nameWithOwner }
            }
            ... on DraftIssue {
              title
              body
            }
          }
        }
      }
    }
  }
}
`;

type FieldValueNode = {
  name?: string | null;
  text?: string | null;
  field?: { name?: string | null } | null;
};

type ContentNode = {
  __typename?: string;
  number?: number | null;
  title?: string | null;
  url?: string | null;
  state?: string | null;
  body?: string | null;
  repository?: { nameWithOwner?: string | null } | null;
};

export function issueNumberFromGitHubUrl(url: string | null): number | null {
  if (!url) {
    return null;
  }
  const m = url.match(/\/(?:issues|pull)\/(\d+)(?:[/?#]|$)/);
  if (!m) {
    return null;
  }
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatYdmItemNumberLabel(item: YdmProjectItem): string {
  if (item.number != null) {
    return `#${item.number}`;
  }
  return "Draft";
}

export function findYdmProjectItem(
  items: readonly YdmProjectItem[],
  boardKey: YdmProjectKey,
  number: number,
  repo: string | null,
): YdmProjectItem | null {
  const onBoard = items.filter(
    (i) => i.projectKey === boardKey && i.number === number,
  );
  if (onBoard.length === 0) {
    return null;
  }
  if (repo) {
    return onBoard.find((i) => i.repo === repo) ?? onBoard[0] ?? null;
  }
  return onBoard[0] ?? null;
}

type ItemNode = {
  fieldValues?: { nodes?: (FieldValueNode | null)[] | null } | null;
  content?: ContentNode | null;
};

type ProjectItemsPage = {
  organization?: {
    projectV2?: {
      title?: string | null;
      url?: string | null;
      items?: {
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
        nodes?: (ItemNode | null)[] | null;
      } | null;
    } | null;
  } | null;
};

function pickFieldValue(
  nodes: readonly (FieldValueNode | null)[] | null | undefined,
  fieldName: string,
): string | null {
  if (!nodes) {
    return null;
  }
  const want = fieldName.toLowerCase();
  for (const node of nodes) {
    if (!node?.field?.name) {
      continue;
    }
    if (node.field.name.toLowerCase() !== want) {
      continue;
    }
    if (typeof node.name === "string" && node.name.trim()) {
      return node.name.trim();
    }
    if (typeof node.text === "string" && node.text.trim()) {
      return node.text.trim();
    }
  }
  return null;
}

function parseItemNode(
  node: ItemNode,
  board: YdmProjectBoard,
): YdmProjectItem | null {
  const content = node.content;
  if (!content?.title?.trim()) {
    return null;
  }
  const fieldNodes = node.fieldValues?.nodes ?? [];
  const status =
    pickFieldValue(fieldNodes, "Status") ??
    pickFieldValue(fieldNodes, "State") ??
    null;

  const url = content.url ?? null;
  const number =
    typeof content.number === "number" && content.number > 0
      ? content.number
      : issueNumberFromGitHubUrl(url);

  return {
    projectKey: board.key,
    projectTitle: board.title,
    /** Same as project title so UI matches GitHub (static memberLabel is only a fallback key hint). */
    memberLabel: board.title,
    title: content.title.trim(),
    number,
    url,
    status,
    state: content.state ?? null,
    repo: content.repository?.nameWithOwner ?? null,
    body: content.body?.trim() ? content.body.trim() : null,
  };
}

export async function fetchProjectBoardMeta(
  number: number,
): Promise<{ title: string; url: string } | null> {
  const data = await githubGraphql<ProjectItemsPage>(PROJECT_ITEMS_QUERY, {
    org: YDM_ORG_LOGIN,
    number,
    cursor: null,
  });
  const project = data.organization?.projectV2;
  if (!project?.title) {
    return null;
  }
  return {
    title: project.title,
    url: project.url ?? `https://github.com/orgs/${YDM_ORG_LOGIN}/projects/${number}`,
  };
}

async function fetchAllProjectItemsForNumber(
  number: number,
  board: YdmProjectBoard,
): Promise<YdmProjectItem[]> {
  const items: YdmProjectItem[] = [];
  let cursor: string | null = null;
  let title = board.title;

  for (let page = 0; page < 20; page++) {
    const data: ProjectItemsPage = await githubGraphql<ProjectItemsPage>(
      PROJECT_ITEMS_QUERY,
      {
        org: YDM_ORG_LOGIN,
        number,
        cursor,
      },
    );
    const project = data.organization?.projectV2;
    if (project?.title) {
      title = project.title;
    }
    const connection = project?.items;
    for (const node of connection?.nodes ?? []) {
      if (!node) {
        continue;
      }
      const parsed = parseItemNode(node, { ...board, title });
      if (parsed) {
        items.push(parsed);
      }
    }
    const pageInfo = connection?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) {
      break;
    }
    cursor = pageInfo.endCursor;
  }

  return items;
}

export async function resolveYdmProjectBoards(): Promise<YdmProjectBoard[]> {
  return Promise.all(
    YDM_PROJECT_BOARDS.map(async (def) => {
      let title = `${def.memberLabel} board`;
      try {
        const meta = await fetchProjectBoardMeta(def.number);
        if (meta?.title) {
          title = meta.title;
        }
      } catch {
        /* keep fallback title */
      }
      return { ...def, title };
    }),
  );
}

/** Fetch all boards and items in parallel (used by the project cache). */
export async function fetchYdmProjectsBundle(): Promise<{
  boards: YdmProjectBoard[];
  items: YdmProjectItem[];
}> {
  const chunks = await Promise.all(
    YDM_PROJECT_BOARDS.map(async (def) => {
      const stub: YdmProjectBoard = {
        ...def,
        title: `${def.memberLabel} board`,
      };
      const items = await fetchAllProjectItemsForNumber(def.number, stub);
      let title = items[0]?.projectTitle ?? stub.title;
      if (!items.length) {
        try {
          const meta = await fetchProjectBoardMeta(def.number);
          if (meta?.title) {
            title = meta.title;
          }
        } catch {
          /* keep stub title */
        }
      }
      return {
        board: { ...def, title },
        items,
      };
    }),
  );
  return {
    boards: chunks.map((c) => c.board),
    items: chunks.flatMap((c) => c.items),
  };
}

export function findProjectBoard(
  boards: readonly YdmProjectBoard[],
  keyOrAlias: string,
): YdmProjectBoard | null {
  const q = keyOrAlias.trim().toLowerCase();
  if (!q || q === "all") {
    return null;
  }
  return (
    boards.find(
      (b) =>
        b.key === q ||
        b.memberLabel.toLowerCase() === q ||
        b.title.toLowerCase() === q ||
        ydmBoardDisplayName(b).toLowerCase() === q ||
        b.memberLabel.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q) ||
        ydmBoardDisplayName(b).toLowerCase().includes(q),
    ) ?? null
  );
}

const IN_PROGRESS_STATUS = new Set(
  [
    "in progress",
    "in-progress",
    "doing",
    "active",
    "started",
    "wip",
  ].map((s) => s.toLowerCase()),
);

const DONE_STATUS = new Set(
  [
    "done",
    "completed",
    "complete",
    "closed",
    "cancelled",
    "canceled",
    "won't fix",
    "wont fix",
    "duplicate",
  ].map((s) => s.toLowerCase()),
);

export function isDoneItem(item: YdmProjectItem): boolean {
  if (item.state?.toUpperCase() === "CLOSED") {
    return true;
  }
  if (item.status && DONE_STATUS.has(item.status.toLowerCase())) {
    return true;
  }
  return false;
}

export function isInProgressItem(item: YdmProjectItem): boolean {
  if (item.state?.toUpperCase() === "OPEN" && item.status) {
    return IN_PROGRESS_STATUS.has(item.status.toLowerCase());
  }
  if (item.status && IN_PROGRESS_STATUS.has(item.status.toLowerCase())) {
    return true;
  }
  return false;
}

export async function fetchAllYdmProjectItems(
  boards?: readonly YdmProjectBoard[],
): Promise<YdmProjectItem[]> {
  if (!boards) {
    return (await fetchYdmProjectsBundle()).items;
  }
  const chunks = await Promise.all(
    boards.map((board) => fetchAllProjectItemsForNumber(board.number, board)),
  );
  return chunks.flat();
}

export function searchYdmProjectItems(
  items: readonly YdmProjectItem[],
  query: string,
): YdmProjectItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...items];
  }
  return items.filter((item) => {
    const hay = [
      item.title,
      item.body ?? "",
      item.status ?? "",
      item.repo ?? "",
      item.memberLabel,
      item.projectTitle,
    ]
      .join("\n")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function filterYdmProjectItems(
  items: readonly YdmProjectItem[],
  opts: {
    projectKey?: YdmProjectKey | null;
    inProgressOnly?: boolean;
    /** When false (default), hides done/closed items unless `doneOnly` is set. */
    includeDone?: boolean;
    doneOnly?: boolean;
  },
): YdmProjectItem[] {
  let out = [...items];
  if (opts.projectKey) {
    out = out.filter((i) => i.projectKey === opts.projectKey);
  }
  if (opts.doneOnly) {
    out = out.filter(isDoneItem);
  } else if (opts.includeDone !== true) {
    out = out.filter((i) => !isDoneItem(i));
  }
  if (opts.inProgressOnly) {
    out = out.filter(isInProgressItem);
  }
  return out;
}

/** Stable sort for paginated UI (in-progress first, then title). */
export function sortYdmProjectItemsForDisplay(
  items: readonly YdmProjectItem[],
): YdmProjectItem[] {
  return [...items].sort((a, b) => {
    const aProg = isInProgressItem(a) ? 0 : 1;
    const bProg = isInProgressItem(b) ? 0 : 1;
    if (aProg !== bProg) {
      return aProg - bProg;
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}

export function formatProjectItemLine(item: YdmProjectItem): string {
  const statusBit = item.status ? ` · ${item.status}` : "";
  const repoBit = item.repo ? ` (${item.repo})` : "";
  const link = item.url ? `[${item.title}](${item.url})` : item.title;
  const prefix =
    item.number != null
      ? `**${formatYdmItemNumberLabel(item)}**`
      : "**Draft**";
  return `${prefix} ${link}${repoBit}${statusBit}`;
}
