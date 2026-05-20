import { ButtonComponent, Discord, SelectMenuComponent, SlashGroup } from "discordx";
import {
  ButtonInteraction,
  MessageFlags,
  StringSelectMenuInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
} from "discord.js";
import { isGitHubConfigured } from "../../../config/github.js";
import { GitHubApiError } from "../../../services/github/githubGraphql.js";
import { parseYdmIssueSelectValue } from "../../../services/github/ydmProjectsBoardCompare.js";
import {
  buildYdmBoardPickerComponents,
  buildYdmProjectsErrorComponents,
  parseYdmIssuePickerSelectMenuId,
  ydmProjectsMessagePayload,
} from "../../../services/github/ydmProjectsComponentsV2.js";
import {
  getYdmProjectsCacheSnapshot,
  resolveYdmProjectItemByRef,
  resolveYdmProjectItemForBoardMenu,
} from "../../../services/github/ydmProjectsCache.js";
import { ydmProjectItemReplyPayload } from "../../../services/github/ydmProjectsItemComponentsV2.js";
import {
  missingGitHubTokenMessage,
  renderYdmProjectsPage,
} from "../../../services/github/ydmProjectsReply.js";
import {
  parseYdmProjectItemId,
  parseYdmProjectsBoardParam,
  parseYdmProjectsPageId,
  YDM_PROJECTS_STATUS_FILTER_ALL,
  type YdmProjectsPageState,
} from "../../../services/github/ydmProjectsPages.js";
import {
  YDM_PROJECTS_BOARD_SELECT_PATTERN,
  YDM_PROJECTS_ITEM_SELECT_PATTERN,
  YDM_PROJECTS_ITEM_SELECT_PREFIX,
  YDM_PROJECTS_ITEM_PATTERN,
  YDM_PROJECTS_PAGE_PATTERN,
  YDM_PROJECTS_PAGE_PREFIX,
  YDM_PROJECTS_PICK_BOARD_PATTERN,
  YDM_PROJECTS_STATUS_SELECT_PATTERN,
  YDM_PROJECTS_STATUS_SELECT_PREFIX,
} from "../../../utility/discord/discordInteractionIds.js";
import { slashCommandUserInstallScope } from "../../../config/discordSlashInstall.js";
import { loggers } from "../../../utility/logging/logger.js";
import { truncateEllipsis } from "../../../utility/text/truncate.js";

async function replyWithYdmItemEmbed(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  item: Awaited<ReturnType<typeof resolveYdmProjectItemByRef>>,
): Promise<void> {
  if (!item) {
    await interaction.reply({
      content: "That project item is no longer available. Refresh the board list.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const parentEphemeral =
    interaction.message?.flags.has(MessageFlags.Ephemeral) ?? true;
  await interaction.reply(
    ydmProjectItemReplyPayload(item, { ephemeral: parentEphemeral }),
  );
}

@Discord()
@SlashGroup({
  name: "resonite",
  description:
    "Resonite wiki, accounts, records, and team socials (public APIs + roster).",
  ...slashCommandUserInstallScope,
})
export class ResoniteProjectsHandlers {
  @SelectMenuComponent({ id: YDM_PROJECTS_BOARD_SELECT_PATTERN })
  async onBoardIssueSelect(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    if (!isGitHubConfigured()) {
      await interaction.reply({
        content: missingGitHubTokenMessage(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const parsed = parseYdmIssuePickerSelectMenuId(interaction.customId);
    if (!parsed) {
      return;
    }

    const value = interaction.values[0];
    if (!value || value === "_none") {
      await interaction.reply({
        content: "No item to show for that board.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const selected = parseYdmIssueSelectValue(value);
    if (!selected) {
      return;
    }

    try {
      const item = await resolveYdmProjectItemForBoardMenu(
        selected.boardKey,
        selected.number,
        selected.repo,
        {
          includeDone: parsed.includeDone,
          inProgressOnly: parsed.inProgressOnly,
        },
      );
      await replyWithYdmItemEmbed(interaction, item);
    } catch (err) {
      loggers.resonite.error("projects board select failed", err, {
        board: selected.boardKey,
        number: selected.number,
      });
      await interaction.reply({
        content: "Could not load that project item.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @ButtonComponent({ id: YDM_PROJECTS_ITEM_PATTERN })
  async onViewProjectItem(interaction: ButtonInteraction): Promise<void> {
    if (!isGitHubConfigured()) {
      await interaction.reply({
        content: missingGitHubTokenMessage(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const ref = parseYdmProjectItemId(interaction.customId);
    if (!ref) {
      return;
    }

    try {
      const item = await resolveYdmProjectItemByRef(ref);
      await replyWithYdmItemEmbed(interaction, item);
    } catch (err) {
      loggers.resonite.error("projects view item failed", err, { ref });
      await interaction.reply({
        content: "Could not load that project item.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @SelectMenuComponent({ id: YDM_PROJECTS_ITEM_SELECT_PATTERN })
  async onListIssueSelect(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    if (!isGitHubConfigured()) {
      await interaction.reply({
        content: missingGitHubTokenMessage(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const state = parseYdmProjectsPageId(
      `${YDM_PROJECTS_PAGE_PREFIX}${interaction.customId.slice(
        YDM_PROJECTS_ITEM_SELECT_PREFIX.length,
      )}`,
    );
    const selected = parseYdmIssueSelectValue(interaction.values[0] ?? "");
    if (!state || !selected) {
      return;
    }

    try {
      const item = await resolveYdmProjectItemByRef({
        boardKey: selected.boardKey,
        number: selected.number,
        repo: selected.repo,
        includeDone: state.d === 1,
        inProgressOnly: state.i === 1,
      });
      await replyWithYdmItemEmbed(interaction, item);
    } catch (err) {
      loggers.resonite.error("YDM board page item select failed", err, {
        state,
        selected,
      });
      await interaction.reply({
        content: "Could not load that project item.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @SelectMenuComponent({ id: YDM_PROJECTS_STATUS_SELECT_PATTERN })
  async onListStatusFilterSelect(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    if (!isGitHubConfigured()) {
      await interaction.reply({
        content: missingGitHubTokenMessage(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const state = parseYdmProjectsPageId(
      `${YDM_PROJECTS_PAGE_PREFIX}${interaction.customId.slice(
        YDM_PROJECTS_STATUS_SELECT_PREFIX.length,
      )}`,
    );
    if (!state) {
      return;
    }

    const selectedValue = interaction.values[0] ?? "";

    await interaction.deferUpdate();
    try {
      let nextState: YdmProjectsPageState;
      if (!selectedValue || selectedValue === YDM_PROJECTS_STATUS_FILTER_ALL) {
        const { statusFilter: _omit, ...withoutStatus } = state;
        nextState = { ...withoutStatus, p: 0 };
      } else {
        nextState = { ...state, p: 0, statusFilter: selectedValue };
      }
      await renderYdmProjectsPage(interaction, nextState);
    } catch (err) {
      loggers.resonite.error("projects status filter failed", err, { state });
      await interaction.editReply(
        ydmProjectsMessagePayload(
          buildYdmProjectsErrorComponents(
            "Could not apply this Status filter. Try again later.",
          ),
        ) as InteractionEditReplyOptions,
      );
    }
  }

  @ButtonComponent({ id: YDM_PROJECTS_PICK_BOARD_PATTERN })
  async onPickBoard(interaction: ButtonInteraction): Promise<void> {
    if (!isGitHubConfigured()) {
      await interaction.reply({
        content: missingGitHubTokenMessage(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const parts = interaction.customId.split(":");
    const board = parseYdmProjectsBoardParam(parts[1]);
    if (!board || board === "all") {
      return;
    }
    const includeDone = parts[2] === "1";
    const inProgressOnly = parts[3] === "1";

    await interaction.deferUpdate();

    const state: YdmProjectsPageState = {
      v: 1,
      m: "list",
      b: board,
      p: 0,
      ...(includeDone ? { d: 1 } : {}),
      ...(inProgressOnly ? { i: 1 } : {}),
    };

    try {
      await renderYdmProjectsPage(interaction, state);
    } catch (err) {
      loggers.resonite.error("projects pick board failed", err, { board });
      await interaction.editReply(
        ydmProjectsMessagePayload(
          buildYdmProjectsErrorComponents(
            truncateEllipsis(
              err instanceof GitHubApiError
                ? "Could not load that GitHub project board."
                : "Could not load the project board. Try again later.",
              300,
            ),
          ),
        ) as InteractionEditReplyOptions,
      );
    }
  }

  @ButtonComponent({ id: YDM_PROJECTS_PAGE_PATTERN })
  async onProjectsPage(interaction: ButtonInteraction): Promise<void> {
    if (!isGitHubConfigured()) {
      await interaction.reply({
        content: missingGitHubTokenMessage(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const state = parseYdmProjectsPageId(interaction.customId);
    if (!state) {
      return;
    }

    await interaction.deferUpdate();

    try {
      await renderYdmProjectsPage(interaction, state);
    } catch (err) {
      loggers.resonite.error("projects page failed", err, { state });
      await interaction.editReply(
        ydmProjectsMessagePayload(
          buildYdmProjectsErrorComponents(
            "Could not load this project page. Try again later.",
          ),
        ) as InteractionEditReplyOptions,
      );
    }
  }
}

export async function replyWithYdmBoardPicker(
  interaction: ButtonInteraction | import("discord.js").CommandInteraction,
  listOpts?: { done?: boolean; inProgress?: boolean },
): Promise<void> {
  const { boards, items } = await getYdmProjectsCacheSnapshot();
  const components = buildYdmBoardPickerComponents(boards, items, listOpts);
  const payload = ydmProjectsMessagePayload(components);
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload as InteractionEditReplyOptions);
  } else {
    await interaction.reply(payload as InteractionReplyOptions);
  }
}
