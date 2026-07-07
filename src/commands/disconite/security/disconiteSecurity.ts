import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  ApplicationCommandOptionType,
  ChannelType,
  CommandInteraction,
  EmbedBuilder,
  GuildBasedChannel,
  MessageFlags,
  PermissionFlagsBits,
  Role,
  User,
} from "discord.js";
import { prisma } from "../../../main.js";
import {
  clearRolePingSpamConfig,
  extrasToPrismaUpdate,
  mergeRolePingSpamConfig,
  readRolePingSpamConfig,
} from "../../../services/guildSettings/rolePingSpamExtras.js";
import { pruneGuildSettingsIfUnused } from "../../../services/guildSettings/pruneGuildSettingsIfUnused.js";
import { setRolePingSpamConfig } from "../../../services/security/rolePingSpam/configCache.js";
import {
  formatMissingRolePingSpamPermissionsMessage,
  getMissingRolePingSpamPermissions,
} from "../../../services/security/rolePingSpam/botPermissions.js";
import { maybeAutoDisableRolePingSpam } from "../../../services/security/rolePingSpam/permissionSync.js";
import { slashCommandUserInstallScope } from "../../../config/discordSlashInstall.js";
import { loggers } from "../../../utility/logging/logger.js";

function requireGuildAdminContext(
  interaction: CommandInteraction,
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
      content: "You need **Administrator** to manage compromised account spam protection.",
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return { guildId: guild.id };
}

function requireRolePingSpamBotPermissions(
  interaction: CommandInteraction,
): boolean {
  const missing = getMissingRolePingSpamPermissions(interaction.guild?.members.me);
  if (missing.length === 0) {
    return true;
  }

  void interaction.reply({
    content: formatMissingRolePingSpamPermissionsMessage(missing),
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

function formatConfigStatus(
  config: NonNullable<ReturnType<typeof readRolePingSpamConfig>>,
): string {
  const lines = [
    `**Enabled:** ${config.enabled ? "yes" : "no"}`,
    `**Mod log channel:** <#${config.modLogChannelId}>`,
    `**Mod ping role:** ${config.modPingRoleId ? `<@&${config.modPingRoleId}>` : "not set"}`,
    `**Min channels:** ${config.minChannels}`,
    `**Min images:** ${config.minImages}`,
    `**Min messages:** ${config.minMessages}`,
    `**Window:** ${config.windowMs / 1000}s`,
    `**Cache retention:** ${config.cacheRetentionMs / 1000}s`,
    `**Timeout:** ${config.timeoutMinutes / 60}h (${config.timeoutMinutes} min)`,
    `**Dry-run users:** ${
      config.dryRunUserIds.length > 0
        ? config.dryRunUserIds.map((id) => `<@${id}>`).join(", ")
        : "none"
    }`,
    `**Debug logging:** ${config.debugLogging ? "on" : "off"}`,
  ];
  return lines.join("\n");
}

@Discord()
@SlashGroup({
  name: "disconite",
  description:
    "Disconite Weblate translations and forum search (disconite.net).",
  ...slashCommandUserInstallScope,
})
@SlashGroup({
  name: "security",
  root: "disconite",
  description:
    "Opt-in compromised account spam protection (multi-channel role-ping + image spam).",
})
@SlashGroup("security", "disconite")
export class DisconiteSecurityCommands {
  @Slash({
    name: "enable",
    description:
      "Enable compromised account spam protection for this server (admin only).",
  })
  async enable(
    @SlashOption({
      name: "mod-log-channel",
      description: "Channel where moderators are alerted (required)",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      required: true,
    })
    modLogChannel: GuildBasedChannel,
    @SlashOption({
      name: "mod-ping-role",
      description: "Role to ping in the mod log channel",
      type: ApplicationCommandOptionType.Role,
      required: false,
    })
    modPingRole: Role | null,
    interaction: CommandInteraction,
  ): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }
    if (!requireRolePingSpamBotPermissions(interaction)) {
      return;
    }

    try {
      const existing = await prisma.guildSettings.findUnique({
        where: { guildId: ctx.guildId },
      });
      const { extras, config } = mergeRolePingSpamConfig(existing?.extras, {
        modLogChannelId: modLogChannel.id,
        enabled: true,
        ...(modPingRole ? { modPingRoleId: modPingRole.id } : {}),
      });

      await prisma.guildSettings.upsert({
        where: { guildId: ctx.guildId },
        create: { guildId: ctx.guildId, extras: extrasToPrismaUpdate(extras) },
        update: { extras: extrasToPrismaUpdate(extras) },
      });

      setRolePingSpamConfig(ctx.guildId, config);

      await interaction.reply({
        content:
          `Compromised account spam protection is **enabled**. Mod log: <#${modLogChannel.id}>.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      loggers.disconite.error("security enable failed", err, { guildId: ctx.guildId });
      await interaction.reply({
        content: "Could not enable protection (database error).",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @Slash({
    name: "disable",
    description:
      "Disable compromised account spam protection for this server (admin only).",
  })
  async disable(interaction: CommandInteraction): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }

    try {
      const existing = await prisma.guildSettings.findUnique({
        where: { guildId: ctx.guildId },
      });
      if (!readRolePingSpamConfig(existing?.extras)?.enabled) {
        await interaction.reply({
          content: "Protection is not enabled in this server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const extras = clearRolePingSpamConfig(existing?.extras);
      await prisma.guildSettings.update({
        where: { guildId: ctx.guildId },
        data: { extras: extrasToPrismaUpdate(extras) },
      });
      await pruneGuildSettingsIfUnused(prisma, ctx.guildId);
      setRolePingSpamConfig(ctx.guildId, null);

      await interaction.reply({
        content: "Compromised account spam protection is **disabled**.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      loggers.disconite.error("security disable failed", err, { guildId: ctx.guildId });
      await interaction.reply({
        content: "Could not disable protection.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @Slash({
    name: "status",
    description: "Show compromised account spam protection settings for this server.",
  })
  async status(interaction: CommandInteraction): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }

    try {
      const row = await prisma.guildSettings.findUnique({
        where: { guildId: ctx.guildId },
      });
      const config = readRolePingSpamConfig(row?.extras);
      if (!config?.enabled) {
        await interaction.reply({
          content:
            "Protection is **not enabled**. Use **`/disconite security enable`** with a mod log channel.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const missing = getMissingRolePingSpamPermissions(interaction.guild?.members.me);
      if (missing.length > 0) {
        if (interaction.guild) {
          await maybeAutoDisableRolePingSpam(prisma, interaction.guild);
        }
        await interaction.reply({
          content:
            `Protection was **auto-disabled** because the bot is missing required permissions.\n\n${formatMissingRolePingSpamPermissionsMessage(missing)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("Compromised account spam protection")
        .setDescription(formatConfigStatus(config));

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      loggers.disconite.error("security status failed", err, { guildId: ctx.guildId });
      await interaction.reply({
        content: "Could not read protection settings.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @Slash({
    name: "log-channel",
    description: "Set or view the moderator log channel for spam protection.",
  })
  async logChannel(
    @SlashOption({
      name: "channel",
      description: "Moderator log channel (omit to view current)",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      required: false,
    })
    channel: GuildBasedChannel | null,
    interaction: CommandInteraction,
  ): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }

    try {
      const existing = await prisma.guildSettings.findUnique({
        where: { guildId: ctx.guildId },
      });
      const current = readRolePingSpamConfig(existing?.extras);

      if (!channel) {
        if (!current?.modLogChannelId) {
          await interaction.reply({
            content: "No mod log channel is configured. Enable protection first.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.reply({
          content: `Mod log channel: <#${current.modLogChannelId}>`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!current) {
        await interaction.reply({
          content:
            "Protection is not configured. Use **`/disconite security enable`** first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (current.enabled && !requireRolePingSpamBotPermissions(interaction)) {
        return;
      }

      const { extras, config } = mergeRolePingSpamConfig(existing?.extras, {
        modLogChannelId: channel.id,
        enabled: current.enabled,
      });

      await prisma.guildSettings.upsert({
        where: { guildId: ctx.guildId },
        create: { guildId: ctx.guildId, extras: extrasToPrismaUpdate(extras) },
        update: { extras: extrasToPrismaUpdate(extras) },
      });
      if (config.enabled) {
        setRolePingSpamConfig(ctx.guildId, config);
      }

      await interaction.reply({
        content: `Mod log channel set to <#${channel.id}>.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      loggers.disconite.error("security log-channel failed", err, { guildId: ctx.guildId });
      await interaction.reply({
        content: "Could not update mod log channel.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @Slash({
    name: "mod-role",
    description: "Set or view the role pinged in the moderator log channel.",
  })
  async modRole(
    @SlashOption({
      name: "role",
      description: "Role to ping in mod log (omit to view current)",
      type: ApplicationCommandOptionType.Role,
      required: false,
    })
    role: Role | null,
    interaction: CommandInteraction,
  ): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }

    try {
      const existing = await prisma.guildSettings.findUnique({
        where: { guildId: ctx.guildId },
      });
      const current = readRolePingSpamConfig(existing?.extras);

      if (!role) {
        await interaction.reply({
          content: current?.modPingRoleId
            ? `Mod ping role: <@&${current.modPingRoleId}>`
            : "No mod ping role is configured.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!current?.modLogChannelId) {
        await interaction.reply({
          content:
            "Protection is not configured. Use **`/disconite security enable`** first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (current.enabled && !requireRolePingSpamBotPermissions(interaction)) {
        return;
      }

      const { extras, config } = mergeRolePingSpamConfig(existing?.extras, {
        modLogChannelId: current.modLogChannelId,
        enabled: current.enabled,
        modPingRoleId: role.id,
      });

      await prisma.guildSettings.upsert({
        where: { guildId: ctx.guildId },
        create: { guildId: ctx.guildId, extras: extrasToPrismaUpdate(extras) },
        update: { extras: extrasToPrismaUpdate(extras) },
      });
      if (config.enabled) {
        setRolePingSpamConfig(ctx.guildId, config);
      }

      await interaction.reply({
        content: `Mod ping role set to <@&${role.id}>.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      loggers.disconite.error("security mod-role failed", err, { guildId: ctx.guildId });
      await interaction.reply({
        content: "Could not update mod ping role.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @Slash({
    name: "configure",
    description: "Adjust detection thresholds and timeout for spam protection.",
  })
  async configure(
    @SlashOption({
      name: "min-channels",
      description: "Minimum distinct channels (default 2)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 2,
      maxValue: 50,
    })
    minChannels: number | null,
    @SlashOption({
      name: "min-images",
      description: "Minimum image attachments per message (default 2)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
      maxValue: 10,
    })
    minImages: number | null,
    @SlashOption({
      name: "min-messages",
      description: "Minimum matching messages in the window (default 3)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 2,
      maxValue: 50,
    })
    minMessages: number | null,
    @SlashOption({
      name: "window-seconds",
      description: "Time window for matching messages (default 3)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
      maxValue: 60,
    })
    windowSeconds: number | null,
    @SlashOption({
      name: "cache-seconds",
      description: "How long messages are remembered (default 60)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 5,
      maxValue: 300,
    })
    cacheSeconds: number | null,
    @SlashOption({
      name: "timeout-hours",
      description: "Timeout duration in hours (default 24)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
      maxValue: 168,
    })
    timeoutHours: number | null,
    interaction: CommandInteraction,
  ): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }

    const hasOption =
      minChannels !== null ||
      minImages !== null ||
      minMessages !== null ||
      windowSeconds !== null ||
      cacheSeconds !== null ||
      timeoutHours !== null;

    if (!hasOption) {
      await interaction.reply({
        content: "Provide at least one option to configure.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const existing = await prisma.guildSettings.findUnique({
        where: { guildId: ctx.guildId },
      });
      const current = readRolePingSpamConfig(existing?.extras);
      if (!current?.enabled || !current.modLogChannelId) {
        await interaction.reply({
          content:
            "Protection is not enabled. Use **`/disconite security enable`** first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!requireRolePingSpamBotPermissions(interaction)) {
        return;
      }

      const { extras, config } = mergeRolePingSpamConfig(existing?.extras, {
        modLogChannelId: current.modLogChannelId,
        enabled: true,
        ...(minChannels !== null ? { minChannels } : {}),
        ...(minImages !== null ? { minImages } : {}),
        ...(minMessages !== null ? { minMessages } : {}),
        ...(windowSeconds !== null ? { windowMs: windowSeconds * 1000 } : {}),
        ...(cacheSeconds !== null ? { cacheRetentionMs: cacheSeconds * 1000 } : {}),
        ...(timeoutHours !== null ? { timeoutMinutes: timeoutHours * 60 } : {}),
        ...(current.modPingRoleId ? { modPingRoleId: current.modPingRoleId } : {}),
        ...(current.dryRunUserIds.length > 0
          ? { dryRunUserIds: current.dryRunUserIds }
          : {}),
        ...(current.debugLogging ? { debugLogging: true } : {}),
      });

      await prisma.guildSettings.update({
        where: { guildId: ctx.guildId },
        data: { extras: extrasToPrismaUpdate(extras) },
      });
      setRolePingSpamConfig(ctx.guildId, config);

      await interaction.reply({
        content: `Settings updated.\n\n${formatConfigStatus(config)}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      loggers.disconite.error("security configure failed", err, { guildId: ctx.guildId });
      await interaction.reply({
        content: "Could not update settings.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @Slash({
    name: "dry-run",
    description:
      "Add or remove a user from dry-run mode (detect and alert without timeout).",
  })
  async dryRun(
    @SlashOption({
      name: "user",
      description: "User to add or remove from dry-run mode",
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: "remove",
      description: "Remove this user from dry-run instead of adding",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    remove: boolean | null,
    interaction: CommandInteraction,
  ): Promise<void> {
    const ctx = requireGuildAdminContext(interaction);
    if (!ctx) {
      return;
    }
    if (!requireRolePingSpamBotPermissions(interaction)) {
      return;
    }

    try {
      const existing = await prisma.guildSettings.findUnique({
        where: { guildId: ctx.guildId },
      });
      const current = readRolePingSpamConfig(existing?.extras);
      if (!current?.enabled || !current.modLogChannelId) {
        await interaction.reply({
          content:
            "Protection is not enabled. Use **`/disconite security enable`** first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const shouldRemove = remove === true;
      const alreadyListed = current.dryRunUserIds.includes(user.id);
      let dryRunUserIds: string[];

      if (shouldRemove) {
        if (!alreadyListed) {
          await interaction.reply({
            content: `<@${user.id}> is not on the dry-run list.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        dryRunUserIds = current.dryRunUserIds.filter((id) => id !== user.id);
      } else {
        if (alreadyListed) {
          await interaction.reply({
            content: `<@${user.id}> is already on the dry-run list.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        dryRunUserIds = [...current.dryRunUserIds, user.id];
      }

      const { extras, config } = mergeRolePingSpamConfig(existing?.extras, {
        modLogChannelId: current.modLogChannelId,
        enabled: true,
        dryRunUserIds,
        ...(current.modPingRoleId ? { modPingRoleId: current.modPingRoleId } : {}),
      });

      await prisma.guildSettings.update({
        where: { guildId: ctx.guildId },
        data: { extras: extrasToPrismaUpdate(extras) },
      });
      setRolePingSpamConfig(ctx.guildId, config);

      await interaction.reply({
        content: shouldRemove
          ? `Removed <@${user.id}> from dry-run. They will be timed out if they trigger spam detection.`
          : `Added <@${user.id}> to dry-run. They will be detected and alerted, but **not timed out** (mod log will not ping). Works on staff too.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      loggers.disconite.error("security dry-run failed", err, { guildId: ctx.guildId });
      await interaction.reply({
        content: "Could not update dry-run list.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @Slash({
    name: "debug-logging",
    description:
      "Enable or disable verbose message-tracking logs for spam protection (bot console).",
  })
  async debugLogging(
    @SlashOption({
      name: "enabled",
      description: "Turn debug logging on or off",
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
    if (!requireRolePingSpamBotPermissions(interaction)) {
      return;
    }

    try {
      const existing = await prisma.guildSettings.findUnique({
        where: { guildId: ctx.guildId },
      });
      const current = readRolePingSpamConfig(existing?.extras);
      if (!current?.enabled || !current.modLogChannelId) {
        await interaction.reply({
          content:
            "Protection is not enabled. Use **`/disconite security enable`** first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const { extras, config } = mergeRolePingSpamConfig(existing?.extras, {
        modLogChannelId: current.modLogChannelId,
        enabled: true,
        debugLogging: enabled,
        ...(current.modPingRoleId ? { modPingRoleId: current.modPingRoleId } : {}),
        ...(current.dryRunUserIds.length > 0
          ? { dryRunUserIds: current.dryRunUserIds }
          : {}),
      });

      await prisma.guildSettings.update({
        where: { guildId: ctx.guildId },
        data: { extras: extrasToPrismaUpdate(extras) },
      });
      setRolePingSpamConfig(ctx.guildId, config);

      await interaction.reply({
        content: enabled
          ? "Debug logging is **on**. Message tracking will be logged to the bot console with prefix `RolePingSpam:`."
          : "Debug logging is **off**.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      loggers.disconite.error("security debug-logging failed", err, {
        guildId: ctx.guildId,
      });
      await interaction.reply({
        content: "Could not update debug logging.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
