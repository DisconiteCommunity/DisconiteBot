import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from "@discordjs/builders";
import {
  ButtonStyle,
  type CommandInteraction,
  type InteractionEditReplyOptions,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import {
  YDM_ISSUES_SEARCH_DASHBOARD_PREFIX,
  YDM_ISSUES_SEARCH_RESET_BUTTON_ID,
} from "../../utility/discord/discordInteractionIds.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";
import {
  fetchYdmIssueRepoLabels,
  isYdmIssuesRepo,
  labelWindow,
  YDM_ISSUES_DEFAULT_REPO,
  YDM_ISSUES_REPOS,
  type YdmIssuesRepo,
} from "./resoniteIssuesRepoSearch.js";
import { getYdmProjectsCacheSnapshot } from "./ydmProjectsCache.js";
import { ydmProjectsMessagePayload } from "./ydmProjectsComponentsV2.js";
import {
  filterYdmProjectItems,
  YDM_PROJECT_BOARD_KEYS,
  ydmBoardDisplayName,
  type YdmProjectKey,
} from "./yellowDogManProjects.js";

export const YDM_ISSUES_QUERY_MODAL_ID = "ydm_issues_query_modal";
export const YDM_ISSUES_AUTHOR_MODAL_ID = "ydm_issues_author_modal";
export const YDM_ISSUES_MODAL_INPUT_ID = "value";

export type YdmIssuesSearchScope = "boards" | "repo";

export type YdmIssuesSearchState = {
  readonly v: 1;
  readonly scope: YdmIssuesSearchScope;
  readonly board?: YdmProjectKey | "all";
  readonly repo?: YdmIssuesRepo;
  readonly query?: string;
  readonly author?: string;
  readonly labels?: readonly string[];
  readonly labelPage?: number;
};

export type YdmIssuesSearchAction =
  | "run"
  | "scope"
  | "query"
  | "author"
  | "board"
  | "clear_board"
  | "repo"
  | "clear_labels"
  | "label_page_prev"
  | "label_page_next"
  | "labels";

export type ParsedYdmIssuesDashboardId = {
  readonly action: YdmIssuesSearchAction;
  readonly state: YdmIssuesSearchState;
};

const ACTIONS = new Set<YdmIssuesSearchAction>([
  "run",
  "scope",
  "query",
  "author",
  "board",
  "clear_board",
  "repo",
  "clear_labels",
  "label_page_prev",
  "label_page_next",
  "labels",
]);

function encodeUtf8ToBase64Url(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

function decodeBase64UrlToUtf8(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString("utf8");
}

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 36) : undefined;
}

function cleanLabel(value: string): string {
  return value.trim().slice(0, 40);
}

export function defaultYdmIssuesSearchState(): YdmIssuesSearchState {
  return {
    v: 1,
    scope: "boards",
    board: "all",
    repo: YDM_ISSUES_DEFAULT_REPO,
    labelPage: 0,
  };
}

type DashboardWireFit = {
  readonly maxQuery: number;
  readonly maxAuthor: number;
  readonly maxLabelLen: number;
  readonly maxLabels: number;
};

const DEFAULT_DASHBOARD_WIRE_FIT: DashboardWireFit = {
  maxQuery: 36,
  maxAuthor: 36,
  maxLabelLen: 40,
  maxLabels: 3,
};

/** Short JSON keys keep `custom_id` under Discord’s length limit; values mirror {@link YdmIssuesSearchState}. */
function buildDashboardWireRecord(
  state: YdmIssuesSearchState,
  fit: DashboardWireFit = DEFAULT_DASHBOARD_WIRE_FIT,
): Record<string, unknown> {
  const repoIndex = Math.max(0, YDM_ISSUES_REPOS.indexOf(state.repo ?? YDM_ISSUES_DEFAULT_REPO));
  const qRaw = state.query?.trim();
  const q =
    qRaw && fit.maxQuery > 0 ? qRaw.slice(0, Math.min(fit.maxQuery, 36)) : undefined;
  const aRaw = state.author?.trim();
  const a =
    aRaw && fit.maxAuthor > 0 ? aRaw.slice(0, Math.min(fit.maxAuthor, 36)) : undefined;
  const labelSlice = state.labels?.slice(0, fit.maxLabels) ?? [];
  const labels =
    fit.maxLabels > 0 && fit.maxLabelLen > 0
      ? labelSlice
          .map((name) => name.trim().slice(0, Math.min(fit.maxLabelLen, 40)))
          .filter(Boolean)
      : [];

  return {
    v: 1,
    s: state.scope === "repo" ? "r" : "b",
    ...(state.board && state.board !== "all" ? { b: state.board } : {}),
    ri: repoIndex,
    ...(q ? { q } : {}),
    ...(a ? { a } : {}),
    ...(labels.length ? { l: labels } : {}),
    ...(state.labelPage ? { lp: Math.max(0, Math.floor(state.labelPage)) } : {}),
  };
}

function decodeRepoListIndexFromBase36(code: string): YdmIssuesRepo {
  const index = parseInt(code, 36);
  return YDM_ISSUES_REPOS[index] ?? YDM_ISSUES_DEFAULT_REPO;
}

function encodeRepoListIndexAsBase36(repo: YdmIssuesRepo | undefined): string {
  const index = YDM_ISSUES_REPOS.indexOf(repo ?? YDM_ISSUES_DEFAULT_REPO);
  return Math.max(0, index).toString(36);
}

/** Legacy compact wire: stays short for typical filters; superseded by JSON when over the Discord limit. */
function encodeCompactState(state: YdmIssuesSearchState): string {
  const wireFields = buildDashboardWireRecord(state);
  const joinedLabelNamesForWire = Array.isArray(wireFields.l)
    ? (wireFields.l as string[]).join("\u001f")
    : "";
  return [
    wireFields.s,
    typeof wireFields.b === "string" ? wireFields.b : "",
    encodeRepoListIndexAsBase36(state.repo),
    typeof wireFields.lp === "number" ? (wireFields.lp as number).toString(36) : "0",
    encodeUtf8ToBase64Url(typeof wireFields.q === "string" ? wireFields.q : ""),
    encodeUtf8ToBase64Url(typeof wireFields.a === "string" ? wireFields.a : ""),
    encodeUtf8ToBase64Url(joinedLabelNamesForWire),
  ].join(".");
}

export function encodeYdmIssuesSearchDashboardId(
  action: YdmIssuesSearchAction,
  state: YdmIssuesSearchState,
): string {
  const stateForAction =
    action === "label_page_prev" || action === "label_page_next"
      ? state
      : { ...state, labelPage: 0 };
  const prefix = `${YDM_ISSUES_SEARCH_DASHBOARD_PREFIX}${action}:`;
  const maxB64Length = 100 - prefix.length;

  const dotPayload = encodeCompactState(stateForAction);
  if (dotPayload.length <= maxB64Length) {
    return `${prefix}${dotPayload}`;
  }

  let fit: DashboardWireFit = { ...DEFAULT_DASHBOARD_WIRE_FIT };
  let guard = 0;
  while (guard < 80) {
    guard += 1;
    const wire = buildDashboardWireRecord(stateForAction, fit);
    const b64 = encodeUtf8ToBase64Url(JSON.stringify(wire));
    if (b64.length <= maxB64Length) {
      return `${prefix}${b64}`;
    }
    if (fit.maxLabelLen > 12) {
      fit = { ...fit, maxLabelLen: fit.maxLabelLen - 6 };
      continue;
    }
    if (fit.maxLabels > 0) {
      fit = { ...fit, maxLabels: fit.maxLabels - 1 };
      continue;
    }
    if (fit.maxQuery > 0) {
      fit = { ...fit, maxQuery: Math.max(0, fit.maxQuery - 8) };
      continue;
    }
    if (fit.maxAuthor > 0) {
      fit = { ...fit, maxAuthor: Math.max(0, fit.maxAuthor - 8) };
      continue;
    }
    const minimal = {
      v: 1,
      s: stateForAction.scope === "repo" ? "r" : "b",
      ...(stateForAction.board && stateForAction.board !== "all"
        ? { b: stateForAction.board }
        : {}),
      ri: Math.max(0, YDM_ISSUES_REPOS.indexOf(stateForAction.repo ?? YDM_ISSUES_DEFAULT_REPO)),
      ...(stateForAction.labelPage
        ? { lp: Math.max(0, Math.floor(stateForAction.labelPage)) }
        : {}),
    };
    return `${prefix}${encodeUtf8ToBase64Url(JSON.stringify(minimal))}`;
  }
  const minimal = {
    v: 1,
    s: "b" as const,
    ri: 0,
  };
  return `${prefix}${encodeUtf8ToBase64Url(JSON.stringify(minimal))}`;
}

export function parseYdmIssuesSearchDashboardId(
  customId: string,
): ParsedYdmIssuesDashboardId | null {
  if (!customId.startsWith(YDM_ISSUES_SEARCH_DASHBOARD_PREFIX)) {
    return null;
  }
  const idWithoutPrefix = customId.slice(YDM_ISSUES_SEARCH_DASHBOARD_PREFIX.length);
  const actionDelimiterIndex = idWithoutPrefix.indexOf(":");
  const action = idWithoutPrefix.slice(0, actionDelimiterIndex) as YdmIssuesSearchAction;
  if (actionDelimiterIndex < 1 || !ACTIONS.has(action)) {
    return null;
  }
  try {
    const payloadAfterAction = idWithoutPrefix.slice(actionDelimiterIndex + 1);
    const dotSeparatedSegments = payloadAfterAction.split(".");
    const decodedWireFields =
      dotSeparatedSegments.length === 7
        ? {
            v: 1,
            s: dotSeparatedSegments[0],
            b: dotSeparatedSegments[1] || undefined,
            r: decodeRepoListIndexFromBase36(dotSeparatedSegments[2] ?? "0"),
            lp: parseInt(dotSeparatedSegments[3] ?? "0", 36),
            q: decodeBase64UrlToUtf8(dotSeparatedSegments[4] ?? ""),
            a: decodeBase64UrlToUtf8(dotSeparatedSegments[5] ?? ""),
            l: decodeBase64UrlToUtf8(dotSeparatedSegments[6] ?? "")
              .split("\u001f")
              .filter(Boolean),
          }
        : (JSON.parse(decodeBase64UrlToUtf8(payloadAfterAction)) as {
            v?: number;
            s?: string;
            b?: string;
            r?: string;
            ri?: number;
            q?: string;
            a?: string;
            l?: string[];
            lp?: number;
          });
    if (
      decodedWireFields.v !== 1 ||
      (decodedWireFields.s !== "r" && decodedWireFields.s !== "b")
    ) {
      return null;
    }
    const resolvedBoardKey =
      decodedWireFields.b &&
      (YDM_PROJECT_BOARD_KEYS as readonly string[]).includes(decodedWireFields.b)
        ? (decodedWireFields.b as YdmProjectKey)
        : "all";
    const resolvedRepo =
      typeof decodedWireFields.ri === "number" &&
      decodedWireFields.ri >= 0 &&
      decodedWireFields.ri < YDM_ISSUES_REPOS.length
        ? YDM_ISSUES_REPOS[decodedWireFields.ri]
        : decodedWireFields.r && isYdmIssuesRepo(decodedWireFields.r)
          ? decodedWireFields.r
          : YDM_ISSUES_DEFAULT_REPO;
    return {
      action,
      state: {
        v: 1,
        scope: decodedWireFields.s === "r" ? "repo" : "boards",
        board: resolvedBoardKey,
        repo: resolvedRepo,
        ...(cleanText(decodedWireFields.q)
          ? { query: cleanText(decodedWireFields.q) }
          : {}),
        ...(cleanText(decodedWireFields.a)
          ? { author: cleanText(decodedWireFields.a) }
          : {}),
        ...(Array.isArray(decodedWireFields.l)
          ? {
              labels: decodedWireFields.l
                .map(cleanLabel)
                .filter(Boolean)
                .slice(0, 3),
            }
          : {}),
        labelPage: Number.isFinite(decodedWireFields.lp)
          ? Math.max(0, Math.floor(decodedWireFields.lp ?? 0))
          : 0,
      },
    };
  } catch {
    return null;
  }
}

export function ydmIssuesSearchStateWithQuery(
  state: YdmIssuesSearchState,
  query: string,
): YdmIssuesSearchState {
  return { ...state, query: cleanText(query), labelPage: 0 };
}

export function ydmIssuesSearchStateWithAuthor(
  state: YdmIssuesSearchState,
  author: string,
): YdmIssuesSearchState {
  return { ...state, author: cleanText(author), labelPage: 0 };
}

function actionButton(
  label: string,
  action: YdmIssuesSearchAction,
  state: YdmIssuesSearchState,
  style = ButtonStyle.Secondary,
): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(encodeYdmIssuesSearchDashboardId(action, state))
    .setLabel(label)
    .setStyle(style);
}

function buildBoardRows(
  state: YdmIssuesSearchState,
): ActionRowBuilder<ButtonBuilder>[] {
  const memberBoardKeys = [...YDM_PROJECT_BOARD_KEYS] as const;
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  const isAllBoardsSelected =
    state.scope === "boards" && (state.board ?? "all") === "all";
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      actionButton(
        "All boards",
        "board",
        { ...state, scope: "boards", board: "all", labelPage: 0 },
        isAllBoardsSelected ? ButtonStyle.Success : ButtonStyle.Secondary,
      ).setDisabled(isAllBoardsSelected),
      new ButtonBuilder()
        .setCustomId(YDM_ISSUES_SEARCH_RESET_BUTTON_ID)
        .setLabel("Reset search")
        .setStyle(ButtonStyle.Danger),
    ),
  );

  for (let offset = 0; offset < memberBoardKeys.length; offset += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const boardKey of memberBoardKeys.slice(offset, offset + 5)) {
      const isBoardSelected =
        state.scope === "boards" && (state.board ?? "all") === boardKey;
      row.addComponents(
        actionButton(
          boardKey,
          "board",
          { ...state, scope: "boards", board: boardKey, labelPage: 0 },
          isBoardSelected ? ButtonStyle.Success : ButtonStyle.Secondary,
        ).setDisabled(isBoardSelected),
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildRepoRow(state: YdmIssuesSearchState): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(encodeYdmIssuesSearchDashboardId("repo", state))
    .setPlaceholder("Repository")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      YDM_ISSUES_REPOS.map((repositoryFullName) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(repositoryFullName)
          .setValue(repositoryFullName)
          .setDefault((state.repo ?? YDM_ISSUES_DEFAULT_REPO) === repositoryFullName),
      ),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function buildLabelRows(
  state: YdmIssuesSearchState,
  allRepoLabelNames: readonly string[],
): (ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>)[] {
  const rows: (ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>)[] = [];
  const labelPageWindow = labelWindow(allRepoLabelNames, state.labelPage ?? 0);
  if (labelPageWindow.labels.length > 0) {
    const selectedLabelNames = new Set(state.labels ?? []);
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(encodeYdmIssuesSearchDashboardId("labels", state))
          .setPlaceholder("Labels")
          .setMinValues(0)
          .setMaxValues(Math.min(3, labelPageWindow.labels.length))
          .addOptions(
            labelPageWindow.labels.map((labelName) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(truncateEllipsis(labelName, 100))
                .setValue(labelName)
                .setDefault(selectedLabelNames.has(labelName)),
            ),
          ),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      actionButton("< labels", "label_page_prev", state).setDisabled(
        labelPageWindow.page <= 0,
      ),
      actionButton("Clear labels", "clear_labels", { ...state, labels: [] }),
      actionButton("> labels", "label_page_next", state).setDisabled(
        labelPageWindow.totalPages === 0 ||
          labelPageWindow.page + 1 >= labelPageWindow.totalPages,
      ),
    ),
  );
  return rows;
}

function dashboardMarkdown(
  state: YdmIssuesSearchState,
  stats: { boardItems: number; repoLabels: number },
): string {
  const scope = state.scope === "repo" ? "Repository issues" : "Project boards";
  const board = state.board === "all" || !state.board ? "all boards" : state.board;
  const selectedLabelsSummary = state.labels?.length
    ? state.labels.join(", ")
    : "none";
  const lines = ["# GitHub search", `Scope: **${scope}**`];

  if (state.scope === "boards") {
    lines.push(
      `Query: ${state.query ? `\`${state.query}\`` : "_not set_"}`,
      "",
      `Board: **${board}** · ${stats.boardItems} visible active item(s) on this slice`,
      "",
      "_Set a query (optional for listing), pick a board or all boards, then **Run**. Uses cached YDM project boards._",
    );
  } else {
    lines.push(
      `Query: ${state.query ? `\`${state.query}\`` : "_not set_"}`,
      `Author: ${state.author ? `\`${state.author}\`` : "_any_"}`,
      "",
      `Repository: **${state.repo ?? YDM_ISSUES_DEFAULT_REPO}** · ${stats.repoLabels} label(s) loaded`,
      `Labels: ${selectedLabelsSummary}`,
      "",
      "_Set filters, then **Run**. Searches GitHub issues in the selected repository._",
    );
  }

  return lines.join("\n");
}

export async function buildYdmIssuesSearchDashboardComponents(
  state: YdmIssuesSearchState,
): Promise<ContainerBuilder[]> {
  const { boards, items } = await getYdmProjectsCacheSnapshot();
  const displayState = { ...defaultYdmIssuesSearchState(), ...state };
  const visibleItems =
    displayState.scope === "boards"
      ? filterYdmProjectItems(items, {
          projectKey:
            displayState.board && displayState.board !== "all"
              ? displayState.board
              : null,
          includeDone: false,
        })
      : [];
  const repo = displayState.repo ?? YDM_ISSUES_DEFAULT_REPO;
  const repoLabelNames =
    displayState.scope === "repo" ? await fetchYdmIssueRepoLabels(repo) : [];
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      truncateEllipsis(
        dashboardMarkdown({ ...displayState, repo }, {
          boardItems: visibleItems.length,
          repoLabels: repoLabelNames.length,
        }),
        4000,
      ),
    ),
  );

  const topRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    actionButton("Set query", "query", displayState, ButtonStyle.Primary),
  );
  if (displayState.scope === "repo") {
    topRow.addComponents(actionButton("Set author", "author", displayState));
  }
  topRow.addComponents(
    actionButton(
      displayState.scope === "repo" ? "Use boards" : "Use repository",
      "scope",
      {
        ...displayState,
        scope: displayState.scope === "repo" ? "boards" : "repo",
      },
    ),
    actionButton("Run", "run", displayState, ButtonStyle.Success),
  );
  container.addActionRowComponents(topRow);

  if (displayState.scope === "boards") {
    for (const row of buildBoardRows(displayState)) {
      container.addActionRowComponents(row);
    }
    if (boards.length > 0) {
      const names = boards.map((board) => ydmBoardDisplayName(board)).join(", ");
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          truncateEllipsis(`Available boards: ${names}`, 4000),
        ),
      );
    }
  } else {
    container.addActionRowComponents(buildRepoRow(displayState));
    for (const row of buildLabelRows({ ...displayState, repo }, repoLabelNames)) {
      container.addActionRowComponents(row as ActionRowBuilder<ButtonBuilder>);
    }
  }
  return [container];
}

export async function renderYdmIssuesSearchDashboard(
  interaction:
    | CommandInteraction
    | MessageComponentInteraction
    | ModalSubmitInteraction,
  state: YdmIssuesSearchState = defaultYdmIssuesSearchState(),
): Promise<void> {
  const components = await buildYdmIssuesSearchDashboardComponents(state);
  await interaction.editReply(
    ydmProjectsMessagePayload(components) as InteractionEditReplyOptions,
  );
}
