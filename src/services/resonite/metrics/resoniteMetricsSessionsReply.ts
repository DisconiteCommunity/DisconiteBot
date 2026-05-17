import type {
  ButtonInteraction,
  InteractionEditReplyOptions,
  ModalSubmitInteraction,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { fetchResoniteSessions } from "./resoniteMetricsFetch.js";
import { buildMetricsSessionsPageComponents } from "./resoniteMetricsComponentsV2.js";
import { pickTopSessionsForEmbeds } from "./resoniteMetricsFormat.js";
import {
  metricsSessionsPageCount,
  metricsSessionsPageSlice,
} from "./resoniteMetricsSessionPages.js";

export async function renderMetricsSessionsPage(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  prisma: PrismaClient,
  pageIndex: number,
  options: { fromEphemeral: boolean },
): Promise<void> {
  if (!interaction.guildId) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Use this in a server.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (!interaction.deferred && !interaction.replied) {
    if (options.fromEphemeral) {
      await interaction.deferUpdate();
    } else {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  }

  const [sessions, settings] = await Promise.all([
    fetchResoniteSessions(),
    prisma.guildSettings.findUnique({
      where: { guildId: interaction.guildId },
    }),
  ]);

  const ranked = pickTopSessionsForEmbeds(sessions);
  const totalPages = metricsSessionsPageCount(ranked);
  const clampedIndex = Math.min(
    Math.max(0, pageIndex),
    Math.max(0, totalPages - 1),
  );
  const slice = metricsSessionsPageSlice(ranked, clampedIndex);
  const showThumbnail = settings?.metricsWorldPreviews ?? false;

  if (slice.length === 0) {
    await interaction.editReply({
      content: "No active sessions on this page.",
    });
    return;
  }

  await interaction.editReply({
    components: buildMetricsSessionsPageComponents(
      clampedIndex,
      ranked,
      showThumbnail,
    ),
    flags: MessageFlags.IsComponentsV2 as InteractionEditReplyOptions["flags"],
  });
}
