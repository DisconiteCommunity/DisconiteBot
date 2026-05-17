import { stripResoniteRichText } from "../../../utility/text/resoniteRichText.js";
import { buildOpenResoniteSessionUrl } from "../records/records.js";
import type {
  ResoniteOnlineStatsDto,
  ResoniteCloudStatsDto,
  ResoniteSessionDto,
} from "./resoniteMetricsFetch.js";

const EMBED_FIELD_TRUNCATE = 1020;

export function sumNumericRecord(o: Record<string, unknown> | null | undefined): number {
  if (!o || typeof o !== "object") {
    return 0;
  }
  let s = 0;
  for (const v of Object.values(o)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      s += v;
    }
  }
  return s;
}

/** API mixes PascalCase and camelCase on nested stats buckets. */
export function bucketNumeric(
  o: Record<string, unknown> | null | undefined,
  ...names: string[]
): number {
  if (!o) {
    return 0;
  }
  const lower = new Map(
    Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const n of names) {
    const v = lower.get(n.toLowerCase());
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
  }
  return 0;
}

export function truncateField(input: string, max = EMBED_FIELD_TRUNCATE): string {
  if (input.length <= max) {
    return input;
  }
  return `${input.slice(0, max - 3)}...`;
}

function discordTsUnix(iso: string | undefined): number | null {
  if (!iso) {
    return null;
  }
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return Math.floor(ms / 1000);
}

/** Metrics header paragraph matching upstream ResoniteDiscordMetrics `GenerateDataString`. */
export function formatMetricsMarkdown(params: {
  sessions: ResoniteSessionDto[];
  cloud: ResoniteCloudStatsDto;
  online: ResoniteOnlineStatsDto;
}): string {
  const { sessions, cloud, online } = params;

  const versions = new Map<string, number>();
  for (const s of sessions) {
    const v = typeof s.appVersion === "string" ? s.appVersion : "?";
    versions.set(v, (versions.get(v) ?? 0) + 1);
  }
  const versionsSorted = [...versions.entries()].sort((a, b) => b[1] - a[1]);
  const versionsLine = versionsSorted.map(([k, n]) => `${k} (${n})`).join(", ");

  const activeHidden = sumNumericRecord(
    online.activeHiddenSessionsByAccessLevel as Record<string, unknown>,
  );
  const activeVisible = sumNumericRecord(
    online.activeVisibleSessionsByAccessLevel as Record<string, unknown>,
  );
  const totalActiveSessions = activeHidden + activeVisible;

  const sessAccess =
    (online.usersBySessionAccessLevel ?? {}) as Record<string, unknown>;
  const anyone = bucketNumeric(sessAccess, "Anyone", "anyone");
  const registeredUsersInSession = bucketNumeric(
    sessAccess,
    "RegisteredUsers",
    "registeredUsers",
  );
  const privateSum =
    bucketNumeric(sessAccess, "Private", "private") +
    bucketNumeric(sessAccess, "ContactsPlus", "contactsPlus");

  const client =
    (online.usersByClientType ?? {}) as Record<string, unknown>;

  const capture =
    discordTsUnix(online.captureTimestamp) ??
    discordTsUnix(cloud.captureTimestamp);

  const lastUpdate =
    capture !== null ? `\n\n**Last update:** <t:${capture}:F>` : "";

  return (
    `**Online Users:** ${online.registeredUsers ?? 0} ` +
    `(${online.instanceCount ?? 0} instances)\n` +
    `**VR:** ${online.usersInVR ?? 0}, ` +
    `**Desktop:** ${online.usersOnDesktop ?? 0}\n` +
    `**Headless:** ${bucketNumeric(client, "Headless", "headless")}, ` +
    `**ChatClients:** ${bucketNumeric(client, "ChatClient", "chatClient")}, ` +
    `**Bots:** ${bucketNumeric(client, "Bot", "bot")}\n` +
    `**Users in public:** ${anyone}\n` +
    `**Users in semi-public:** ${registeredUsersInSession}\n` +
    `**Users in private:** ${privateSum}\n` +
    `**Active sessions:** ${totalActiveSessions}\n\n` +
    `----------------------\n` +
    `**Upload jobs:** ${cloud.uploadJobs ?? 0}\n` +
    `**Record sync jobs:** ${cloud.recordPreprocessJobs ?? 0}\n` +
    `**Asset Variant Computations:** ${cloud.assetVariantJobs ?? 0}\n` +
    `**Active versions:** ${versionsLine || "—"}` +
    lastUpdate
  );
}

export function pickTopSessionsForEmbeds(
  sessions: ResoniteSessionDto[],
  limit = 10,
): ResoniteSessionDto[] {
  return sessions
    .filter((s) => (s.activeUsers ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.totalActiveUsers ?? b.activeUsers ?? 0) -
        (a.totalActiveUsers ?? a.activeUsers ?? 0),
    )
    .slice(0, limit);
}

/** Inline field rows in v1 embeds — mirrored with em spaces in Components v2 text. */
const FIELD_SEP = "\u2003";

export type SessionMetricsDisplay = {
  title: string;
  /** `# title` + field body (v1 embed layout) including API open-session link. */
  textContent: string;
  accentColor: number;
  /** `https://api.resonite.com/open/session/…` (HTTPS; opens client via deeplink). */
  sessionOrbUrl: string;
  thumbnailUrl: string | null;
};

export function sessionMetricsDisplay(
  session: ResoniteSessionDto,
): SessionMetricsDisplay {
  const rawTitle =
    typeof session.name === "string" ? stripResoniteRichText(session.name) : "";
  const title = truncateField(
    rawTitle.replace(/\n/g, " ").trim() || "No session title provided",
    250,
  );

  const sessionId = session.sessionId ?? "";
  const sessionOrbUrl = sessionId ? buildOpenResoniteSessionUrl(sessionId) : "";

  const begin = session.sessionBeginTime
    ? Date.parse(session.sessionBeginTime)
    : NaN;
  const uptime =
    Number.isFinite(begin) ? formatDurationMs(Date.now() - begin) : "—";

  const tags = Array.isArray(session.tags)
    ? session.tags.filter((t): t is string => typeof t === "string").join(", ")
    : "";

  const users =
    Array.isArray(session.sessionUsers) && session.sessionUsers.length > 0
      ? session.sessionUsers
          .map((u) => u.username ?? u.userId ?? "?")
          .join(", ")
      : "No users";

  const row1 = [
    `**Host:** ${truncateField(session.hostUsername ?? "—", 256)}`,
    `**Users:** ${session.activeUsers ?? 0} (${session.joinedUsers ?? 0})`,
    `**Uptime:** ${uptime}`,
  ].join(FIELD_SEP);

  const row2 = [
    `**Version:** ${truncateField(session.appVersion ?? "—", 256)}`,
    `**Headless:** ${session.headlessHost ? "true" : "false"}`,
    `**Mobile friendly:** ${session.mobileFriendly ? "true" : "false"}`,
  ].join(FIELD_SEP);

  const bodyLines = [row1, row2];
  if (tags) {
    bodyLines.push("", `**Tags:**`, truncateField(tags));
  }
  bodyLines.push("", `**Users:**`, truncateField(users));
  if (sessionOrbUrl) {
    bodyLines.push("", sessionOrbUrl);
  }

  const thumb =
    typeof session.thumbnailUrl === "string" ? session.thumbnailUrl.trim() : "";

  return {
    title,
    textContent: `# ${title}\n${bodyLines.join("\n")}`,
    accentColor: session.headlessHost ? 0x3498db : 0x2ecc71,
    sessionOrbUrl,
    thumbnailUrl: thumb || null,
  };
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  return `${days}d ${hours}h ${mins}m`;
}
