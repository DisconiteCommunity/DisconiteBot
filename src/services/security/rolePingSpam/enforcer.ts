import {
  Colors,
  EmbedBuilder,
  type Guild,
  type TextChannel,
} from "discord.js";
import { loggers } from "../../../utility/logging/logger.js";
import type { RolePingSpamConfig, SpamCluster } from "./types.js";

const NO_MENTIONS = { parse: [] as never[] };

export interface EnforcementOptions {
  dryRun?: boolean;
  skipTimeout?: boolean;
  skipModLog?: boolean;
  alreadyNotifiedChannels?: Set<string>;
}

export interface EnforcementResult {
  deletedCount: number;
  deleteFailures: number;
  timedOut: boolean;
  dryRun: boolean;
  timeoutError?: string;
  notifiedChannels: string[];
  modLogSent: boolean;
}

function buildEnforcementReason(config: RolePingSpamConfig): string {
  const windowSeconds = config.windowMs / 1000;
  return `Compromised account spam: role ping + ${config.minImages}+ images in ${config.minChannels}+ channels within ${windowSeconds}s`;
}

async function resolveAuthorDisplay(
  guild: Guild,
  authorId: string,
): Promise<{ tag: string; mentionLine: string }> {
  try {
    const member = await guild.members.fetch(authorId);
    return {
      tag: member.user.tag,
      mentionLine: `<@${authorId}> (${member.user.tag})`,
    };
  } catch {
    return {
      tag: authorId,
      mentionLine: `<@${authorId}> (\`${authorId}\`)`,
    };
  }
}

async function findThumbnailUrl(
  guild: Guild,
  cluster: SpamCluster,
): Promise<string | undefined> {
  for (const cached of cluster.messages) {
    try {
      const channel = await guild.channels.fetch(cached.channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) {
        continue;
      }
      const message = await channel.messages.fetch(cached.messageId);
      const image = message.attachments.find((attachment) =>
        attachment.contentType?.startsWith("image/"),
      );
      if (image) {
        return image.url;
      }
    } catch {
      // Message may already be deleted on follow-up passes.
    }
  }
  return undefined;
}

function buildPublicNoticeEmbed(options: {
  authorId: string;
  authorTag: string;
  mentionLine: string;
  channelIds: string[];
  config: RolePingSpamConfig;
  dryRun: boolean;
  timedOut: boolean;
  thumbnailUrl?: string;
}): EmbedBuilder {
  const channelCount = options.channelIds.length;
  const channelLines = options.channelIds.map((channelId) => `<#${channelId}>`).join("\n");

  let action: string;
  if (options.dryRun) {
    action =
      "was flagged by compromised account spam protection and their messages were deleted. Moderators have been notified (dry run — no timeout applied).";
  } else if (options.timedOut) {
    action =
      "was automatically timed out by compromised account spam protection and their messages were deleted.";
  } else {
    action =
      "was flagged by compromised account spam protection and their messages were deleted (timeout could not be applied).";
  }

  const embed = new EmbedBuilder()
    .setColor(options.dryRun ? Colors.Orange : Colors.Red)
    .setTitle(
      options.dryRun
        ? "Compromised account spam (dry run)"
        : "Compromised account timeout",
    )
    .setDescription(
      `**${options.authorTag}** (\`${options.authorId}\`) ${action}\n\nIf you received a ghost ping from them, this is why.`,
    )
    .addFields(
      { name: "User", value: options.mentionLine, inline: false },
      {
        name: `Channels posted in (${channelCount})`,
        value: channelLines || "—",
        inline: false,
      },
      { name: "Reason", value: buildEnforcementReason(options.config), inline: false },
    )
    .setTimestamp();

  if (options.thumbnailUrl) {
    embed.setImage(options.thumbnailUrl);
  }

  return embed;
}

export async function enforceSpamCluster(
  guild: Guild,
  cluster: SpamCluster,
  config: RolePingSpamConfig,
  options: EnforcementOptions = {},
): Promise<EnforcementResult> {
  const dryRun = options.dryRun ?? false;
  const skipTimeout = options.skipTimeout ?? false;
  const skipModLog = options.skipModLog ?? false;
  const alreadyNotified = options.alreadyNotifiedChannels ?? new Set<string>();

  const result: EnforcementResult = {
    deletedCount: 0,
    deleteFailures: 0,
    timedOut: false,
    dryRun,
    notifiedChannels: [],
    modLogSent: false,
  };

  const thumbnailUrl = await findThumbnailUrl(guild, cluster);
  const authorDisplay = await resolveAuthorDisplay(guild, cluster.authorId);

  for (const cached of cluster.messages) {
    try {
      const channel = await guild.channels.fetch(cached.channelId);
      if (!channel?.isTextBased()) {
        result.deleteFailures++;
        continue;
      }
      const message = await channel.messages.fetch(cached.messageId);
      await message.delete();
      result.deletedCount++;
    } catch (error) {
      result.deleteFailures++;
      loggers.moderation.warn("Failed to delete spam message", {
        guildId: cluster.guildId,
        messageId: cached.messageId,
        channelId: cached.channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!dryRun && !skipTimeout) {
    const timeoutMs = config.timeoutMinutes * 60 * 1000;
    try {
      const member = await guild.members.fetch(cluster.authorId);
      await member.timeout(timeoutMs, "Compromised account spam protection");
      result.timedOut = true;
    } catch (error) {
      result.timeoutError =
        error instanceof Error ? error.message : String(error);
      loggers.moderation.warn("Failed to timeout spam author", {
        guildId: cluster.guildId,
        authorId: cluster.authorId,
        error: result.timeoutError,
      });
    }
  }

  const channelIds = [...new Set(cluster.messages.map((message) => message.channelId))];
  const embed = buildPublicNoticeEmbed({
    authorId: cluster.authorId,
    authorTag: authorDisplay.tag,
    mentionLine: authorDisplay.mentionLine,
    channelIds,
    config,
    dryRun,
    timedOut: result.timedOut,
    thumbnailUrl,
  });

  for (const channelId of channelIds) {
    if (alreadyNotified.has(channelId)) {
      continue;
    }
    try {
      const channel = await guild.channels.fetch(channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) {
        continue;
      }
      await channel.send({
        embeds: [embed],
        allowedMentions: NO_MENTIONS,
      });
      result.notifiedChannels.push(channelId);
    } catch (error) {
      loggers.moderation.warn("Failed to post public notice", {
        guildId: cluster.guildId,
        channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!skipModLog) {
    result.modLogSent = await sendModLog(
      guild,
      cluster,
      config,
      result,
      dryRun,
      authorDisplay,
      thumbnailUrl,
    );
  }

  return result;
}

async function sendModLog(
  guild: Guild,
  cluster: SpamCluster,
  config: RolePingSpamConfig,
  result: EnforcementResult,
  dryRun: boolean,
  authorDisplay: { tag: string; mentionLine: string },
  thumbnailUrl?: string,
): Promise<boolean> {
  try {
    const modChannel = await guild.channels.fetch(config.modLogChannelId);
    if (!modChannel?.isTextBased() || modChannel.isDMBased()) {
      loggers.moderation.warn("Mod log channel unavailable", {
        guildId: cluster.guildId,
        modLogChannelId: config.modLogChannelId,
      });
      return false;
    }

    const channelIds = [...new Set(cluster.messages.map((message) => message.channelId))];
    const channelMentions = channelIds.map((channelId) => `<#${channelId}>`).join("\n");
    const messageLinks = cluster.messages
      .map(
        (message) =>
          `[\`${message.messageId}\`](https://discord.com/channels/${cluster.guildId}/${message.channelId}/${message.messageId})`,
      )
      .join("\n");

    let description = dryRun
      ? `**${authorDisplay.tag}** (\`${cluster.authorId}\`) was flagged and their messages were deleted. Moderators were notified (dry run — no timeout).`
      : `**${authorDisplay.tag}** (\`${cluster.authorId}\`) was automatically timed out and their messages were deleted.`;

    if (config.modPingRoleId && !dryRun) {
      description += `\n\n<@&${config.modPingRoleId}>`;
    }

    const embed = new EmbedBuilder()
      .setColor(dryRun ? Colors.Orange : Colors.Red)
      .setTitle(
        dryRun
          ? "Compromised account spam detected (dry run)"
          : "Compromised account spam detected",
      )
      .setDescription(description);

    const timeoutValue = dryRun
      ? "Skipped (dry run)"
      : result.timedOut
        ? `${config.timeoutMinutes} min`
        : `Failed: ${result.timeoutError ?? "unknown"}`;

    embed
      .addFields(
        { name: "User", value: authorDisplay.mentionLine, inline: false },
        {
          name: `Channels posted in (${channelIds.length})`,
          value: channelMentions || "—",
          inline: false,
        },
        { name: "Reason", value: buildEnforcementReason(config), inline: false },
        { name: "Messages", value: String(cluster.messages.length), inline: true },
        {
          name: "Deleted",
          value: `${result.deletedCount} (${result.deleteFailures} failed)`,
          inline: true,
        },
        { name: "Timeout", value: timeoutValue, inline: true },
        { name: "Message IDs", value: messageLinks || "—", inline: false },
      )
      .setTimestamp();

    if (thumbnailUrl) {
      embed.setImage(thumbnailUrl);
    }

    const allowedMentions =
      config.modPingRoleId && !dryRun
        ? { roles: [config.modPingRoleId] }
        : NO_MENTIONS;

    await (modChannel as TextChannel).send({
      embeds: [embed],
      allowedMentions,
    });

    loggers.moderation.info("Enforced compromised account spam protection", {
      guildId: cluster.guildId,
      authorId: cluster.authorId,
      messageCount: cluster.messages.length,
      deletedCount: result.deletedCount,
      timedOut: result.timedOut,
      dryRun,
    });

    return true;
  } catch (error) {
    loggers.moderation.error(
      "Failed to send mod log for spam cluster",
      error,
      { guildId: cluster.guildId },
    );
    return false;
  }
}
