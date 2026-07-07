import type { Guild } from "discord.js";
import { setImmediate } from "node:timers";
import { rolePingSpamDebug } from "./debugLog.js";
import { enforceSpamCluster } from "./enforcer.js";
import {
  collectAuthorEntries,
  dedupeMessages,
  markHandled,
  removeClusterMessages,
  removeMessagesByIds,
} from "./messageCache.js";
import type { CachedSpamMessage, RolePingSpamConfig, SpamCluster } from "./types.js";

interface ActiveEnforcement {
  pendingMessages: CachedSpamMessage[];
  notifiedChannels: Set<string>;
}

const activeByAuthor = new Map<string, ActiveEnforcement>();

function enforcementKey(guildId: string, authorId: string): string {
  return `${guildId}:${authorId}`;
}

export function isAuthorUnderEnforcement(guildId: string, authorId: string): boolean {
  return activeByAuthor.has(enforcementKey(guildId, authorId));
}

export function enqueueMessageDuringEnforcement(
  guildId: string,
  authorId: string,
  message: CachedSpamMessage,
): void {
  const state = activeByAuthor.get(enforcementKey(guildId, authorId));
  if (!state) {
    return;
  }
  state.pendingMessages.push(message);
}

function appendClusterToPending(cluster: SpamCluster): void {
  const state = activeByAuthor.get(enforcementKey(cluster.guildId, cluster.authorId));
  if (!state) {
    return;
  }
  state.pendingMessages.push(...cluster.messages);
}

function tryBeginEnforcement(guildId: string, authorId: string): boolean {
  const key = enforcementKey(guildId, authorId);
  if (activeByAuthor.has(key)) {
    return false;
  }
  activeByAuthor.set(key, {
    pendingMessages: [],
    notifiedChannels: new Set(),
  });
  return true;
}

function endEnforcement(guildId: string, authorId: string): void {
  activeByAuthor.delete(enforcementKey(guildId, authorId));
}

export async function orchestrateSpamEnforcement(
  guild: Guild,
  initialCluster: SpamCluster,
  config: RolePingSpamConfig,
  dryRun: boolean,
  debugLogging?: boolean,
): Promise<void> {
  if (!tryBeginEnforcement(initialCluster.guildId, initialCluster.authorId)) {
    appendClusterToPending(initialCluster);
    removeClusterMessages(initialCluster, debugLogging);
    rolePingSpamDebug(debugLogging, "Cluster queued during active enforcement", {
      guildId: initialCluster.guildId,
      authorId: initialCluster.authorId,
      messageCount: initialCluster.messages.length,
    });
    return;
  }

  const key = enforcementKey(initialCluster.guildId, initialCluster.authorId);
  const state = activeByAuthor.get(key);
  if (!state) {
    return;
  }

  try {
    markHandled(
      initialCluster.guildId,
      initialCluster.authorId,
      initialCluster.fingerprint,
      config.cacheRetentionMs,
      Date.now(),
      debugLogging,
    );
    removeClusterMessages(initialCluster, debugLogging);

    let isFirstPass = true;
    let batch = dedupeMessages([...initialCluster.messages]);

    while (batch.length > 0) {
      rolePingSpamDebug(debugLogging, "Enforcing spam batch", {
        guildId: initialCluster.guildId,
        authorId: initialCluster.authorId,
        messageCount: batch.length,
        isFirstPass,
      });

      const cluster: SpamCluster = {
        ...initialCluster,
        messages: batch,
      };

      const result = await enforceSpamCluster(guild, cluster, config, {
        dryRun,
        skipTimeout: !isFirstPass,
        skipModLog: !isFirstPass,
        alreadyNotifiedChannels: state.notifiedChannels,
      });

      for (const channelId of result.notifiedChannels) {
        state.notifiedChannels.add(channelId);
      }

      isFirstPass = false;
      batch = [];

      await new Promise<void>((resolve) => {
        setImmediate(() => {
          resolve();
        });
      });

      const pending = state.pendingMessages.splice(0);
      const cached = collectAuthorEntries(
        initialCluster.guildId,
        initialCluster.authorId,
      );
      const nextBatch = dedupeMessages([...pending, ...cached]);

      if (nextBatch.length > 0) {
        removeMessagesByIds(
          initialCluster.guildId,
          nextBatch.map((message) => message.messageId),
          debugLogging,
        );
        batch = nextBatch;
        rolePingSpamDebug(debugLogging, "Follow-up spam batch collected", {
          guildId: initialCluster.guildId,
          authorId: initialCluster.authorId,
          messageCount: batch.length,
        });
      }
    }
  } finally {
    endEnforcement(initialCluster.guildId, initialCluster.authorId);
  }
}

/** Test helper */
export function resetAuthorEnforcementForTests(): void {
  activeByAuthor.clear();
}
