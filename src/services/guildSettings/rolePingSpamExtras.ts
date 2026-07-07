import type { Prisma } from "../../generated/prisma/client.js";
import { Prisma as PrismaNamespace } from "../../generated/prisma/client.js";
import {
  DEFAULT_ROLE_PING_SPAM_CONFIG,
  ROLE_PING_SPAM_EXTRAS_KEY,
  rolePingSpamConfigSchema,
  type RolePingSpamConfig,
} from "../security/rolePingSpam/types.js";

type GuildExtras = Record<string, unknown>;

function asExtrasRecord(extras: Prisma.JsonValue | null | undefined): GuildExtras {
  if (extras === null || extras === undefined) {
    return {};
  }
  if (typeof extras === "object" && !Array.isArray(extras)) {
    return extras as GuildExtras;
  }
  return {};
}

export function readRolePingSpamConfig(
  extras: Prisma.JsonValue | null | undefined,
): RolePingSpamConfig | null {
  const record = asExtrasRecord(extras);
  const raw = record[ROLE_PING_SPAM_EXTRAS_KEY];
  if (raw === undefined || raw === null) {
    return null;
  }
  const parsed = rolePingSpamConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export function mergeRolePingSpamConfig(
  extras: Prisma.JsonValue | null | undefined,
  patch: Partial<RolePingSpamConfig> & { modLogChannelId: string },
): { extras: Prisma.InputJsonValue | null; config: RolePingSpamConfig } {
  const record = asExtrasRecord(extras);
  const existing = readRolePingSpamConfig(extras);

  const merged = rolePingSpamConfigSchema.parse({
    ...DEFAULT_ROLE_PING_SPAM_CONFIG,
    ...existing,
    ...patch,
    enabled: patch.enabled ?? existing?.enabled ?? true,
    modLogChannelId: patch.modLogChannelId,
  });

  const nextExtras: GuildExtras = {
    ...record,
    [ROLE_PING_SPAM_EXTRAS_KEY]: merged,
  };

  return {
    extras: nextExtras as Prisma.InputJsonValue,
    config: merged,
  };
}

export function clearRolePingSpamConfig(
  extras: Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | null {
  const record = asExtrasRecord(extras);
  const { [ROLE_PING_SPAM_EXTRAS_KEY]: _removed, ...rest } = record;
  if (Object.keys(rest).length === 0) {
    return null;
  }
  return rest as Prisma.InputJsonValue;
}

export function extrasToPrismaUpdate(
  extras: Prisma.InputJsonValue | null,
): Prisma.InputJsonValue | typeof PrismaNamespace.DbNull {
  return extras === null ? PrismaNamespace.DbNull : extras;
}
