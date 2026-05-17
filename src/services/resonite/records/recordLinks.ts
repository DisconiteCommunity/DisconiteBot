/**
 * Parse pasted Resonite record and session links into structured refs.
 * Records may be worlds, objects, folders, spawnables, etc.
 * Supports resrec://, ressession:///, resonite-session://, api.resonite.com/open/*,
 * go.resonite.com/session/*, Resonite:?world=..., and free text that contains
 * recognizable patterns (e.g. wiki pages with URLs).
 */

const RESONITE_RECORD_ID_PATTERN =
  /^R-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

const RESONITE_OWNER_ID_PREFIX_PATTERN = /^(U-|G-)/i;

export type ParsedRecordInput =
  | { kind: "record"; ownerId: string; recordId: string }
  | { kind: "path"; ownerId: string; path: string }
  | { kind: "session"; sessionId: string };

export type ParseRecordFailure = { ok: false; reason: string };
export type ParseRecordSuccess = { ok: true; value: ParsedRecordInput };
export type ParseRecordResult = ParseRecordSuccess | ParseRecordFailure;

function decodeRepeatedly(input: string, maxRounds = 5): string {
  let decoded = input;
  for (let round = 0; round < maxRounds; round++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

function normalizeSessionId(rawSessionId: string): string {
  const trimmed = rawSessionId.trim();
  if (/^S-/i.test(trimmed)) {
    return trimmed;
  }
  if (
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      trimmed,
    )
  ) {
    return `S-${trimmed}`;
  }
  return trimmed;
}

function extractResoniteWorldParam(input: string): string | null {
  const match = input.match(/^[Rr]esonite:\?(.*)$/s);
  if (!match?.[1]) {
    return null;
  }
  const params = new URLSearchParams(match[1]);
  return params.get("world");
}

/** api.resonite.com/open/world/{owner}/{recordId} — opens any record type in the client */
function extractFromOpenRecordUrl(haystack: string): ParsedRecordInput | null {
  const pattern =
    /https?:\/\/api\.resonite\.com\/open\/world\/([^/\s?#]+)\/(R-[0-9a-fA-F-]+)/i;
  const match = haystack.match(pattern);
  if (match?.[1] && match[2]) {
    return { kind: "record", ownerId: match[1], recordId: match[2] };
  }
  return null;
}

function extractFromOpenSessionUrl(haystack: string): ParsedRecordInput | null {
  const pattern =
    /https?:\/\/api\.resonite\.com\/open\/session\/([^?\s#]+)/i;
  const match = haystack.match(pattern);
  if (match?.[1]) {
    return { kind: "session", sessionId: normalizeSessionId(match[1]) };
  }
  return null;
}

/** Public session preview page (same id as API /sessions/{id}). */
function extractFromGoResoniteSession(haystack: string): ParsedRecordInput | null {
  const pattern = /https?:\/\/go\.resonite\.com\/session\/([^?\s#"'<>]+)/i;
  const match = haystack.match(pattern);
  if (match?.[1]) {
    return { kind: "session", sessionId: normalizeSessionId(match[1]) };
  }
  return null;
}

function extractResoniteSessionProtocol(haystack: string): ParsedRecordInput | null {
  const pattern = /resonite-session:\/\/([^?\s#"'<>]+)/i;
  const match = haystack.match(pattern);
  if (match?.[1]) {
    return { kind: "session", sessionId: normalizeSessionId(match[1]) };
  }
  return null;
}

const SESSION_ID_SEGMENT_PATTERN =
  /^(?:S-)?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

function parseRessessionPayload(innerPayload: string): ParsedRecordInput | null {
  const trimmed = innerPayload.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  const firstSegment = trimmed.split(/[/\s]+/).filter(Boolean)[0] ?? "";
  if (!SESSION_ID_SEGMENT_PATTERN.test(firstSegment)) {
    return null;
  }
  return { kind: "session", sessionId: normalizeSessionId(firstSegment) };
}

/** Client session URL, e.g. ressession:///S-019e288c-f2bc-7e7e-ab9e-6d0b7b1ad8db */
function extractRessession(haystack: string): ParsedRecordInput | null {
  const lowerHaystack = haystack.toLowerCase();
  const protocolNeedle = "ressession://";
  let searchFromIndex = 0;
  while (searchFromIndex < lowerHaystack.length) {
    const foundIndex = lowerHaystack.indexOf(protocolNeedle, searchFromIndex);
    if (foundIndex === -1) {
      return null;
    }
    let payloadStart = foundIndex + protocolNeedle.length;
    while (payloadStart < haystack.length && haystack[payloadStart] === "/") {
      payloadStart++;
    }
    let payloadEnd = payloadStart;
    while (payloadEnd < haystack.length) {
      const character = haystack[payloadEnd] ?? "";
      if (
        character === " " ||
        character === "\t" ||
        character === "\n" ||
        character === "\r" ||
        character === '"' ||
        character === "'" ||
        character === "<" ||
        character === ">" ||
        character === "?"
      ) {
        break;
      }
      payloadEnd++;
    }
    const parsed = parseRessessionPayload(
      haystack.slice(payloadStart, payloadEnd),
    );
    if (parsed) {
      return parsed;
    }
    searchFromIndex = foundIndex + 1;
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
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex === -1) {
    return null;
  }
  const ownerId = trimmed.slice(0, slashIndex);
  const pathAfterOwner = trimmed.slice(slashIndex + 1);
  if (!RESONITE_OWNER_ID_PREFIX_PATTERN.test(ownerId)) {
    return null;
  }
  const segments = pathAfterOwner.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  const lastSegment = segments[segments.length - 1] ?? "";
  if (segments.length === 1 && RESONITE_RECORD_ID_PATTERN.test(lastSegment)) {
    return { kind: "record", ownerId, recordId: lastSegment };
  }
  if (RESONITE_RECORD_ID_PATTERN.test(lastSegment)) {
    return { kind: "record", ownerId, recordId: lastSegment };
  }
  return { kind: "path", ownerId, path: segments.join("/") };
}

function extractResRec(haystack: string): ParsedRecordInput | null {
  const lowerHaystack = haystack.toLowerCase();
  let searchFromIndex = 0;
  while (searchFromIndex < lowerHaystack.length) {
    const foundIndex = lowerHaystack.indexOf("resrec://", searchFromIndex);
    if (foundIndex === -1) {
      return null;
    }
    let payloadStart = foundIndex + "resrec://".length;
    while (payloadStart < haystack.length && haystack[payloadStart] === "/") {
      payloadStart++;
    }
    let payloadEnd = payloadStart;
    while (payloadEnd < haystack.length) {
      const character = haystack[payloadEnd] ?? "";
      if (
        character === " " ||
        character === "\t" ||
        character === "\n" ||
        character === "\r" ||
        character === '"' ||
        character === "'" ||
        character === "<" ||
        character === ">"
      ) {
        break;
      }
      payloadEnd++;
    }
    const innerPayload = haystack.slice(payloadStart, payloadEnd);
    const parsed = parseResRecPayload(innerPayload);
    if (parsed) {
      return parsed;
    }
    searchFromIndex = foundIndex + 1;
  }
  return null;
}

/**
 * Normalize arbitrary user paste into a record path ref, session ref, or error.
 */
export function parseRecordInput(raw: string): ParseRecordResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      reason:
        "Paste a record/session URL, resrec://, ressession:///, or open link.",
    };
  }

  let decodedInput = decodeRepeatedly(trimmed);

  const resoniteWorldParam = extractResoniteWorldParam(decodedInput);
  if (resoniteWorldParam) {
    decodedInput = decodeRepeatedly(resoniteWorldParam.trim());
  }

  const sessionFromProtocol = extractSessionFromProtocols(decodedInput);
  if (sessionFromProtocol) {
    return { ok: true, value: sessionFromProtocol };
  }

  const openRecordLink = extractFromOpenRecordUrl(decodedInput);
  if (openRecordLink) {
    return { ok: true, value: openRecordLink };
  }

  const openSessionLink =
    extractFromOpenSessionUrl(decodedInput) ??
    extractFromGoResoniteSession(decodedInput);
  if (openSessionLink) {
    return { ok: true, value: openSessionLink };
  }

  const resrecLink = extractResRec(decodedInput);
  if (resrecLink) {
    return { ok: true, value: resrecLink };
  }

  const fallbackHaystack = decodeRepeatedly(trimmed);
  const parsedFromSurroundingText =
    extractFromOpenRecordUrl(fallbackHaystack) ??
    extractFromOpenSessionUrl(fallbackHaystack) ??
    extractFromGoResoniteSession(fallbackHaystack) ??
    extractSessionFromProtocols(fallbackHaystack) ??
    extractResRec(fallbackHaystack);

  if (parsedFromSurroundingText) {
    return { ok: true, value: parsedFromSurroundingText };
  }

  return {
    ok: false,
    reason:
      "Could not find a resrec:// / ressession:/// link, go.resonite.com/session/…, api.resonite.com/open/… URL, or Resonite:?world=… value. Check the pasted text.",
  };
}

/**
 * HTTPS handler that opens a cloud record in Resonite (`GET /open/world/…` →
 * `resonite:?world=resrec:///…`). Same path for worlds, inventory objects,
 * folders, and other record types; the client decides load vs spawn.
 */
export function buildOpenInResoniteUrl(
  ownerId: string,
  recordId: string,
): string {
  return `https://api.resonite.com/open/world/${encodeURIComponent(ownerId)}/${encodeURIComponent(recordId)}`;
}

/** Discord link-button label for {@link buildOpenInResoniteUrl} from API `recordType`. */
export function openInResoniteRecordButtonLabel(recordType?: string): string {
  switch ((recordType ?? "").trim().toLowerCase()) {
    case "world":
      return "Open world";
    case "object":
      return "Spawn item";
    case "directory":
    case "link":
      return "Open folder";
    default:
      return "Open in Resonite";
  }
}
