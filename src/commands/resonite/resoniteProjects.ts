import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  CommandInteraction,
} from "discord.js";
import { isGitHubConfigured } from "../../config/github.js";
import { GitHubApiError } from "../../services/github/githubGraphql.js";
import { getYdmProjectBoardsCached } from "../../services/github/ydmProjectsCache.js";
import {
  buildYdmProjectsErrorComponents,
  ydmProjectsMessagePayload,
} from "../../services/github/ydmProjectsComponentsV2.js";
import {
  missingGitHubTokenMessage,
  renderYdmProjectsPage,
} from "../../services/github/ydmProjectsReply.js";
import type { InteractionEditReplyOptions } from "discord.js";
import {
  type YdmProjectsPageState,
} from "../../services/github/ydmProjectsPages.js";
import {
  parseYdmProjectBoardKey,
  parseYdmProjectBoardKeyWithBoards,
  YDM_PROJECT_BOARD_KEYS,
  ydmBoardDisplayName,
  type YdmProjectKey,
} from "../../services/github/yellowDogManProjects.js";
import { loggers } from "../../utility/logging/logger.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";
import {
  slashDeferEphemeralFlags,
  slashEphemeralReplyFlags,
  slashVisibleOption,
} from "../../utility/discord/interactionVisibility.js";
import { slashCommandUserInstallScope } from "../../config/discordSlashInstall.js";
import { replyWithYdmBoardPicker } from "./resoniteProjectsHandlers.js";

async function boardAutocompleteChoices(): Promise<{ name: string; value: string }[]> {
  const boards = await getYdmProjectBoardsCached();
  return boards.map((b) => ({
    name: truncateEllipsis(ydmBoardDisplayName(b), 100),
    value: b.key,
  }));
}

function filterBoardChoices(
  choices: readonly { name: string; value: string }[],
  query: string,
): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  const pool = q
    ? choices.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q),
      )
    : [...choices];
  return pool.slice(0, 25);
}

async function projectsAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  if (!isGitHubConfigured()) {
    await interaction.respond([]);
    return;
  }

  const focused = interaction.options.getFocused(true);
  const query =
    typeof focused.value === "string" ? focused.value : String(focused.value);

  if (focused.name === "board") {
    try {
      const pool = await boardAutocompleteChoices();
      await interaction.respond(filterBoardChoices(pool, query));
    } catch (err) {
      loggers.resonite.warn("projects board autocomplete failed", err);
      await interaction.respond([]);
    }
    return;
  }
}

function formatBoardKeysHint(): string {
  return YDM_PROJECT_BOARD_KEYS.map((k) => `**${k}**`).join(", ");
}

async function parseListBoardInput(
  raw: string | undefined,
): Promise<YdmProjectKey | null> {
  const fromStatic = parseYdmProjectBoardKey(raw);
  if (fromStatic) {
    return fromStatic;
  }
  if (!raw?.trim()) {
    return null;
  }
  const boards = await getYdmProjectBoardsCached();
  return parseYdmProjectBoardKeyWithBoards(boards, raw);
}

@Discord()
@SlashGroup({
  name: "resonite",
  description:
    "Resonite wiki, accounts, records, and team socials (public APIs + roster).",
  ...slashCommandUserInstallScope,
})
@SlashGroup({
  name: "projects",
  root: "resonite",
  description:
    "Browse Yellow-Dog-Man GitHub Project boards (team + community).",
})
@SlashGroup("projects", "resonite")
export class ResoniteProjectsCommands {
  @Slash({
    name: "list",
    description:
      "Browse a team GitHub board (pick a board, or set board). Done items hidden unless done is true.",
  })
  async list(
    @SlashOption({
      name: "board",
      description: "Board key or name (omit to pick from menus)",
      type: ApplicationCommandOptionType.String,
      required: false,
      autocomplete: projectsAutocomplete,
    })
    board: string | undefined,
    @SlashOption({
      name: "in_progress",
      description: "Only items whose Status is In Progress / Doing",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    inProgress: boolean | undefined,
    @SlashOption({
      name: "done",
      description: "Include done / closed items (default: hidden)",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    done: boolean | undefined,
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!isGitHubConfigured()) {
      await interaction.reply({
        content: missingGitHubTokenMessage(),
        flags: slashEphemeralReplyFlags(visible),
      });
      return;
    }

    await interaction.deferReply(slashDeferEphemeralFlags(visible));

    try {
      const boardKey = board ? await parseListBoardInput(board) : null;
      if (board && boardKey === null) {
        await interaction.editReply({
          content: `Unknown board. Use ${formatBoardKeysHint()}, or omit board to pick from menus.`,
        });
        return;
      }

      if (!boardKey) {
        await replyWithYdmBoardPicker(interaction, {
          done: done === true,
          inProgress: inProgress === true,
        });
        return;
      }

      const state: YdmProjectsPageState = {
        v: 1,
        m: "list",
        b: boardKey,
        p: 0,
        ...(done ? { d: 1 } : {}),
        ...(inProgress ? { i: 1 } : {}),
      };
      await renderYdmProjectsPage(interaction, state);
    } catch (err) {
      loggers.resonite.error("projects list failed", err, { board, inProgress, done });
      await interaction.editReply(
        ydmProjectsMessagePayload(
          buildYdmProjectsErrorComponents(
            truncateEllipsis(
              err instanceof GitHubApiError
                ? "Could not load GitHub project boards."
                : "Could not load GitHub project boards. Try again later.",
              300,
            ),
          ),
        ) as InteractionEditReplyOptions,
      );
    }
  }

}
