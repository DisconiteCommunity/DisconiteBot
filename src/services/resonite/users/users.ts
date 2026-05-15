import { fetchResoniteJson } from "../api/api.js";

function coalesceResoniteId(id: unknown): string {
  if (typeof id === "string") {
    return id;
  }
  if (typeof id === "bigint") {
    return id.toString();
  }
  if (typeof id === "number" && Number.isFinite(id)) {
    return String(Math.trunc(id));
  }
  return "";
}

export type ResoniteUserRow = {
  id: string;
  username: string;
  normalizedUsername?: string;
  registrationDate?: string;
  isVerified?: boolean;
  isLocked?: boolean;
  isActiveSupporter?: boolean;
};

/** Same public GET the bot uses for `/users?name=…` (browser shows JSON). */
export function buildUsersSearchApiUrl(partialUsername: string): string {
  const name = partialUsername.trim().slice(0, 256);
  const url = new URL("https://api.resonite.com/users");
  url.searchParams.set("name", name);
  return url.toString();
}

/** Distinct usernames for Discord autocomplete (public `GET /users?name=…`). */
export async function searchResoniteUsernamesAutocomplete(
  prefix: string,
  max = 25,
): Promise<string[]> {
  const rows = await searchUsersByName(prefix);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of rows) {
    const n = u.username;
    if (!n || seen.has(n)) {
      continue;
    }
    seen.add(n);
    out.push(n);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

export async function searchUsersByName(
  partialUsername: string,
): Promise<ResoniteUserRow[]> {
  const name = partialUsername.trim();
  if (!name) {
    return [];
  }
  const url = new URL("https://api.resonite.com/users");
  url.searchParams.set("name", name.slice(0, 256));
  const rows = await fetchResoniteJson<unknown[]>(url.toString());
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter(
      (r): r is Record<string, unknown> =>
        r !== null && typeof r === "object",
    )
    .map((r) => ({
      id: coalesceResoniteId(r.id),
      username: typeof r.username === "string" ? r.username : "",
      normalizedUsername:
        typeof r.normalizedUsername === "string"
          ? r.normalizedUsername
          : undefined,
      registrationDate:
        typeof r.registrationDate === "string" ? r.registrationDate : undefined,
      isVerified: typeof r.isVerified === "boolean" ? r.isVerified : undefined,
      isLocked: typeof r.isLocked === "boolean" ? r.isLocked : undefined,
      isActiveSupporter:
        typeof r.isActiveSupporter === "boolean"
          ? r.isActiveSupporter
          : undefined,
    }))
    .filter((u) => u.id && u.username);
}
