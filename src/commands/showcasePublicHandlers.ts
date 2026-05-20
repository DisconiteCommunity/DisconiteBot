import { ButtonComponent, Discord } from "discordx";
import { ButtonInteraction, MessageFlags } from "discord.js";
import {
  DISCONITE_BOT_SHOWCASE_PUBLIC_PATTERN,
  DISCONITE_BOT_SHOWCASE_PUBLIC_PREFIX,
} from "../utility/discord/discordInteractionIds.js";
import { takeShowcasePublicJob } from "../utility/discord/showcasePublicStore.js";
import { materializeShowcasePublicJob } from "../utility/discord/showcasePublicMaterialize.js";
import { isGitHubConfigured } from "../config/github.js";
import { missingGitHubTokenMessage } from "../services/github/ydmProjectsReply.js";
import { loggers } from "../utility/logging/logger.js";
import { truncateEllipsis } from "../utility/text/truncate.js";

@Discord()
export class ShowcasePublicHandlers {
  @ButtonComponent({ id: DISCONITE_BOT_SHOWCASE_PUBLIC_PATTERN })
  async onShowcaseInChannel(interaction: ButtonInteraction): Promise<void> {
    const token = interaction.customId.slice(
      DISCONITE_BOT_SHOWCASE_PUBLIC_PREFIX.length,
    );
    const job = takeShowcasePublicJob(token);
    if (!job) {
      await interaction.reply({
        content:
          "This **Showcase** button expired (they last ~45 minutes). Run the command again.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (job.kind === "gh_issue" && !isGitHubConfigured()) {
      await interaction.reply({
        content: missingGitHubTokenMessage(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.inGuild()) {
      await interaction.reply({
        content:
          "Showcase only works in a **server channel** (not DMs). Use **Make results visible to everyone** on the slash command instead.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.channel;
    if (!channel || !channel.isSendable()) {
      await interaction.reply({
        content: "This channel does not allow the bot to post messages here.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const materialized = await materializeShowcasePublicJob(job);
      if (!materialized.ok) {
        await interaction.editReply({ content: materialized.message });
        return;
      }
      const attribution = truncateEllipsis(
        `⭐ **Showcase** — ${interaction.user.toString()} shared these results.`,
        2000,
      );
      await channel.send({
        content: attribution,
        embeds: materialized.payload.embeds ?? [],
        components: materialized.payload.components ?? [],
        flags: materialized.payload.flags,
        allowedMentions: {
          parse: [],
          roles: [],
          users: [interaction.user.id],
        },
      });

      await interaction.editReply({
        content:
          "**Posted** above for everyone in this channel.\n_-# Still only these results — use this instead of rerunning `/search …` publicly when you explore privately._",
      });
    } catch (err) {
      loggers.bot.error("showcase public post failed", err, {
        jobKind: job.kind,
      });
      await interaction.editReply({
        content:
          "Could not post this showcase (permission or Discord API error). If it keeps failing, try **Make results visible to everyone** on the slash command instead.",
      });
    }
  }
}
