import {
  Colors,
  EmbedBuilder,
  type Guild,
  type TextChannel,
} from "discord.js";
import { loggers } from "../../../utility/logging/logger.js";
import type { RolePingSpamConfig, SpamCluster } from "./types.js";

const PUBLIC_NOTICE =
  "If you received a ping in this channel but do not see a message associated with it, that may have been a potentially compromised account. The account has been timed out and moderators will look into why this happened.";

const PUBLIC_NOTICE_DRY_RUN =
  "If you received a ping in this channel but do not see a message associated with it, that may have been a potentially compromised account. Moderators have been notified and are looking into it. (No timeout was applied — dry run.)";

const NO_MENTIONS = { parse: [] as never[] };

export interface EnforcementOptions {
  dryRun?: boolean;
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

export async function enforceSpamCluster(
  guild: Guild,
  cluster: SpamCluster,
  config: RolePingSpamConfig,
  options: EnforcementOptions = {},
): Promise<EnforcementResult> {
  const dryRun = options.dryRun ?? false;
  const result: EnforcementResult = {
    deletedCount: 0,
    deleteFailures: 0,
    timedOut: false,
    dryRun,
    notifiedChannels: [],
    modLogSent: false,
  };

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

  if (!dryRun) {
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

  const notice = dryRun ? PUBLIC_NOTICE_DRY_RUN : PUBLIC_NOTICE;
  const channelIds = [...new Set(cluster.messages.map((message) => message.channelId))];
  for (const channelId of channelIds) {
    try {
      const channel = await guild.channels.fetch(channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) {
        continue;
      }
      await channel.send({
        content: notice,
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

  result.modLogSent = await sendModLog(guild, cluster, config, result, dryRun);
  return result;
}

async function sendModLog(
  guild: Guild,
  cluster: SpamCluster,
  config: RolePingSpamConfig,
  result: EnforcementResult,
  dryRun: boolean,
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

    const channelMentions = [
      ...new Set(cluster.messages.map((message) => `<#${message.channelId}>`)),
    ].join(", ");
    const messageLinks = cluster.messages
      .map((message) => `[\`${message.messageId}\`](https://discord.com/channels/${cluster.guildId}/${message.channelId}/${message.messageId})`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(dryRun ? Colors.Orange : Colors.Red)
      .setTitle(
        dryRun
          ? "Compromised account spam detected (dry run)"
          : "Compromised account spam detected",
      );

    if (config.modPingRoleId && !dryRun) {
      embed.setDescription(`<@&${config.modPingRoleId}>`);
    }

    const timeoutValue = dryRun
      ? "Skipped (dry run)"
      : result.timedOut
        ? `${config.timeoutMinutes} min`
        : `Failed: ${result.timeoutError ?? "unknown"}`;

    embed.addFields(
        { name: "User", value: `<@${cluster.authorId}> (\`${cluster.authorId}\`)`, inline: true },
        { name: "Messages", value: String(cluster.messages.length), inline: true },
        { name: "Channels", value: channelMentions || "—", inline: false },
        { name: "Deleted", value: `${result.deletedCount} (${result.deleteFailures} failed)`, inline: true },
        { name: "Timeout", value: timeoutValue, inline: true },
        { name: "Message IDs", value: messageLinks || "—", inline: false },
      )
      .setTimestamp();

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
