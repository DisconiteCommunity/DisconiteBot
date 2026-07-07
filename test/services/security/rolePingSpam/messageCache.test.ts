import { describe, it, expect, beforeEach } from "vitest";
import {
  addCachedMessage,
  collectAuthorEntries,
  dedupeMessages,
  detectSpamCluster,
  isRecentlyHandled,
  markHandled,
  resetMessageCacheForTests,
} from "../../../../src/services/security/rolePingSpam/messageCache.js";

const config = {
  minChannels: 2,
  minMessages: 3,
  windowMs: 3000,
  cacheRetentionMs: 60_000,
  debugLogging: false,
};

function addEntry(
  guildId: string,
  authorId: string,
  fingerprint: string,
  channelId: string,
  messageId: string,
  createdAt: number,
): void {
  addCachedMessage({
    guildId,
    authorId,
    fingerprint,
    channelId,
    messageId,
    createdAt,
  });
}

describe("messageCache", () => {
  beforeEach(() => {
    resetMessageCacheForTests();
  });

  it("detects cluster across channels within window", () => {
    const now = 1_000_000;
    addEntry("g1", "u1", "fp", "c1", "m1", now - 2000);
    addEntry("g1", "u1", "fp", "c2", "m2", now - 1000);
    addEntry("g1", "u1", "fp", "c1", "m3", now - 500);

    const cluster = detectSpamCluster("g1", "u1", "fp", config, now);
    expect(cluster).not.toBeNull();
    expect(cluster!.messages).toHaveLength(3);
  });

  it("rejects when not enough distinct channels", () => {
    const now = 1_000_000;
    addEntry("g1", "u1", "fp", "c1", "m1", now - 2000);
    addEntry("g1", "u1", "fp", "c1", "m2", now - 1000);
    addEntry("g1", "u1", "fp", "c1", "m3", now - 500);

    expect(detectSpamCluster("g1", "u1", "fp", config, now)).toBeNull();
  });

  it("rejects messages outside window", () => {
    const now = 1_000_000;
    addEntry("g1", "u1", "fp", "c1", "m1", now - 5000);
    addEntry("g1", "u1", "fp", "c2", "m2", now - 1000);
    addEntry("g1", "u1", "fp", "c3", "m3", now - 500);

    expect(detectSpamCluster("g1", "u1", "fp", config, now)).toBeNull();
  });

  it("debounces recently handled clusters", () => {
    const now = 1_000_000;
    markHandled("g1", "u1", "fp", config.cacheRetentionMs, now);
    addEntry("g1", "u1", "fp", "c1", "m1", now - 500);
    addEntry("g1", "u1", "fp", "c2", "m2", now - 400);
    addEntry("g1", "u1", "fp", "c3", "m3", now - 300);

    expect(isRecentlyHandled("g1", "u1", "fp", now)).toBe(true);
    expect(detectSpamCluster("g1", "u1", "fp", config, now)).toBeNull();
  });

  it("collects all entries for an author", () => {
    addEntry("g1", "u1", "fp1", "c1", "m1", 100);
    addEntry("g1", "u1", "fp2", "c2", "m2", 200);
    addEntry("g1", "u2", "fp1", "c3", "m3", 300);

    expect(collectAuthorEntries("g1", "u1")).toHaveLength(2);
    expect(collectAuthorEntries("g1", "u2")).toHaveLength(1);
  });

  it("dedupes messages by message ID", () => {
    const messages = dedupeMessages([
      { messageId: "m1", channelId: "c1", authorId: "u1", fingerprint: "fp", createdAt: 1 },
      { messageId: "m1", channelId: "c1", authorId: "u1", fingerprint: "fp", createdAt: 1 },
      { messageId: "m2", channelId: "c2", authorId: "u1", fingerprint: "fp", createdAt: 2 },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.messageId)).toEqual(["m1", "m2"]);
  });
});
