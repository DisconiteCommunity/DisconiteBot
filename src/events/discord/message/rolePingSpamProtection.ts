import { Discord, On } from "discordx";
import type { Message } from "discord.js";
import { loggers } from "../../../utility/logging/logger.js";
import { getRolePingSpamConfig } from "../../../services/security/rolePingSpam/configCache.js";
import { rolePingSpamDebug } from "../../../services/security/rolePingSpam/debugLog.js";
import {
  fingerprintFromMessage,
  hasRoleMention,
  messageMeetsImageThreshold,
  countImageAttachments,
} from "../../../services/security/rolePingSpam/fingerprint.js";
import {
  addCachedMessage,
  detectSpamCluster,
  markHandled,
  pruneGuildEntries,
  removeClusterMessages,
} from "../../../services/security/rolePingSpam/messageCache.js";
import { enforceSpamCluster } from "../../../services/security/rolePingSpam/enforcer.js";
import { isDryRunUser } from "../../../services/security/rolePingSpam/types.js";

@Discord()
export class RolePingSpamProtectionEvent {
  @On({ event: "messageCreate" })
  async onMessageCreate([message]: Message[]): Promise<void> {
    if (!message.guild || message.author.bot) {
      return;
    }

    const guildId = message.guild.id;
    const config = getRolePingSpamConfig(guildId);
    if (!config) {
      return;
    }

    const debug = config.debugLogging;
    const baseContext = {
      guildId,
      messageId: message.id,
      channelId: message.channelId,
      authorId: message.author.id,
    };

    const hasRole = hasRoleMention(message);
    const imageCount = countImageAttachments(message.attachments);
    const meetsImages = messageMeetsImageThreshold(message, config.minImages);

    if (!hasRole || !meetsImages) {
      rolePingSpamDebug(debug, "Message ignored (criteria not met)", {
        ...baseContext,
        hasRoleMention: hasRole,
        imageCount,
        requiredImages: config.minImages,
      });
      return;
    }

    const fingerprint = fingerprintFromMessage(message);
    if (!fingerprint) {
      rolePingSpamDebug(debug, "Message ignored (no fingerprint)", {
        ...baseContext,
        hasRoleMention: hasRole,
        imageCount,
      });
      return;
    }

    const now = Date.now();
    pruneGuildEntries(guildId, config.cacheRetentionMs, now, debug);

    rolePingSpamDebug(debug, "Message candidate accepted", {
      ...baseContext,
      fingerprint,
      imageCount,
      roleMentionCount: message.mentions.roles.size,
    });

    addCachedMessage(
      {
        guildId,
        messageId: message.id,
        channelId: message.channelId,
        authorId: message.author.id,
        fingerprint,
        createdAt: now,
      },
      debug,
    );

    const cluster = detectSpamCluster(
      guildId,
      message.author.id,
      fingerprint,
      config,
      now,
    );
    if (!cluster) {
      return;
    }

    markHandled(
      guildId,
      cluster.authorId,
      cluster.fingerprint,
      config.cacheRetentionMs,
      now,
      debug,
    );
    removeClusterMessages(cluster, debug);

    try {
      const dryRun = isDryRunUser(config, cluster.authorId);
      rolePingSpamDebug(debug, "Enforcing spam cluster", {
        guildId,
        authorId: cluster.authorId,
        fingerprint: cluster.fingerprint,
        messageCount: cluster.messages.length,
        dryRun,
      });
      await enforceSpamCluster(message.guild, cluster, config, { dryRun });
    } catch (error) {
      loggers.moderation.error(
        "Failed to enforce compromised account spam protection",
        error,
        { guildId, authorId: cluster.authorId },
      );
    }
  }
}
