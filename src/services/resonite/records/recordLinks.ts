/**
 * Parse pasted Resonite record / world / session links into structured refs.
 * Supports resrec://, ressession:///, resonite-session://, api.resonite.com/open/*,
 * go.resonite.com/session/*, Resonite:?world=..., and free text that contains
 * recognizable patterns (e.g. wiki pages with URLs).
 */

const R_RECORD_ID =
  /^R-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

const OWNER_PREFIX = /^(U-|G-)/i;

export type ParsedRecordInput =
  | { kind: "record"; ownerId: string; recordId: string }
  | { kind: "path"; ownerId: string; path: string }
  | { kind: "session"; sessionId: string };

export type ParseRecordFailure = { ok: false; reason: string };
export type ParseRecordSuccess = { ok: true; value: ParsedRecordInput };
export type ParseRecordResult = ParseRecordSuccess | ParseRecordFailure;

function decodeRepeatedly(input: string, rounds = 5): string {
  let current = input;
  for (let i = 0; i < rounds; i++) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) {
        break;
      }
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

function normalizeSessionId(raw: string): string {
  const s = raw.trim();
  if (/^S-/i.test(s)) {
    return s;
  }
  if (
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      s,
    )
  ) {
    return `S-${s}`;
  }
  return s;
}

function extractResoniteWorldParam(s: string): string | null {
  const m = s.match(/^[Rr]esonite:\?(.*)$/s);
  if (!m?.[1]) {
    return null;
  }
  const params = new URLSearchParams(m[1]);
  return params.get("world");
}

function extractFromOpenWorld(haystack: string): ParsedRecordInput | null {
  const re =
    /https?:\/\/api\.resonite\.com\/open\/world\/([^/\s?#]+)\/(R-[0-9a-fA-F-]+)/i;
  const m = haystack.match(re);
  if (m?.[1] && m[2]) {
    return { kind: "record", ownerId: m[1], recordId: m[2] };
  }
  return null;
}

function extractFromOpenSession(haystack: string): ParsedRecordInput | null {
  const re =
    /https?:\/\/api\.resonite\.com\/open\/session\/([^?\s#]+)/i;
  const m = haystack.match(re);
  if (m?.[1]) {
    return { kind: "session", sessionId: normalizeSessionId(m[1]) };
  }
  return null;
}

/** Public session preview page (same id as API /sessions/{id}). */
function extractFromGoResoniteSession(haystack: string): ParsedRecordInput | null {
  const re = /https?:\/\/go\.resonite\.com\/session\/([^?\s#"'<>]+)/i;
  const m = haystack.match(re);
  if (m?.[1]) {
    return { kind: "session", sessionId: normalizeSessionId(m[1]) };
  }
  return null;
}

function extractResoniteSessionProtocol(haystack: string): ParsedRecordInput | null {
  const re = /resonite-session:\/\/([^?\s#"'<>]+)/i;
  const m = haystack.match(re);
  if (m?.[1]) {
    return { kind: "session", sessionId: normalizeSessionId(m[1]) };
  }
  return null;
}

const R_SESSION_SEGMENT =
  /^(?:S-)?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

function parseRessessionPayload(inner: string): ParsedRecordInput | null {
  const trimmed = inner.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  const head = trimmed.split(/[/\s]+/).filter(Boolean)[0] ?? "";
  if (!R_SESSION_SEGMENT.test(head)) {
    return null;
  }
  return { kind: "session", sessionId: normalizeSessionId(head) };
}

/** Client session URL, e.g. ressession:///S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db */
function extractRessession(haystack: string): ParsedRecordInput | null {
  const lower = haystack.toLowerCase();
  const needle = "ressession://";
  let from = 0;
  while (from < lower.length) {
    const idx = lower.indexOf(needle, from);
    if (idx === -1) {
      return null;
    }
    let i = idx + needle.length;
    while (i < haystack.length && haystack[i] === "/") {
      i++;
    }
    let j = i;
    while (j < haystack.length) {
      const c = haystack[j] ?? "";
      if (
        c === " " ||
        c === "\t" ||
        c === "\n" ||
        c === "\r" ||
        c === '"' ||
        c === "'" ||
        c === "<" ||
        c === ">" ||
        c === "?"
      ) {
        break;
      }
      j++;
    }
    const parsed = parseRessessionPayload(haystack.slice(i, j));
    if (parsed) {
      return parsed;
    }
    from = idx + 1;
  }
  return null;
}

function extractSessionFromProtocols(haystack: string): ParsedRecordInput | null {
  return (
    extractRessession(haystack) ?? extractResoniteSessionProtocol(haystack)
  );
}

function parseResRecPayload(payload: string): ParsedRecordInput | null {
  const trimmed = payload.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    return null;
  }
  const ownerId = trimmed.slice(0, slash);
  const rest = trimmed.slice(slash + 1);
  if (!OWNER_PREFIX.test(ownerId)) {
    return null;
  }
  const segments = rest.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  const last = segments[segments.length - 1] ?? "";
  if (segments.length === 1 && R_RECORD_ID.test(last)) {
    return { kind: "record", ownerId, recordId: last };
  }
  if (R_RECORD_ID.test(last)) {
    return { kind: "record", ownerId, recordId: last };
  }
  return { kind: "path", ownerId, path: segments.join("/") };
}

function extractResRec(haystack: string): ParsedRecordInput | null {
  const lower = haystack.toLowerCase();
  let from = 0;
  while (from < lower.length) {
    const idx = lower.indexOf("resrec://", from);
    if (idx === -1) {
      return null;
    }
    let i = idx + "resrec://".length;
    while (i < haystack.length && haystack[i] === "/") {
      i++;
    }
    let j = i;
    while (j < haystack.length) {
      const c = haystack[j] ?? "";
      if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === '"' || c === "'" || c === "<" || c === ">") {
        break;
      }
      j++;
    }
    const inner = haystack.slice(i, j);
    const parsed = parseResRecPayload(inner);
    if (parsed) {
      return parsed;
    }
    from = idx + 1;
  }
  return null;
}

/**
 * Normalize arbitrary user paste into a record path ref, session ref, or error.
 */
export function parseRecordInput(raw: string): ParseRecordResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "Paste a record/session URL, resrec://, ressession:///, or open link." };
  }

  let s = decodeRepeatedly(trimmed);

  const world = extractResoniteWorldParam(s);
  if (world) {
    s = decodeRepeatedly(world.trim());
  }

  const sessionProto = extractSessionFromProtocols(s);
  if (sessionProto) {
    return { ok: true, value: sessionProto };
  }

  const openWorld = extractFromOpenWorld(s);
  if (openWorld) {
    return { ok: true, value: openWorld };
  }

  const openSession =
    extractFromOpenSession(s) ?? extractFromGoResoniteSession(s);
  if (openSession) {
    return { ok: true, value: openSession };
  }

  const resrec = extractResRec(s);
  if (resrec) {
    return { ok: true, value: resrec };
  }

  const fallbackHaystack = decodeRepeatedly(trimmed);
  const fromWiki =
    extractFromOpenWorld(fallbackHaystack) ??
    extractFromOpenSession(fallbackHaystack) ??
    extractFromGoResoniteSession(fallbackHaystack) ??
    extractSessionFromProtocols(fallbackHaystack) ??
    extractResRec(fallbackHaystack);

  if (fromWiki) {
    return { ok: true, value: fromWiki };
  }

  return {
    ok: false,
    reason:
      "Could not find a resrec:// / ressession:/// link, go.resonite.com/session/…, api.resonite.com/open/… URL, or Resonite:?world=… value. Check the pasted text.",
  };
}

/** HTTPS link that opens the world in the Resonite client (redirect junction). */
export function buildOpenWorldUrl(ownerId: string, recordId: string): string {
  return `https://api.resonite.com/open/world/${encodeURIComponent(ownerId)}/${encodeURIComponent(recordId)}`;
}
