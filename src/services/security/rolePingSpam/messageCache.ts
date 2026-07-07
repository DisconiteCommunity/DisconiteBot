import type {
  CachedSpamMessage,
  RolePingSpamConfig,
  SpamCluster,
} from "./types.js";
import { rolePingSpamDebug } from "./debugLog.js";

const guildEntries = new Map<string, CachedSpamMessage[]>();
const handledKeys = new Map<string, number>();

function handledKey(guildId: string, authorId: string, fingerprint: string): string {
  return `${guildId}:${authorId}:${fingerprint}`;
}

export function addCachedMessage(
  entry: CachedSpamMessage & { guildId: string },
  debugLogging?: boolean,
): void {
  const { guildId, ...rest } = entry;
  const list = guildEntries.get(guildId) ?? [];
  list.push(rest);
  guildEntries.set(guildId, list);

  rolePingSpamDebug(debugLogging, "Message cached", {
    guildId,
    messageId: rest.messageId,
    channelId: rest.channelId,
    authorId: rest.authorId,
    fingerprint: rest.fingerprint,
    cacheSize: list.length,
  });
}

export function pruneExpiredEntries(now = Date.now()): void {
  for (const [guildId, entries] of guildEntries.entries()) {
    const kept = entries.filter((entry) => now - entry.createdAt < 86_400_000);
    if (kept.length === 0) {
      guildEntries.delete(guildId);
    } else {
      guildEntries.set(guildId, kept);
    }
  }

  for (const [key, expiresAt] of handledKeys.entries()) {
    if (expiresAt <= now) {
      handledKeys.delete(key);
    }
  }
}

export function pruneGuildEntries(
  guildId: string,
  cacheRetentionMs: number,
  now = Date.now(),
  debugLogging?: boolean,
): void {
  const entries = guildEntries.get(guildId);
  if (!entries) {
    return;
  }
  const kept = entries.filter((entry) => now - entry.createdAt < cacheRetentionMs);
  const pruned = entries.length - kept.length;
  if (pruned > 0) {
    rolePingSpamDebug(debugLogging, "Pruned expired cache entries", {
      guildId,
      pruned,
      remaining: kept.length,
      cacheRetentionMs,
    });
  }
  if (kept.length === 0) {
    guildEntries.delete(guildId);
  } else {
    guildEntries.set(guildId, kept);
  }
}

export function isRecentlyHandled(
  guildId: string,
  authorId: string,
  fingerprint: string,
  now = Date.now(),
): boolean {
  const expiresAt = handledKeys.get(handledKey(guildId, authorId, fingerprint));
  return expiresAt !== undefined && expiresAt > now;
}

export function markHandled(
  guildId: string,
  authorId: string,
  fingerprint: string,
  cacheRetentionMs: number,
  now = Date.now(),
  debugLogging?: boolean,
): void {
  handledKeys.set(
    handledKey(guildId, authorId, fingerprint),
    now + cacheRetentionMs,
  );

  rolePingSpamDebug(debugLogging, "Cluster marked handled", {
    guildId,
    authorId,
    fingerprint,
    suppressUntilMs: now + cacheRetentionMs,
  });
}

export function detectSpamCluster(
  guildId: string,
  authorId: string,
  fingerprint: string,
  config: Pick<
    RolePingSpamConfig,
    "minChannels" | "minMessages" | "windowMs" | "cacheRetentionMs" | "debugLogging"
  >,
  now = Date.now(),
): SpamCluster | null {
  if (isRecentlyHandled(guildId, authorId, fingerprint, now)) {
    rolePingSpamDebug(config.debugLogging, "Cluster check skipped (recently handled)", {
      guildId,
      authorId,
      fingerprint,
    });
    return null;
  }

  const entries = guildEntries.get(guildId) ?? [];
  const matching = entries.filter(
    (entry) =>
      entry.authorId === authorId &&
      entry.fingerprint === fingerprint &&
      now - entry.createdAt <= config.cacheRetentionMs,
  );

  const inWindow = matching.filter(
    (entry) => now - entry.createdAt <= config.windowMs,
  );

  const distinctChannels = new Set(inWindow.map((entry) => entry.channelId));
  const channelCount = distinctChannels.size;
  const messageCount = inWindow.length;

  if (channelCount < config.minChannels) {
    rolePingSpamDebug(config.debugLogging, "Cluster not met (channels)", {
      guildId,
      authorId,
      fingerprint,
      channelCount,
      requiredChannels: config.minChannels,
      messageCount,
      requiredMessages: config.minMessages,
      matchingInCache: matching.length,
      inWindow: messageCount,
      messages: inWindow.map((entry) => ({
        messageId: entry.messageId,
        channelId: entry.channelId,
        ageMs: now - entry.createdAt,
      })),
    });
    return null;
  }
  if (messageCount < config.minMessages) {
    rolePingSpamDebug(config.debugLogging, "Cluster not met (messages)", {
      guildId,
      authorId,
      fingerprint,
      channelCount,
      requiredChannels: config.minChannels,
      messageCount,
      requiredMessages: config.minMessages,
      matchingInCache: matching.length,
      inWindow: messageCount,
      messages: inWindow.map((entry) => ({
        messageId: entry.messageId,
        channelId: entry.channelId,
        ageMs: now - entry.createdAt,
      })),
    });
    return null;
  }

  rolePingSpamDebug(config.debugLogging, "Spam cluster detected", {
    guildId,
    authorId,
    fingerprint,
    channelCount,
    messageCount,
    messages: inWindow.map((entry) => ({
      messageId: entry.messageId,
      channelId: entry.channelId,
      ageMs: now - entry.createdAt,
    })),
  });

  return {
    guildId,
    authorId,
    fingerprint,
    messages: inWindow,
  };
}

export function removeClusterMessages(
  cluster: SpamCluster,
  debugLogging?: boolean,
): void {
  const entries = guildEntries.get(cluster.guildId);
  if (!entries) {
    return;
  }
  const removeIds = new Set(cluster.messages.map((message) => message.messageId));
  const kept = entries.filter((entry) => !removeIds.has(entry.messageId));

  rolePingSpamDebug(debugLogging, "Removed cluster messages from cache", {
    guildId: cluster.guildId,
    removed: cluster.messages.length,
    remaining: kept.length,
    messageIds: cluster.messages.map((message) => message.messageId),
  });

  if (kept.length === 0) {
    guildEntries.delete(cluster.guildId);
  } else {
    guildEntries.set(cluster.guildId, kept);
  }
}

/** Test helper — clears all in-memory state. */
export function resetMessageCacheForTests(): void {
  guildEntries.clear();
  handledKeys.clear();
}

/** Test helper — returns entries for a guild. */
export function getGuildEntriesForTests(guildId: string): CachedSpamMessage[] {
  return [...(guildEntries.get(guildId) ?? [])];
}
