import type { ContainerBuilder } from "@discordjs/builders";
import type { Client } from "discord.js";
import { ActivityType, DiscordAPIError } from "discord.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { getEnv } from "../../../config/env.js";
import { loggers } from "../../../utility/logging/logger.js";
import {
  fetchResoniteSessions,
  fetchResoniteCloudStats,
  fetchResoniteOnlineStats,
} from "./resoniteMetricsFetch.js";
import {
  buildMetricsMessageComponents,
  publishMetricsMessage,
} from "./resoniteMetricsComponentsV2.js";
import { formatMetricsMarkdown } from "./resoniteMetricsFormat.js";
import { pruneGuildSettingsIfUnused } from "../../guildSettings/pruneGuildSettingsIfUnused.js";

export type ResoniteMetricsPollerOptions = {
  pollSeconds: number;
  maxRetries: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function resolveMetricsPollerOptionsFromEnv(): ResoniteMetricsPollerOptions {
  const env = getEnv();
  return {
    pollSeconds: clamp(parseEnvInt(env.RESONITE_METRICS_POLL_SECONDS, 60), 15, 3600),
    maxRetries: clamp(parseEnvInt(env.RESONITE_METRICS_MAX_RETRIES, 300), 1, 10_000),
  };
}

/** Mutable snapshot updated each successful poll (matches upstream bot behaviour). */
export type MetricsBroadcastPayload = {
  componentsPreview: ContainerBuilder[];
  componentsNoPreview: ContainerBuilder[];
};

export function createInitialMetricsPayload(): MetricsBroadcastPayload {
  const fallbackText = "Whoops, something went wrong.";
  return {
    componentsPreview: buildMetricsMessageComponents(fallbackText, [], false),
    componentsNoPreview: buildMetricsMessageComponents(fallbackText, [], false),
  };
}

export async function refreshMetricsPayload(
  payload: MetricsBroadcastPayload,
): Promise<boolean> {
  try {
    const [sessions, cloud, online] = await Promise.all([
      fetchResoniteSessions(),
      fetchResoniteCloudStats(),
      fetchResoniteOnlineStats(),
    ]);
    const markdown = formatMetricsMarkdown({ sessions, cloud, online });
    payload.componentsPreview = buildMetricsMessageComponents(
      markdown,
      sessions,
      true,
    );
    payload.componentsNoPreview = buildMetricsMessageComponents(
      markdown,
      sessions,
      false,
    );
    return true;
  } catch (err) {
    loggers.resonite.error("metrics poll: failed to refresh snapshot", err);
    return false;
  }
}

function shouldCountGuildRetry(err: unknown): boolean {
  if (!(err instanceof DiscordAPIError)) {
    return false;
  }
  switch (err.code) {
    case 10003: // Unknown Channel
    case 10008: // Unknown Message
    case 50001: // Missing Access
    case 50013: // Missing Permissions
      return true;
    default:
      return false;
  }
}

/**
 * Starts periodic polling + message fan-out. Safe to call once after login.
 * Does nothing when `ENV` is `test`.
 */
export function startResoniteMetricsPoller(
  client: Client,
  prisma: PrismaClient,
  opts?: Partial<ResoniteMetricsPollerOptions>,
): void {
  const env = getEnv();
  if (env.ENV === "test") {
    loggers.schedules.info(
      "Skipping Resonite metrics poller in ENV=test",
    );
    return;
  }

  const resolved = {
    ...resolveMetricsPollerOptionsFromEnv(),
    ...opts,
  };

  const payload = createInitialMetricsPayload();
  const guildRetries = new Map<string, number>();

  const tick = async (): Promise<void> => {
    if (!client.isReady()) {
      loggers.resonite.warn("metrics poll skipped: Discord client not ready");
      return;
    }

    await refreshMetricsPayload(payload);

    const subs = await prisma.guildSettings.findMany({
      where: { metricsChannelId: { not: null } },
    });
    if (subs.length === 0) {
      return;
    }

    try {
      await client.user?.setActivity({
        type: ActivityType.Watching,
        name: `Resonite · ${subs.length} communities`,
      });
    } catch {
      /* non-fatal */
    }

    for (const sub of subs) {
      const guildKey = sub.guildId;
      const metricsCh = sub.metricsChannelId;
      if (metricsCh === null) {
        continue;
      }
      try {
        const channel = await client.channels.fetch(metricsCh);
        if (!channel?.isSendable()) {
          throw new Error(`Channel ${metricsCh} is not sendable or missing`);
        }

        const components = sub.metricsWorldPreviews
          ? payload.componentsPreview
          : payload.componentsNoPreview;

        const messageId = await publishMetricsMessage(
          channel,
          sub.metricsMessageId,
          components,
        );

        if (messageId !== sub.metricsMessageId) {
          await prisma.guildSettings.update({
            where: { guildId: sub.guildId },
            data: { metricsMessageId: messageId },
          });
        }

        guildRetries.set(guildKey, 0);
      } catch (err) {
        loggers.resonite.error(
          `metrics poll: guild ${sub.guildId} channel ${metricsCh}`,
          err,
        );

        if (!shouldCountGuildRetry(err)) {
          continue;
        }

        const next = (guildRetries.get(guildKey) ?? 0) + 1;
        guildRetries.set(guildKey, next);

        if (next >= resolved.maxRetries) {
          guildRetries.delete(guildKey);
          try {
            await prisma.guildSettings.update({
              where: { guildId: sub.guildId },
              data: {
                metricsChannelId: null,
                metricsMessageId: null,
                metricsWorldPreviews: false,
              },
            });
            await pruneGuildSettingsIfUnused(prisma, sub.guildId);
            loggers.resonite.warn(
              `Removed Resonite metrics subscription for guild ${sub.guildId} after ${resolved.maxRetries} failures`,
            );
          } catch (delErr) {
            loggers.resonite.error(
              "metrics poll: failed to remove broken subscription",
              delErr,
              { guildId: sub.guildId },
            );
          }
        }
      }
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, resolved.pollSeconds * 1000);

  loggers.schedules.info(
    `Resonite metrics poller started (every ${resolved.pollSeconds}s, maxRetries=${resolved.maxRetries})`,
  );
}
