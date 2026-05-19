import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
} from "@discordjs/builders";
import { ButtonStyle } from "discord.js";
import { getGitHubToken } from "../../config/github.js";
import {
  YDM_ISSUES_REPO_RESULTS_PREFIX,
  YDM_ISSUES_SEARCH_RESET_BUTTON_ID,
} from "../../utility/discord/discordInteractionIds.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";
import { GitHubApiError, githubGraphql } from "./githubGraphql.js";

export const YDM_ISSUES_DEFAULT_REPO = "Yellow-Dog-Man/Resonite-Issues";

export const YDM_ISSUES_REPOS = [
  YDM_ISSUES_DEFAULT_REPO,
  "Yellow-Dog-Man/Resonite",
  "Yellow-Dog-Man/Locale",
] as const;

export const YDM_ISSUES_REPO_RESULT_PAGE_SIZE = 5;
/** Discord string selects allow at most 25 options; label paging uses prev/next controls. */
export const YDM_ISSUES_LABEL_PAGE_SIZE = 25;

export type YdmIssuesRepo = (typeof YDM_ISSUES_REPOS)[number];

export function isYdmIssuesRepo(repo: string): repo is YdmIssuesRepo {
  return (YDM_ISSUES_REPOS as readonly string[]).includes(repo);
}

export type YdmIssueRepoSearchInput = {
  readonly repo: YdmIssuesRepo;
  readonly query?: string;
  readonly author?: string;
  readonly labels?: readonly string[];
};

export type YdmIssueRepoResult = {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly state: string;
  readonly author: string | null;
  readonly labels: readonly string[];
  readonly repo: string;
  readonly updatedAt: string | null;
};

export type YdmIssueRepoResultsState = YdmIssueRepoSearchInput & {
  readonly v: 1;
  readonly p: number;
};

function encodeUtf8ToBase64Url(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

function decodeBase64UrlToUtf8(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

function cleanSearchTerm(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 48) : undefined;
}

function cleanLabel(value: string): string {
  return value.trim().slice(0, 40);
}

function quoteSearchValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildYdmIssuesRepoSearchQuery(
  input: YdmIssueRepoSearchInput,
): string {
  const parts = [`repo:${input.repo}`, "is:issue"];
  const query = cleanSearchTerm(input.query);
  const author = cleanSearchTerm(input.author);
  if (query) {
    parts.push(query);
  }
  if (author) {
    parts.push(`author:${author.replace(/\s/g, "")}`);
  }
  for (const label of input.labels ?? []) {
    const cleaned = cleanLabel(label);
    if (cleaned) {
      parts.push(`label:${quoteSearchValue(cleaned)}`);
    }
  }
  return parts.join(" ");
}

export function labelPageCount(labels: readonly string[]): number {
  return labels.length === 0
    ? 0
    : Math.ceil(labels.length / YDM_ISSUES_LABEL_PAGE_SIZE);
}

export function labelWindow(
  labels: readonly string[],
  page: number,
): { labels: string[]; page: number; totalPages: number } {
  const totalPages = labelPageCount(labels);
  const safePage =
    totalPages === 0 ? 0 : Math.min(Math.max(0, Math.floor(page)), totalPages - 1);
  const start = safePage * YDM_ISSUES_LABEL_PAGE_SIZE;
  return {
    labels: labels.slice(start, start + YDM_ISSUES_LABEL_PAGE_SIZE),
    page: safePage,
    totalPages,
  };
}

async function githubRestJson<T>(url: string): Promise<T> {
  const token = getGitHubToken();
  if (!token) {
    throw new GitHubApiError("GITHUB_TOKEN is not configured", 0);
  }
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "DisconiteBot/1.0 (Discord; GitHub Issues)",
    },
  });
  if (!res.ok) {
    throw new GitHubApiError(`GitHub API HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export async function fetchYdmIssueRepoLabels(
  repo: YdmIssuesRepo,
  cap = 200,
): Promise<string[]> {
  const [owner, name] = repo.split("/");
  const labels: string[] = [];
  for (let restApiPageNumber = 1; labels.length < cap; restApiPageNumber++) {
    const url =
      `https://api.github.com/repos/${owner}/${name}/labels` +
      `?per_page=100&page=${restApiPageNumber}`;
    const chunk = await githubRestJson<{ name?: string | null }[]>(url);
    for (const label of chunk) {
      if (label.name?.trim()) {
        labels.push(label.name.trim());
      }
      if (labels.length >= cap) {
        break;
      }
    }
    if (chunk.length < 100) {
      break;
    }
  }
  return labels.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

const ISSUES_SEARCH_QUERY = `
query($query: String!, $first: Int!) {
  search(query: $query, type: ISSUE, first: $first) {
    issueCount
    nodes {
      ... on Issue {
        number
        title
        url
        state
        updatedAt
        author { login }
        repository { nameWithOwner }
        labels(first: 8) { nodes { name } }
      }
    }
  }
}
`;

type IssuesSearchResponse = {
  search?: {
    issueCount?: number | null;
    nodes?: (
      | {
          number?: number | null;
          title?: string | null;
          url?: string | null;
          state?: string | null;
          updatedAt?: string | null;
          author?: { login?: string | null } | null;
          repository?: { nameWithOwner?: string | null } | null;
          labels?: { nodes?: ({ name?: string | null } | null)[] | null } | null;
        }
      | null
    )[] | null;
  } | null;
};

export async function searchYdmRepositoryIssues(
  input: YdmIssueRepoSearchInput,
  page: number,
): Promise<{ totalCount: number; items: YdmIssueRepoResult[]; page: number }> {
  const safePage = Math.max(0, Math.floor(page));
  const first = Math.min(50, (safePage + 1) * YDM_ISSUES_REPO_RESULT_PAGE_SIZE);
  const data = await githubGraphql<IssuesSearchResponse>(ISSUES_SEARCH_QUERY, {
    query: buildYdmIssuesRepoSearchQuery(input),
    first,
  });
  const graphqlIssueNodes = data.search?.nodes ?? [];
  const issuesInFetchedWindow = graphqlIssueNodes.flatMap((node): YdmIssueRepoResult[] => {
    if (!node?.number || !node.title || !node.url) {
      return [];
    }
    return [
      {
        number: node.number,
        title: node.title,
        url: node.url,
        state: node.state ?? "UNKNOWN",
        author: node.author?.login ?? null,
        repo: node.repository?.nameWithOwner ?? input.repo,
        labels:
          node.labels?.nodes
            ?.map((label) => label?.name?.trim())
            .filter((label): label is string => Boolean(label)) ?? [],
        updatedAt: node.updatedAt ?? null,
      },
    ];
  });
  const start = safePage * YDM_ISSUES_REPO_RESULT_PAGE_SIZE;
  return {
    totalCount: data.search?.issueCount ?? issuesInFetchedWindow.length,
    items: issuesInFetchedWindow.slice(start, start + YDM_ISSUES_REPO_RESULT_PAGE_SIZE),
    page: safePage,
  };
}

export function encodeYdmIssueRepoResultsPageId(
  state: YdmIssueRepoResultsState,
): string {
  /** Signed page index in the wire payload so e.g. `page - 1` on page 0 stays distinct from the current page in `custom_id`s. */
  const signedPageIndexForWire = Number.isFinite(state.p) ? Math.floor(state.p) : 0;
  const pageStateWirePayload = {
    v: 1,
    p: signedPageIndexForWire,
    r: state.repo,
    ...(cleanSearchTerm(state.query) ? { q: cleanSearchTerm(state.query) } : {}),
    ...(cleanSearchTerm(state.author) ? { a: cleanSearchTerm(state.author) } : {}),
    ...(state.labels?.length
      ? { l: state.labels.slice(0, 3).map(cleanLabel).filter(Boolean) }
      : {}),
  };
  return `${YDM_ISSUES_REPO_RESULTS_PREFIX}${encodeUtf8ToBase64Url(
    JSON.stringify(pageStateWirePayload),
  )}`;
}

export function parseYdmIssueRepoResultsPageId(
  customId: string,
): YdmIssueRepoResultsState | null {
  if (!customId.startsWith(YDM_ISSUES_REPO_RESULTS_PREFIX)) {
    return null;
  }
  try {
    const parsedWirePayload = JSON.parse(
      decodeBase64UrlToUtf8(customId.slice(YDM_ISSUES_REPO_RESULTS_PREFIX.length)),
    ) as {
      v?: number;
      p?: number;
      r?: string;
      q?: string;
      a?: string;
      l?: string[];
    };
    if (parsedWirePayload.v !== 1 || !parsedWirePayload.r || !isYdmIssuesRepo(parsedWirePayload.r)) {
      return null;
    }
    return {
      v: 1,
      p: Number.isFinite(parsedWirePayload.p)
        ? Math.max(0, Math.floor(parsedWirePayload.p ?? 0))
        : 0,
      repo: parsedWirePayload.r,
      ...(cleanSearchTerm(parsedWirePayload.q)
        ? { query: cleanSearchTerm(parsedWirePayload.q) }
        : {}),
      ...(cleanSearchTerm(parsedWirePayload.a)
        ? { author: cleanSearchTerm(parsedWirePayload.a) }
        : {}),
      ...(Array.isArray(parsedWirePayload.l)
        ? {
            labels: parsedWirePayload.l.map(cleanLabel).filter(Boolean).slice(0, 3),
          }
        : {}),
    };
  } catch {
    return null;
  }
}

function formatIssueLine(issue: YdmIssueRepoResult): string {
  const labels = issue.labels.length ? ` · ${issue.labels.join(", ")}` : "";
  const author = issue.author ? ` · @${issue.author}` : "";
  return `**#${issue.number}** [${issue.title}](${issue.url}) · ${issue.state}${author}${labels}`;
}

export function buildYdmIssueRepoResultsComponents(
  state: YdmIssueRepoResultsState,
  result: { totalCount: number; items: readonly YdmIssueRepoResult[]; page: number },
): ContainerBuilder[] {
  const totalPages =
    result.totalCount === 0
      ? 0
      : Math.ceil(result.totalCount / YDM_ISSUES_REPO_RESULT_PAGE_SIZE);
  const lines = [
    `# Repository issues: ${state.repo}`,
    `Query: \`${truncateEllipsis(buildYdmIssuesRepoSearchQuery(state), 180)}\``,
    "",
  ];
  if (result.items.length === 0) {
    lines.push("_No matching issues._");
  } else {
    for (const issue of result.items) {
      lines.push(formatIssueLine(issue));
    }
  }
  if (totalPages > 0) {
    lines.push(
      "",
      `Page **${result.page + 1}** / **${totalPages}** · ${result.totalCount} match(es)`,
    );
  }

  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(truncateEllipsis(lines.join("\n"), 4000)),
  );
  if (totalPages > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(encodeYdmIssueRepoResultsPageId({ ...state, p: result.page - 1 }))
          .setLabel("<")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(result.page <= 0),
        new ButtonBuilder()
          .setCustomId(encodeYdmIssueRepoResultsPageId({ ...state, p: result.page }))
          .setLabel(`${result.page + 1} / ${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(encodeYdmIssueRepoResultsPageId({ ...state, p: result.page + 1 }))
          .setLabel(">")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(result.page + 1 >= totalPages || result.page >= 9),
      ),
    );
  }
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(YDM_ISSUES_SEARCH_RESET_BUTTON_ID)
        .setLabel("Reset search")
        .setStyle(ButtonStyle.Secondary),
    ),
  );
  return [container];
}
