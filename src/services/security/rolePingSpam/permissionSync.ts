import type { Client, Guild } from "discord.js";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { loggers } from "../../../utility/logging/logger.js";
import {
  extrasToPrismaUpdate,
  mergeRolePingSpamConfig,
  readRolePingSpamConfig,
} from "../../guildSettings/rolePingSpamExtras.js";
import {
  getMissingRolePingSpamPermissions,
  hasRolePingSpamPermissions,
} from "./botPermissions.js";
import { getRolePingSpamConfig, setRolePingSpamConfig } from "./configCache.js";

const autoDisableInFlight = new Set<string>();

export async function disableRolePingSpamForMissingPermissions(
  db: PrismaClient,
  guildId: string,
  extras: Prisma.JsonValue | null | undefined,
  missing: string[],
): Promise<void> {
  const current = readRolePingSpamConfig(extras);
  if (!current?.enabled || !current.modLogChannelId) {
    setRolePingSpamConfig(guildId, null);
    return;
  }

  const { extras: nextExtras } = mergeRolePingSpamConfig(extras, {
    modLogChannelId: current.modLogChannelId,
    enabled: false,
  });

  await db.guildSettings.update({
    where: { guildId },
    data: { extras: extrasToPrismaUpdate(nextExtras) },
  });
  setRolePingSpamConfig(guildId, null);

  loggers.moderation.warn(
    "Auto-disabled compromised account spam protection (missing bot permissions)",
    { guildId, missing },
  );
}

async function resolveGuildMember(guild: Guild) {
  if (guild.members.me) {
    return guild.members.me;
  }
  try {
    return await guild.members.fetchMe();
  } catch {
    return null;
  }
}

export async function maybeAutoDisableRolePingSpam(
  db: PrismaClient,
  guild: Guild,
): Promise<void> {
  if (!getRolePingSpamConfig(guild.id)) {
    return;
  }
  if (hasRolePingSpamPermissions(guild.members.me ?? (await resolveGuildMember(guild)))) {
    return;
  }
  if (autoDisableInFlight.has(guild.id)) {
    return;
  }

  autoDisableInFlight.add(guild.id);
  try {
    const row = await db.guildSettings.findUnique({
      where: { guildId: guild.id },
      select: { extras: true },
    });
    const member = guild.members.me ?? (await resolveGuildMember(guild));
    const missing = getMissingRolePingSpamPermissions(member);
    if (missing.length === 0) {
      return;
    }
    await disableRolePingSpamForMissingPermissions(
      db,
      guild.id,
      row?.extras,
      missing,
    );
  } catch (error) {
    loggers.moderation.error(
      "Failed to auto-disable compromised account spam protection",
      error,
      { guildId: guild.id },
    );
  } finally {
    autoDisableInFlight.delete(guild.id);
  }
}

export async function guildCanRunRolePingSpam(guild: Guild): Promise<boolean> {
  const member = guild.members.me ?? (await resolveGuildMember(guild));
  return hasRolePingSpamPermissions(member);
}

export async function filterRolePingSpamConfigForGuild(
  db: PrismaClient,
  client: Client,
  guildId: string,
  extras: Prisma.JsonValue | null | undefined,
) {
  const config = readRolePingSpamConfig(extras);
  if (!config?.enabled) {
    return null;
  }

  const guild =
    client.guilds.cache.get(guildId) ??
    (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    loggers.moderation.warn(
      "Skipped loading compromised account spam protection (guild unavailable)",
      { guildId },
    );
    return null;
  }

  const member = guild.members.me ?? (await resolveGuildMember(guild));
  const missing = getMissingRolePingSpamPermissions(member);
  if (missing.length > 0) {
    await disableRolePingSpamForMissingPermissions(db, guildId, extras, missing);
    return null;
  }

  return config;
}

/** Test helper */
export function resetPermissionSyncForTests(): void {
  autoDisableInFlight.clear();
}
