import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { prisma } from "../../../main.js";
import { pruneGuildSettingsIfUnused } from "../../../services/guildSettings/pruneGuildSettingsIfUnused.js";
import {
  METRICS_UNREGISTER_CANCEL_BUTTON_ID,
  METRICS_UNREGISTER_CONFIRM_BUTTON_ID,
} from "../../../utility/discord/discordInteractionIds.js";
import { slashCommandUserInstallScope } from "../../../config/discordSlashInstall.js";
import { loggers } from "../../../utility/logging/logger.js";

function requireGuildAdminContext(
  interaction: CommandInteraction | ButtonInteraction,
): { guildId: string } | null {
  const guild = interaction.guild;
  if (!guild) {
    void interaction.reply({
      content: "Use this in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  const perms = interaction.memberPermissions;
  if (!perms?.has(PermissionFlagsBits.Administrator)) {
    void interaction.reply({
      content: "You need **Administrator** to manage Resonite metrics.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return { guildId: guild.id };
}

@Discord()
@SlashGroup({
  name: "resonite",
  description:
    "Resonite wiki, accounts, records, and team socials (public APIs + roster).",
  ...slashCommandUserInstallScope,
})
@SlashGroup({
  name: "metrics",
  root: "resonite",
  description:
    "Live Resonite cloud stats + top public sessions (updates one bot message per server).",
})
@SlashGroup("metrics", "resonite")
export class ResoniteMetricsCommands {
  @Slash({
    name: "register",
    description:
      "Register this channel for live Resonite metrics + session highlights (admin only).",
  })
  async register(interaction: CommandInteraction): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }
    const { guildId } = ctx;
    const channelId = interaction.channelId;

    try {
      const existing = await prisma.guildSettings.findUnique({
        where: { guildId },
      });
      if (existing?.metricsChannelId) {
        await interaction.reply({
          content:
            "This server already has a metrics channel. Run **`/resonite metrics unregister`** there first.",
        });
        return;
      }

      await prisma.guildSettings.upsert({
        where: { guildId },
        create: {
          guildId,
          metricsChannelId: channelId,
          metricsWorldPreviews: false,
        },
        update: {
          metricsChannelId: channelId,
          metricsMessageId: null,
          metricsWorldPreviews: false,
        },
      });

      await interaction.reply({
        content:
          `Registered <#${channelId}> for live metrics. The bot will post and periodically edit **one** message here.\nUse **/resonite metrics preview** to toggle thumbnails.`,
      });
    } catch (err) {
      loggers.resonite.error("metrics register failed", err, { guildId });
      await interaction.reply({
        content: "Could not save subscription (database error).",
      });
    }
  }

  @Slash({
    name: "status",
    description:
      "Show which channel receives live Resonite metrics in this server.",
  })
  async status(interaction: CommandInteraction): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }
    const { guildId } = ctx;
    try {
      const guildSettings = await prisma.guildSettings.findUnique({
        where: { guildId },
      });
      if (!guildSettings?.metricsChannelId) {
        await interaction.reply({
          content:
            "No metrics channel is registered. Use **`/resonite metrics register`** in the channel you want.",
        });
        return;
      }
      await interaction.reply({
        content: `Metrics channel: <#${guildSettings.metricsChannelId}> · thumbnails **${guildSettings.metricsWorldPreviews ? "on" : "off"}**`,
      });
    } catch (err) {
      loggers.resonite.error("metrics status failed", err, { guildId });
      await interaction.reply({
        content: "Could not read subscription.",
      });
    }
  }

  @Slash({
    name: "unregister",
    description:
      "Stop posting metrics in this server and remove the stored subscription.",
  })
  async unregister(interaction: CommandInteraction): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }

    const guildSettings = await prisma.guildSettings.findUnique({
      where: { guildId: ctx.guildId },
    });
    if (!guildSettings?.metricsChannelId) {
      await interaction.reply({
        content: "This server is not registered for metrics.",
      });
      return;
    }

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(METRICS_UNREGISTER_CONFIRM_BUTTON_ID)
        .setLabel("Confirm unregister")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(METRICS_UNREGISTER_CANCEL_BUTTON_ID)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      content:
        "Unregister **removes** this server's metrics subscription and stops updating the metrics message. Continue?",
      components: [confirmRow],
    });
  }

  @Slash({
    name: "preview",
    description:
      "Toggle large session thumbnails on the live metrics embeds for this server.",
  })
  async preview(
    @SlashOption({
      name: "enabled",
      description: "Show session thumbnails on metrics embeds",
      type: ApplicationCommandOptionType.Boolean,
      required: true,
    })
    enabled: boolean,
    interaction: CommandInteraction,
  ): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }
    const { guildId } = ctx;
    try {
      await prisma.guildSettings.update({
        where: { guildId },
        data: { metricsWorldPreviews: enabled },
      });
      await interaction.reply({
        content: `World/session thumbnails **${enabled ? "enabled" : "disabled"}** for the next metrics tick.`,
      });
    } catch {
      await interaction.reply({
        content:
          "Could not update preview setting — is this server registered? Use **`/resonite metrics register`** first.",
      });
    }
  }

  @Slash({
    name: "info",
    description:
      "About live Resonite metrics (upstream project & license pointer).",
  })
  async info(interaction: CommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("Resonite cloud metrics")
      .setDescription(
        [
          "This bot periodically pulls **`GET /sessions`**, **`GET /stats/cloudStats`**, and **`GET /stats/onlineStats`** from [api.resonite.com](https://api.resonite.com) and mirrors aggregate metrics plus top active sessions into channels registered with **`/resonite metrics register`**.",
          "",
          "Originally ported from **Resonite Discord Sessions** (MIT): [crystalline-shard/oss/resonite-discord-sessions](https://g.j4.lc/crystalline-shard/oss/resonite-discord-sessions).",
        ].join("\n"),
      );
    await interaction.reply({
      embeds: [embed],
    });
  }

  @ButtonComponent({ id: METRICS_UNREGISTER_CONFIRM_BUTTON_ID })
  async unregisterConfirm(interaction: ButtonInteraction): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }
    const { guildId } = ctx;

    try {
      const guildSettings = await prisma.guildSettings.findUnique({
        where: { guildId },
      });

      if (!guildSettings?.metricsChannelId) {
        await interaction.update({
          content: "Nothing to unregister.",
          components: [],
        });
        return;
      }

      if (guildSettings.metricsMessageId && interaction.client.isReady()) {
        try {
          const channel = await interaction.client.channels.fetch(
            guildSettings.metricsChannelId,
          );
          if (channel?.isSendable()) {
            const message = await channel.messages.fetch(
              guildSettings.metricsMessageId,
            );
            await message.delete().catch(() => undefined);
          }
        } catch {
          /* best-effort cleanup */
        }
      }

      await prisma.guildSettings.update({
        where: { guildId },
        data: {
          metricsChannelId: null,
          metricsMessageId: null,
          metricsWorldPreviews: false,
        },
      });
      await pruneGuildSettingsIfUnused(prisma, guildId);

      await interaction.update({
        content:
          "Unregistered. Metrics posts will stop (the metrics message was deleted if possible).",
        components: [],
      });
    } catch (err) {
      loggers.resonite.error("metrics unregister confirm failed", err, {
        guildId,
      });
      await interaction.update({
        content: "Unregister failed (database or Discord error).",
        components: [],
      });
    }
  }

  @ButtonComponent({ id: METRICS_UNREGISTER_CANCEL_BUTTON_ID })
  async unregisterCancel(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Use this in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.update({
      content: "Cancelled.",
      components: [],
    });
  }
}
