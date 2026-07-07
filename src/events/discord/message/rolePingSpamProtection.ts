import { Discord, On } from "discordx";
import type { Message } from "discord.js";
import { prisma } from "../../../main.js";
import { loggers } from "../../../utility/logging/logger.js";
import { getRolePingSpamConfig } from "../../../services/security/rolePingSpam/configCache.js";
import {
  enqueueMessageDuringEnforcement,
  isAuthorUnderEnforcement,
  orchestrateSpamEnforcement,
} from "../../../services/security/rolePingSpam/authorEnforcement.js";
import { hasRolePingSpamPermissions } from "../../../services/security/rolePingSpam/botPermissions.js";
import { maybeAutoDisableRolePingSpam } from "../../../services/security/rolePingSpam/permissionSync.js";
import { rolePingSpamDebug } from "../../../services/security/rolePingSpam/debugLog.js";
import {
  fingerprintFromMessage,
  hasSpamPingMention,
  messageMeetsImageThreshold,
  countImageAttachments,
} from "../../../services/security/rolePingSpam/fingerprint.js";
import {
  addCachedMessage,
  detectSpamCluster,
  pruneGuildEntries,
} from "../../../services/security/rolePingSpam/messageCache.js";
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

    if (!hasRolePingSpamPermissions(message.guild.members.me)) {
      void maybeAutoDisableRolePingSpam(prisma, message.guild);
      return;
    }

    const debug = config.debugLogging;
    const baseContext = {
      guildId,
      messageId: message.id,
      channelId: message.channelId,
      authorId: message.author.id,
    };

    const hasPing = hasSpamPingMention(message);
    const imageCount = countImageAttachments(message.attachments);
    const meetsImages = messageMeetsImageThreshold(message, config.minImages);

    if (!hasPing || !meetsImages) {
      rolePingSpamDebug(debug, "Message ignored (criteria not met)", {
        ...baseContext,
        hasPingMention: hasPing,
        mentionsEveryone: message.mentions.everyone,
        roleMentionCount: message.mentions.roles.size,
        imageCount,
        requiredImages: config.minImages,
      });
      return;
    }

    const fingerprint = fingerprintFromMessage(message);
    if (!fingerprint) {
      rolePingSpamDebug(debug, "Message ignored (no fingerprint)", {
        ...baseContext,
        hasPingMention: hasPing,
        mentionsEveryone: message.mentions.everyone,
        roleMentionCount: message.mentions.roles.size,
        imageCount,
      });
      return;
    }

    const now = Date.now();
    pruneGuildEntries(guildId, config.cacheRetentionMs, now, debug);

    if (isAuthorUnderEnforcement(guildId, message.author.id)) {
      enqueueMessageDuringEnforcement(guildId, message.author.id, {
        messageId: message.id,
        channelId: message.channelId,
        authorId: message.author.id,
        fingerprint,
        createdAt: now,
      });
      void message.delete().catch((error) => {
        loggers.moderation.warn("Failed to delete spam message during enforcement", {
          guildId,
          messageId: message.id,
          channelId: message.channelId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      rolePingSpamDebug(debug, "Message queued during active enforcement", {
        ...baseContext,
        fingerprint,
        imageCount,
      });
      return;
    }

    rolePingSpamDebug(debug, "Message candidate accepted", {
      ...baseContext,
      fingerprint,
      imageCount,
      mentionsEveryone: message.mentions.everyone,
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

    const dryRun = isDryRunUser(config, cluster.authorId);
    rolePingSpamDebug(debug, "Starting spam enforcement", {
      guildId,
      authorId: cluster.authorId,
      fingerprint: cluster.fingerprint,
      messageCount: cluster.messages.length,
      dryRun,
    });

    try {
      await orchestrateSpamEnforcement(
        message.guild,
        cluster,
        config,
        dryRun,
        debug,
      );
    } catch (error) {
      loggers.moderation.error(
        "Failed to enforce compromised account spam protection",
        error,
        { guildId, authorId: cluster.authorId },
      );
    }
  }
}
