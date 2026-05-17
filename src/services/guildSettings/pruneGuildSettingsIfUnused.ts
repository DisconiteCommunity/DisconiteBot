import type { PrismaClient } from "../../generated/prisma/client.js";

/**
 * Removes a guild_settings row when it no longer holds metrics or extras JSON.
 * Keeps the row if `extras` is present so future guild prefs survive metrics unregister.
 */
export async function pruneGuildSettingsIfUnused(
  db: PrismaClient,
  guildId: string,
): Promise<void> {
  const row = await db.guildSettings.findUnique({ where: { guildId } });
  if (!row) {
    return;
  }
  const hasMetrics = row.metricsChannelId !== null;
  const hasExtras = row.extras !== null && row.extras !== undefined;
  if (!hasMetrics && !hasExtras) {
    await db.guildSettings.delete({ where: { guildId } });
  }
}
