import { stripResoniteRichText } from "../../../utility/text/resoniteRichText.js";
import { fetchResoniteJson } from "../api/api.js";

/** Map owner id to `/users/...` or `/groups/...` API prefix (unauthenticated). */
export function ownerRecordsBasePath(ownerId: string): string {
  const id = ownerId.trim();
  if (id.toUpperCase().startsWith("G-")) {
    return `/groups/${encodeURIComponent(id)}`;
  }
  return `/users/${encodeURIComponent(id)}`;
}

export function resdbToAssetHttps(uri: string | null | undefined): string | null {
  if (!uri || typeof uri !== "string") {
    return null;
  }
  const m = uri.match(/^resdb:\/\/\/([0-9a-fA-F]+)\.[a-z0-9]+$/i);
  return m?.[1] ? `https://assets.resonite.com/${m[1]}` : null;
}

export type ApiRecordSummary = {
  title: string;
  recordId: string;
  ownerId: string;
  ownerName?: string;
  recordType?: string;
  isPublic?: boolean;
  isListed?: boolean;
  imageUrl: string | null;
  /** Public open link when we have a record id (not guaranteed for path-only refs). */
  openWorldUrl: string | null;
  extraLines: string[];
};

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

/** Build a readable summary from GET …/records/{id} or …/records/root/{path} JSON. */
export function summarizeRecordPayload(
  json: Record<string, unknown>,
  ownerId: string,
): ApiRecordSummary {
  const recordId = str(json.id) ?? "";
  const name = stripResoniteRichText(str(json.name) ?? "Record");
  const thumbnailUri = str(json.thumbnailUri);
  const assetUri = str(json.assetUri);
  const imageUrl =
    resdbToAssetHttps(thumbnailUri) ?? resdbToAssetHttps(assetUri);

  const lines: string[] = [];
  const tags = json.tags;
  if (Array.isArray(tags) && tags.length > 0) {
    const tagStr = tags
      .filter((t): t is string => typeof t === "string")
      .slice(0, 12)
      .map((t) => stripResoniteRichText(t))
      .join(", ");
    if (tagStr) {
      lines.push(`Tags: ${tagStr}`);
    }
  }
  const visits = json.visits;
  if (typeof visits === "number") {
    lines.push(`Visits: ${visits}`);
  }

  const openWorldUrl =
    recordId && recordId.startsWith("R-")
      ? `https://api.resonite.com/open/world/${encodeURIComponent(ownerId)}/${encodeURIComponent(recordId)}`
      : null;

  const ownerNameRaw = str(json.ownerName);
  const recordTypeRaw = str(json.recordType);
  return {
    title: name,
    recordId,
    ownerId,
    ownerName: ownerNameRaw ? stripResoniteRichText(ownerNameRaw) : undefined,
    recordType: recordTypeRaw ? stripResoniteRichText(recordTypeRaw) : undefined,
    isPublic: bool(json.isPublic),
    isListed: bool(json.isListed),
    imageUrl,
    openWorldUrl,
    extraLines: lines,
  };
}

export async function fetchRecordById(
  ownerId: string,
  recordId: string,
): Promise<Record<string, unknown>> {
  return fetchResoniteJson(
    `${ownerRecordsBasePath(ownerId)}/records/${encodeURIComponent(recordId)}`,
  );
}

function encodeInventoryPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
}

/** Browser URL for the same JSON as `fetchRecordById` (public GET). */
export function buildRecordJsonApiUrl(
  ownerId: string,
  recordId: string,
): string {
  const base = ownerRecordsBasePath(ownerId);
  return `https://api.resonite.com${base}/records/${encodeURIComponent(recordId)}`;
}

/** Browser URL for the same JSON as `fetchRecordByInventoryPath` (public GET). */
export function buildRecordInventoryJsonApiUrl(
  ownerId: string,
  path: string,
): string {
  const base = ownerRecordsBasePath(ownerId);
  const encodedPath = encodeInventoryPath(path);
  return `https://api.resonite.com${base}/records/root/${encodedPath}`;
}

export async function fetchRecordByInventoryPath(
  ownerId: string,
  path: string,
): Promise<Record<string, unknown>> {
  const base = ownerRecordsBasePath(ownerId);
  const encodedPath = encodeInventoryPath(path);
  return fetchResoniteJson(`${base}/records/root/${encodedPath}`);
}

export async function fetchSession(
  sessionId: string,
): Promise<Record<string, unknown>> {
  const id = sessionId.trim();
  const withPrefix = /^S-/i.test(id) ? id : `S-${id}`;
  return fetchResoniteJson(`/sessions/${encodeURIComponent(withPrefix)}`);
}

/** Browser URL for the same JSON as `fetchSession` (public GET). */
export function buildSessionJsonApiUrl(sessionId: string): string {
  const id = sessionId.trim();
  const withPrefix = /^S-/i.test(id) ? id : `S-${id}`;
  return `https://api.resonite.com/sessions/${encodeURIComponent(withPrefix)}`;
}

/** Web session preview (title, host, join) — same session id as the public API. */
export function buildGoResoniteSessionUrl(sessionId: string): string {
  const id = sessionId.trim();
  const withPrefix = /^S-/i.test(id) ? id : `S-${id}`;
  return `https://go.resonite.com/session/${encodeURIComponent(withPrefix)}`;
}

export type SessionSummary = {
  title: string;
  sessionId: string;
  lines: string[];
};

export function summarizeSessionPayload(
  json: Record<string, unknown>,
  sessionId: string,
): SessionSummary {
  const name = stripResoniteRichText(
    str(json.name) ?? str(json.sessionName) ?? "Session",
  );
  const lines: string[] = [];
  const host = str(json.hostUserId) ?? str(json.hostId);
  if (host) {
    lines.push(`Host: ${host}`);
  }
  const access = str(json.accessLevel);
  if (access) {
    lines.push(`Access: ${stripResoniteRichText(access)}`);
  }
  const users = json.activeUsers;
  if (typeof users === "number") {
    lines.push(`Active users: ${users}`);
  }
  const comp = str(json.compatibilityHash);
  if (comp) {
    lines.push(`Compatibility hash: ${comp.slice(0, 16)}…`);
  }
  return {
    title: name,
    sessionId,
    lines,
  };
}
