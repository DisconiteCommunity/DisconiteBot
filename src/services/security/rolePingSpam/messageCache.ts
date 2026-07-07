import type {
  CachedSpamMessage,
  RolePingSpamConfig,
  SpamCluster,
} from "./types.js";

const guildEntries = new Map<string, CachedSpamMessage[]>();
const handledKeys = new Map<string, number>();

function handledKey(guildId: string, authorId: string, fingerprint: string): string {
  return `${guildId}:${authorId}:${fingerprint}`;
}

export function addCachedMessage(entry: CachedSpamMessage & { guildId: string }): void {
  const { guildId, ...rest } = entry;
  const list = guildEntries.get(guildId) ?? [];
  list.push(rest);
  guildEntries.set(guildId, list);
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
): void {
  const entries = guildEntries.get(guildId);
  if (!entries) {
    return;
  }
  const kept = entries.filter((entry) => now - entry.createdAt < cacheRetentionMs);
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
): void {
  handledKeys.set(
    handledKey(guildId, authorId, fingerprint),
    now + cacheRetentionMs,
  );
}

export function detectSpamCluster(
  guildId: string,
  authorId: string,
  fingerprint: string,
  config: Pick<
    RolePingSpamConfig,
    "minChannels" | "minMessages" | "windowMs" | "cacheRetentionMs"
  >,
  now = Date.now(),
): SpamCluster | null {
  if (isRecentlyHandled(guildId, authorId, fingerprint, now)) {
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
  if (distinctChannels.size < config.minChannels) {
    return null;
  }
  if (inWindow.length < config.minMessages) {
    return null;
  }

  return {
    guildId,
    authorId,
    fingerprint,
    messages: inWindow,
  };
}

export function removeClusterMessages(cluster: SpamCluster): void {
  const entries = guildEntries.get(cluster.guildId);
  if (!entries) {
    return;
  }
  const removeIds = new Set(cluster.messages.map((message) => message.messageId));
  const kept = entries.filter((entry) => !removeIds.has(entry.messageId));
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
