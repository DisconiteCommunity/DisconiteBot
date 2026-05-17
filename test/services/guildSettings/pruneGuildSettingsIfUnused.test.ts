import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { pruneGuildSettingsIfUnused } from "../../../src/services/guildSettings/pruneGuildSettingsIfUnused.js";

describe("pruneGuildSettingsIfUnused", () => {
  it("deletes row when metrics cleared and extras absent", async () => {
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    const findSpy = vi.fn().mockResolvedValueOnce({
      guildId: "g1",
      metricsChannelId: null,
      metricsMessageId: null,
      metricsWorldPreviews: false,
      extras: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const prisma = {
      guildSettings: {
        findUnique: findSpy,
        delete: deleteSpy,
      },
    } as unknown as PrismaClient;

    await pruneGuildSettingsIfUnused(prisma, "g1");

    expect(deleteSpy).toHaveBeenCalledWith({ where: { guildId: "g1" } });
  });

  it("keeps row when extras JSON is set", async () => {
    const deleteSpy = vi.fn();
    const findSpy = vi.fn().mockResolvedValueOnce({
      guildId: "g2",
      metricsChannelId: null,
      metricsMessageId: null,
      metricsWorldPreviews: false,
      extras: { foo: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const prisma = {
      guildSettings: {
        findUnique: findSpy,
        delete: deleteSpy,
      },
    } as unknown as PrismaClient;

    await pruneGuildSettingsIfUnused(prisma, "g2");

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
