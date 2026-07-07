import { Discord, On } from "discordx";
import type { Message } from "discord.js";
import { loggers } from "../../../utility/logging/logger.js";
import { getRolePingSpamConfig } from "../../../services/security/rolePingSpam/configCache.js";
import {
  fingerprintFromMessage,
  hasRoleMention,
  messageMeetsImageThreshold,
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

    if (!hasRoleMention(message) || !messageMeetsImageThreshold(message, config.minImages)) {
      return;
    }

    const fingerprint = fingerprintFromMessage(message);
    if (!fingerprint) {
      return;
    }

    const now = Date.now();
    pruneGuildEntries(guildId, config.cacheRetentionMs, now);

    addCachedMessage({
      guildId,
      messageId: message.id,
      channelId: message.channelId,
      authorId: message.author.id,
      fingerprint,
      createdAt: now,
    });

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
    );
    removeClusterMessages(cluster);

    try {
      const dryRun = isDryRunUser(config, cluster.authorId);
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
