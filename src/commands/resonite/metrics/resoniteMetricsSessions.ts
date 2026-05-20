import { ButtonComponent, Discord, ModalComponent, SlashGroup } from "discordx";
import {
  ActionRowBuilder,
  ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { prisma } from "../../../main.js";
import { pickTopSessionsForEmbeds } from "../../../services/resonite/metrics/resoniteMetricsFormat.js";
import { fetchResoniteSessions } from "../../../services/resonite/metrics/resoniteMetricsFetch.js";
import {
  metricsSessionsPageCount,
  parseMetricsSessionsPageId,
  parseMetricsSessionsPageInput,
} from "../../../services/resonite/metrics/resoniteMetricsSessionPages.js";
import { renderMetricsSessionsPage } from "../../../services/resonite/metrics/resoniteMetricsSessionsReply.js";
import {
  METRICS_SESSIONS_GOTO_BUTTON_ID,
  METRICS_SESSIONS_GOTO_INPUT_ID,
  METRICS_SESSIONS_GOTO_MODAL_ID,
  METRICS_SESSIONS_PAGE_PATTERN,
} from "../../../utility/discord/discordInteractionIds.js";
import { slashCommandUserInstallScope } from "../../../config/discordSlashInstall.js";
import { loggers } from "../../../utility/logging/logger.js";

@Discord()
@SlashGroup({
  name: "resonite",
  description:
    "Resonite wiki, accounts, records, and team socials (public APIs + roster).",
  ...slashCommandUserInstallScope,
})
export class ResoniteMetricsSessionsHandlers {
  @ButtonComponent({ id: METRICS_SESSIONS_PAGE_PATTERN })
  async onMetricsSessionsPage(interaction: ButtonInteraction): Promise<void> {
    const pageIndex = parseMetricsSessionsPageId(interaction.customId);
    if (pageIndex === null) {
      return;
    }

    if (!interaction.guildId) {
      await interaction.reply({
        content: "Use this in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const fromEphemeral = interaction.message.flags.has(MessageFlags.Ephemeral);
    if (fromEphemeral) {
      await interaction.deferUpdate();
    } else {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    try {
      await renderMetricsSessionsPage(interaction, prisma, pageIndex, {
        fromEphemeral,
      });
    } catch (err) {
      loggers.resonite.error("metrics sessions page failed", err, {
        guildId: interaction.guildId,
        pageIndex,
      });
      await interaction.editReply({
        content: "Could not load sessions from the Resonite API.",
        components: [],
      });
    }
  }

  @ButtonComponent({ id: METRICS_SESSIONS_GOTO_BUTTON_ID })
  async onMetricsSessionsGoto(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Use this in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let placeholder = "1";
    try {
      const sessions = await fetchResoniteSessions();
      const totalPages = metricsSessionsPageCount(
        pickTopSessionsForEmbeds(sessions),
      );
      if (totalPages > 0) {
        placeholder = `1–${totalPages}`;
      }
    } catch {
      /* optional hint only */
    }

    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(METRICS_SESSIONS_GOTO_MODAL_ID)
        .setTitle("Go to page")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId(METRICS_SESSIONS_GOTO_INPUT_ID)
              .setLabel("Page number")
              .setStyle(TextInputStyle.Short)
              .setMinLength(1)
              .setMaxLength(4)
              .setRequired(true)
              .setPlaceholder(placeholder),
          ),
        ),
    );
  }

  @ModalComponent({ id: METRICS_SESSIONS_GOTO_MODAL_ID })
  async onMetricsSessionsGotoSubmit(
    interaction: ModalSubmitInteraction,
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Use this in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const sessions = await fetchResoniteSessions();
      const ranked = pickTopSessionsForEmbeds(sessions);
      const totalPages = metricsSessionsPageCount(ranked);

      if (totalPages === 0) {
        await interaction.reply({
          content: "There are no extra session pages right now.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const raw = interaction.fields.getTextInputValue(
        METRICS_SESSIONS_GOTO_INPUT_ID,
      );
      const pageIndex = parseMetricsSessionsPageInput(raw, totalPages);
      if (pageIndex === null) {
        await interaction.reply({
          content: `Enter a whole number from **1** to **${totalPages}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const fromEphemeral =
        interaction.message?.flags.has(MessageFlags.Ephemeral) ?? false;
      await renderMetricsSessionsPage(interaction, prisma, pageIndex, {
        fromEphemeral,
      });
    } catch (err) {
      loggers.resonite.error("metrics sessions goto modal failed", err, {
        guildId: interaction.guildId,
      });
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "Could not load sessions from the Resonite API.",
          components: [],
        });
      } else {
        await interaction.reply({
          content: "Could not load sessions from the Resonite API.",
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }
}
