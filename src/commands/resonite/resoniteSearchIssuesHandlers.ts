import {
  ButtonComponent,
  Discord,
  ModalComponent,
  SelectMenuComponent,
  SlashGroup,
} from "discordx";
import {
  ActionRowBuilder,
  ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  type InteractionEditReplyOptions,
} from "discord.js";
import { isGitHubConfigured } from "../../config/github.js";
import {
  buildYdmIssuesSearchDashboardComponents,
  defaultYdmIssuesSearchState,
  parseYdmIssuesSearchDashboardId,
  renderYdmIssuesSearchDashboard,
  ydmIssuesSearchStateWithAuthor,
  ydmIssuesSearchStateWithQuery,
  YDM_ISSUES_AUTHOR_MODAL_ID,
  YDM_ISSUES_MODAL_INPUT_ID,
  YDM_ISSUES_QUERY_MODAL_ID,
  type YdmIssuesSearchState,
} from "../../services/github/ydmIssuesSearchDashboard.js";
import {
  buildYdmIssueRepoResultsComponents,
  issueRepoPickEditPayload,
  parseYdmIssueRepoPickMenuId,
  parseYdmIssueRepoResultsPageId,
  searchYdmRepositoryIssues,
  YDM_ISSUES_DEFAULT_REPO,
  type YdmIssuesRepo,
} from "../../services/github/resoniteIssuesRepoSearch.js";
import {
  buildYdmProjectsErrorComponents,
  ydmProjectsMessagePayload,
} from "../../services/github/ydmProjectsComponentsV2.js";
import {
  missingGitHubTokenMessage,
  renderYdmProjectsPage,
} from "../../services/github/ydmProjectsReply.js";
import {
  YDM_ISSUES_REPO_PICK_MENU_PATTERN,
  YDM_ISSUES_REPO_RESULTS_PATTERN,
  YDM_ISSUES_SEARCH_DASHBOARD_PATTERN,
  YDM_ISSUES_SEARCH_RESET_BUTTON_ID,
} from "../../utility/discord/discordInteractionIds.js";
import { slashCommandUserInstallScope } from "../../config/discordSlashInstall.js";
import { loggers } from "../../utility/logging/logger.js";

const modalStateByUser = new Map<
  string,
  { readonly state: YdmIssuesSearchState; readonly expiresAt: number }
>();

function modalKey(userId: string, modalId: string): string {
  return `${userId}:${modalId}`;
}

function rememberModalState(
  userId: string,
  modalId: string,
  state: YdmIssuesSearchState,
): void {
  modalStateByUser.set(modalKey(userId, modalId), {
    state,
    expiresAt: Date.now() + 10 * 60_000,
  });
}

function takeModalState(
  userId: string,
  modalId: string,
): YdmIssuesSearchState | null {
  const key = modalKey(userId, modalId);
  const entry = modalStateByUser.get(key);
  modalStateByUser.delete(key);
  if (!entry || entry.expiresAt < Date.now()) {
    return null;
  }
  return entry.state;
}

async function replyMissingToken(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
): Promise<boolean> {
  if (isGitHubConfigured()) {
    return false;
  }
  await interaction.reply({
    content: missingGitHubTokenMessage(),
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

function modalFor(
  id: string,
  title: string,
  label: string,
  value: string | undefined,
): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId(YDM_ISSUES_MODAL_INPUT_ID)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(80)
    .setPlaceholder("Leave empty to clear");
  if (value) {
    input.setValue(value);
  }
  return new ModalBuilder()
    .setCustomId(id)
    .setTitle(title)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

async function renderRepoResults(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  state: YdmIssuesSearchState,
): Promise<void> {
  const repo = state.repo ?? YDM_ISSUES_DEFAULT_REPO;
  const initialRepoResultsState = {
    v: 1 as const,
    p: 0,
    repo,
    ...(state.query ? { query: state.query } : {}),
    ...(state.author ? { author: state.author } : {}),
    ...(state.labels?.length ? { labels: state.labels } : {}),
  };
  const result = await searchYdmRepositoryIssues(initialRepoResultsState, 0);
  await interaction.editReply(
    ydmProjectsMessagePayload(
      buildYdmIssueRepoResultsComponents(initialRepoResultsState, result),
    ) as InteractionEditReplyOptions,
  );
}

async function renderDashboardAfterUpdate(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  state: YdmIssuesSearchState,
): Promise<void> {
  const components = await buildYdmIssuesSearchDashboardComponents(state);
  await interaction.editReply(
    ydmProjectsMessagePayload(components) as InteractionEditReplyOptions,
  );
}

@Discord()
@SlashGroup({
  name: "resonite",
  description:
    "Resonite wiki, accounts, records, and team socials (public APIs + roster).",
  ...slashCommandUserInstallScope,
})
export class ResoniteSearchIssuesHandlers {
  @ButtonComponent({ id: YDM_ISSUES_SEARCH_RESET_BUTTON_ID })
  async onIssuesSearchReset(interaction: ButtonInteraction): Promise<void> {
    if (await replyMissingToken(interaction)) {
      return;
    }
    await interaction.deferUpdate();
    try {
      await renderYdmIssuesSearchDashboard(interaction, defaultYdmIssuesSearchState());
    } catch (err) {
      loggers.resonite.error("github search reset failed", err);
      await interaction.editReply(
        ydmProjectsMessagePayload(
          buildYdmProjectsErrorComponents("Could not return to GitHub search."),
        ) as InteractionEditReplyOptions,
      );
    }
  }

  @ButtonComponent({ id: YDM_ISSUES_SEARCH_DASHBOARD_PATTERN })
  async onIssuesDashboardButton(interaction: ButtonInteraction): Promise<void> {
    if (await replyMissingToken(interaction)) {
      return;
    }
    const parsedDashboard = parseYdmIssuesSearchDashboardId(interaction.customId);
    if (!parsedDashboard) {
      return;
    }

    if (parsedDashboard.action === "query" || parsedDashboard.action === "author") {
      if (parsedDashboard.action === "author" && parsedDashboard.state.scope !== "repo") {
        await interaction.reply({
          content: "Author filter applies in **repository** scope. Switch to **Use repository** first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const modalId =
        parsedDashboard.action === "query"
          ? YDM_ISSUES_QUERY_MODAL_ID
          : YDM_ISSUES_AUTHOR_MODAL_ID;
      rememberModalState(interaction.user.id, modalId, parsedDashboard.state);
      await interaction.showModal(
        modalFor(
          modalId,
          parsedDashboard.action === "query" ? "Issue search query" : "Issue author",
          parsedDashboard.action === "query" ? "Query" : "GitHub username",
          parsedDashboard.action === "query"
            ? parsedDashboard.state.query
            : parsedDashboard.state.author,
        ),
      );
      return;
    }

    await interaction.deferUpdate();
    try {
      if (parsedDashboard.action === "run") {
        if (parsedDashboard.state.scope === "repo") {
          await renderRepoResults(interaction, parsedDashboard.state);
          return;
        }
        await renderYdmProjectsPage(interaction, {
          v: 1,
          m: parsedDashboard.state.query ? "search" : "list",
          b: parsedDashboard.state.board ?? "all",
          p: 0,
          ...(parsedDashboard.state.query ? { q: parsedDashboard.state.query } : {}),
        });
        return;
      }

      let updatedSearchState = parsedDashboard.state;
      if (parsedDashboard.action === "clear_board") {
        updatedSearchState = { ...updatedSearchState, scope: "boards", board: "all" };
      } else if (parsedDashboard.action === "clear_labels") {
        updatedSearchState = { ...updatedSearchState, labels: [] };
      } else if (parsedDashboard.action === "label_page_prev") {
        updatedSearchState = {
          ...updatedSearchState,
          labelPage: Math.max(0, (updatedSearchState.labelPage ?? 0) - 1),
        };
      } else if (parsedDashboard.action === "label_page_next") {
        updatedSearchState = {
          ...updatedSearchState,
          labelPage: (updatedSearchState.labelPage ?? 0) + 1,
        };
      }
      await renderDashboardAfterUpdate(interaction, updatedSearchState);
    } catch (err) {
      loggers.resonite.error("issues dashboard button failed", err, {
        action: parsedDashboard.action,
      });
      await interaction.editReply(
        ydmProjectsMessagePayload(
          buildYdmProjectsErrorComponents("Could not update GitHub search."),
        ) as InteractionEditReplyOptions,
      );
    }
  }

  @SelectMenuComponent({ id: YDM_ISSUES_SEARCH_DASHBOARD_PATTERN })
  async onIssuesDashboardSelect(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    if (await replyMissingToken(interaction)) {
      return;
    }
    const parsedDashboard = parseYdmIssuesSearchDashboardId(interaction.customId);
    if (!parsedDashboard) {
      return;
    }

    await interaction.deferUpdate();
    try {
      let updatedSearchState = parsedDashboard.state;
      if (parsedDashboard.action === "repo") {
        const selectedRepo = interaction.values[0] as YdmIssuesRepo | undefined;
        updatedSearchState = {
          ...updatedSearchState,
          scope: "repo",
          repo: selectedRepo ?? YDM_ISSUES_DEFAULT_REPO,
          labels: [],
          labelPage: 0,
        };
      } else if (parsedDashboard.action === "labels") {
        updatedSearchState = {
          ...updatedSearchState,
          scope: "repo",
          labels: interaction.values.slice(0, 3),
        };
      }
      await renderDashboardAfterUpdate(interaction, updatedSearchState);
    } catch (err) {
      loggers.resonite.error("issues dashboard select failed", err, {
        action: parsedDashboard.action,
      });
      await interaction.editReply(
        ydmProjectsMessagePayload(
          buildYdmProjectsErrorComponents("Could not update GitHub search."),
        ) as InteractionEditReplyOptions,
      );
    }
  }

  @ModalComponent({ id: YDM_ISSUES_QUERY_MODAL_ID })
  async onIssuesQueryModal(interaction: ModalSubmitInteraction): Promise<void> {
    await this.applyModalValue(interaction, YDM_ISSUES_QUERY_MODAL_ID, "query");
  }

  @ModalComponent({ id: YDM_ISSUES_AUTHOR_MODAL_ID })
  async onIssuesAuthorModal(interaction: ModalSubmitInteraction): Promise<void> {
    await this.applyModalValue(interaction, YDM_ISSUES_AUTHOR_MODAL_ID, "author");
  }

  private async applyModalValue(
    interaction: ModalSubmitInteraction,
    modalId: string,
    field: "query" | "author",
  ): Promise<void> {
    if (await replyMissingToken(interaction)) {
      return;
    }
    const stateBeforeModal =
      takeModalState(interaction.user.id, modalId) ??
      defaultYdmIssuesSearchState();
    const submittedFieldText = interaction.fields.getTextInputValue(
      YDM_ISSUES_MODAL_INPUT_ID,
    );
    const searchStateAfterSubmit =
      field === "query"
        ? ydmIssuesSearchStateWithQuery(stateBeforeModal, submittedFieldText)
        : ydmIssuesSearchStateWithAuthor(stateBeforeModal, submittedFieldText);

    await interaction.deferUpdate();
    try {
      await renderYdmIssuesSearchDashboard(interaction, searchStateAfterSubmit);
    } catch (err) {
      loggers.resonite.error("issues dashboard modal failed", err, { field });
      await interaction.editReply({
        content: "Could not update GitHub search.",
        components: [],
      });
    }
  }

  @SelectMenuComponent({ id: YDM_ISSUES_REPO_PICK_MENU_PATTERN })
  async onIssuesRepoIssuePick(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    if (await replyMissingToken(interaction)) {
      return;
    }
    const state = parseYdmIssueRepoPickMenuId(interaction.customId);
    if (!state) {
      return;
    }
    const issueNumber = parseInt(interaction.values[0] ?? "", 10);
    if (!Number.isFinite(issueNumber) || issueNumber < 1) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const results = await searchYdmRepositoryIssues(state, state.p);
      const hit = results.items.find((i) => i.number === issueNumber);
      if (!hit) {
        await interaction.editReply({
          content:
            "That issue isn’t on this results page anymore. Change page or run **Run** again.",
        });
        return;
      }
      await interaction.editReply(issueRepoPickEditPayload(hit));
    } catch (err) {
      loggers.resonite.error("issues repo pick select failed", err, {
        state,
        issueNumber,
      });
      await interaction.editReply({
        content: "Could not load that issue. Try again in a moment.",
      });
    }
  }

  @ButtonComponent({ id: YDM_ISSUES_REPO_RESULTS_PATTERN })
  async onIssuesRepoResultsPage(interaction: ButtonInteraction): Promise<void> {
    if (await replyMissingToken(interaction)) {
      return;
    }
    const repoResultsState = parseYdmIssueRepoResultsPageId(interaction.customId);
    if (!repoResultsState) {
      return;
    }

    await interaction.deferUpdate();
    try {
      const result = await searchYdmRepositoryIssues(repoResultsState, repoResultsState.p);
      await interaction.editReply(
        ydmProjectsMessagePayload(
          buildYdmIssueRepoResultsComponents(repoResultsState, result),
        ) as InteractionEditReplyOptions,
      );
    } catch (err) {
      loggers.resonite.error("issues repo results page failed", err, {
        state: repoResultsState,
      });
      await interaction.editReply(
        ydmProjectsMessagePayload(
          buildYdmProjectsErrorComponents("Could not load that results page."),
        ) as InteractionEditReplyOptions,
      );
    }
  }
}
