import type { PrismaClient } from "../../../generated/prisma/client.js";
import { readRolePingSpamConfig } from "../../guildSettings/rolePingSpamExtras.js";
import type { RolePingSpamConfig } from "./types.js";

const configByGuild = new Map<string, RolePingSpamConfig>();

export function getRolePingSpamConfig(guildId: string): RolePingSpamConfig | null {
  const config = configByGuild.get(guildId);
  if (!config?.enabled) {
    return null;
  }
  return config;
}

export function setRolePingSpamConfig(
  guildId: string,
  config: RolePingSpamConfig | null,
): void {
  if (config === null || !config.enabled) {
    configByGuild.delete(guildId);
    return;
  }
  configByGuild.set(guildId, config);
}

export async function loadRolePingSpamConfigCache(
  db: PrismaClient,
): Promise<void> {
  configByGuild.clear();
  const rows = await db.guildSettings.findMany({
    select: { guildId: true, extras: true },
  });

  for (const row of rows) {
    if (row.extras === null || row.extras === undefined) {
      continue;
    }
    const config = readRolePingSpamConfig(row.extras);
    if (config?.enabled) {
      configByGuild.set(row.guildId, config);
    }
  }
}

export function getEnabledGuildCount(): number {
  return configByGuild.size;
}

/** Test helper */
export function resetConfigCacheForTests(): void {
  configByGuild.clear();
}
