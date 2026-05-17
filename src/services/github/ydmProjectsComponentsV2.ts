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
  MessageFlags,
  type MessageCreateOptions,
  type MessageEditOptions,
} from "discord.js";
import { YDM_PROJECTS_PICK_BOARD_PREFIX } from "../../utility/discord/discordInteractionIds.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";
import {
  computeYdmBoardCompareRows,
  encodeYdmIssueSelectValue,
  formatYdmBoardCompareMarkdown,
  pickYdmIssueSelectOptions,
} from "./ydmProjectsBoardCompare.js";
import type { YdmProjectBoard } from "./yellowDogManProjects.js";
import {
  formatProjectItemLine,
  formatYdmItemNumberLabel,
  type YdmProjectItem,
} from "./yellowDogManProjects.js";
import {
  encodeYdmProjectItemId,
  encodeYdmProjectsPageId,
  YDM_PROJECTS_PAGE_SIZE,
  ydmProjectsHasMorePages,
  ydmProjectsHasPreviousPage,
  ydmProjectsPageCount,
  type YdmProjectsPageState,
} from "./ydmProjectsPages.js";

/** Combined issue picker on the board overview (one select menu for all boards). */
export const YDM_ISSUE_PICKER_SELECT_KEY = "picker";

export function encodeYdmIssuePickerSelectMenuId(listOpts: {
  done?: boolean;
  inProgress?: boolean;
}): string {
  const d = listOpts.done ? "1" : "0";
  const i = listOpts.inProgress ? "1" : "0";
  return `ydm_projects_sel:${YDM_ISSUE_PICKER_SELECT_KEY}:${d}:${i}`;
}

export function parseYdmIssuePickerSelectMenuId(customId: string): {
  includeDone: boolean;
  inProgressOnly: boolean;
} | null {
  const m = customId.match(/^ydm_projects_sel:picker:([01]):([01])$/);
  if (!m) {
    return null;
  }
  return {
    includeDone: m[1] === "1",
    inProgressOnly: m[2] === "1",
  };
}

function buildYdmBoardBrowseRows(
  boards: readonly YdmProjectBoard[],
  listOpts?: { done?: boolean; inProgress?: boolean },
): ActionRowBuilder<ButtonBuilder>[] {
  const d = listOpts?.done ? "1" : "0";
  const i = listOpts?.inProgress ? "1" : "0";
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let offset = 0; offset < boards.length; offset += 5) {
    const slice = boards.slice(offset, offset + 5);
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const board of slice) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${YDM_PROJECTS_PICK_BOARD_PREFIX}${board.key}:${d}:${i}`)
          .setLabel(truncateEllipsis(`Browse ${board.memberLabel}`, 80))
          .setStyle(ButtonStyle.Secondary),
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildIssuePickerSelectRow(
  boards: readonly YdmProjectBoard[],
  allItems: readonly YdmProjectItem[],
  listOpts?: { done?: boolean; inProgress?: boolean },
): ActionRowBuilder<StringSelectMenuBuilder> {
  const opts = {
    includeDone: listOpts?.done === true,
    inProgressOnly: listOpts?.inProgress === true,
  };
  const picked = pickYdmIssueSelectOptions(boards, allItems, opts);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(encodeYdmIssuePickerSelectMenuId(listOpts ?? {}))
    .setPlaceholder("Quick view an issue…")
    .setMinValues(1)
    .setMaxValues(1);

  if (picked.length === 0) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("No matching items")
        .setValue("_none")
        .setDescription("Try done: true or browse a board"),
    );
    menu.setDisabled(true);
  } else {
    for (const entry of picked) {
      const descParts = [entry.item.status, entry.item.repo]
        .filter(Boolean)
        .join(" · ");
      menu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(
            truncateEllipsis(
              `[${entry.item.memberLabel}] ${formatYdmItemNumberLabel(entry.item)} ${entry.item.title}`,
              100,
            ),
          )
          .setValue(
            encodeYdmIssueSelectValue(
              entry.boardKey,
              entry.number,
              entry.repo,
            ),
          )
          .setDescription(
            truncateEllipsis(descParts || entry.item.projectTitle, 100),
          ),
      );
    }
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function buildYdmBoardPickerComponents(
  boards: readonly YdmProjectBoard[],
  allItems: readonly YdmProjectItem[],
  listOpts?: { done?: boolean; inProgress?: boolean },
): ContainerBuilder[] {
  const opts = {
    includeDone: listOpts?.done === true,
    inProgressOnly: listOpts?.inProgress === true,
  };
  const compareRows = computeYdmBoardCompareRows(boards, allItems, opts);
  const markdown = formatYdmBoardCompareMarkdown(compareRows, opts);

  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(truncateEllipsis(markdown, 4000)),
  );
  container.addActionRowComponents(
    buildIssuePickerSelectRow(boards, allItems, listOpts),
  );
  for (const browseRow of buildYdmBoardBrowseRows(boards, listOpts)) {
    container.addActionRowComponents(browseRow);
  }

  return [container];
}

function buildIssueViewButtons(
  slice: readonly YdmProjectItem[],
  pageState: YdmProjectsPageState,
): ButtonBuilder[] {
  const buttons: ButtonBuilder[] = [];
  for (const item of slice) {
    if (buttons.length >= 5 || item.number == null) {
      continue;
    }
    buttons.push(
      new ButtonBuilder()
        .setCustomId(
          encodeYdmProjectItemId({
            boardKey: item.projectKey,
            number: item.number,
            repo: item.repo,
            includeDone: pageState.d === 1,
            inProgressOnly: pageState.i === 1,
          }),
        )
        .setLabel(
          truncateEllipsis(
            `${formatYdmItemNumberLabel(item)} ${item.title}`,
            80,
          ),
        )
        .setStyle(ButtonStyle.Primary),
    );
  }
  return buttons;
}

function ydmProjectsNavLabelId(page: number, totalPages: number): string {
  return `ydmp_nav:${page}:${totalPages}`;
}

export function buildYdmProjectsErrorComponents(message: string): ContainerBuilder[] {
  return [
    new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(truncateEllipsis(message, 4000)),
    ),
  ];
}

export function buildYdmProjectsPageComponents(
  header: string,
  items: readonly YdmProjectItem[],
  pageState: YdmProjectsPageState,
  boardUrl: string | null,
): ContainerBuilder[] {
  const totalPages = ydmProjectsPageCount(items.length);
  const page = pageState.p;
  const start = page * YDM_PROJECTS_PAGE_SIZE;
  const slice = items.slice(start, start + YDM_PROJECTS_PAGE_SIZE);

  const bodyLines: string[] = [
    header,
    "",
    "_Use the buttons below to view an issue in an embed._",
    "",
  ];
  if (slice.length === 0) {
    bodyLines.push("_No items on this page._");
  } else {
    for (const row of slice) {
      bodyLines.push(formatProjectItemLine(row));
    }
  }
  if (totalPages > 0) {
    bodyLines.push("", `Page **${page + 1}** / **${totalPages}** · ${items.length} item(s)`);
  }

  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(truncateEllipsis(bodyLines.join("\n"), 4000)),
  );

  if (totalPages > 0) {
    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          encodeYdmProjectsPageId({ ...pageState, p: Math.max(0, page - 1) }),
        )
        .setLabel("<")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!ydmProjectsHasPreviousPage(page)),
      new ButtonBuilder()
        .setCustomId(ydmProjectsNavLabelId(page, totalPages))
        .setLabel(`${page + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(
          encodeYdmProjectsPageId({
            ...pageState,
            p: page + 1,
          }),
        )
        .setLabel(">")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!ydmProjectsHasMorePages(items, page)),
    );
    container.addActionRowComponents(navRow);
  }

  const viewButtons = buildIssueViewButtons(slice, pageState);
  if (viewButtons.length > 0) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...viewButtons),
    );
  }

  if (boardUrl?.startsWith("http")) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("Project board on GitHub")
          .setURL(boardUrl),
      ),
    );
  }

  return [container];
}

export function ydmProjectsMessagePayload(
  components: ContainerBuilder[],
): MessageCreateOptions & MessageEditOptions {
  return {
    embeds: [],
    components,
    flags: MessageFlags.IsComponentsV2,
  };
}
