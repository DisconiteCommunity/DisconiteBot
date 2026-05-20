import { randomUUID } from "node:crypto";

import type { YdmProjectItemRef } from "../../services/github/ydmProjectsPages.js";

/** Ephemeral “Showcase in channel”: payload lives in memory until clicked (Discord custom_id max 100 chars). */
export type ShowcasePublicJobV1 =
  | {
      v: 1;
      kind: "gh_issue";
      ref: YdmProjectItemRef;
    }
  | {
      v: 1;
      kind: "wiki_exact_v2";
      title: string;
      previewLimit: number;
    }
  | {
      v: 1;
      kind: "wiki_embed";
      title: string;
      previewLimit: number;
    }
  | {
      v: 1;
      kind: "account_users";
      username: string;
    }
  | {
      v: 1;
      kind: "record_url";
      url: string;
    }
  | {
      v: 1;
      kind: "forum_post";
      query: string;
      index: number;
    }
  | {
      v: 1;
      kind: "translate";
      context: string;
      languages: string[] | null;
      rawQuery?: string;
    };

const TTL_MS = 45 * 60_000;
const MAX_ENTRIES = 600;

type Entry = { job: ShowcasePublicJobV1; expiresAt: number };

const store = new Map<string, Entry>();

function prune(now: number): void {
  for (const [id, e] of store) {
    if (e.expiresAt <= now) {
      store.delete(id);
    }
  }
  if (store.size <= MAX_ENTRIES) {
    return;
  }
  const sorted = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const overflow = store.size - MAX_ENTRIES;
  for (let i = 0; i < overflow; i++) {
    const first = sorted[i];
    if (first) {
      store.delete(first[0]);
    }
  }
}

export function stashShowcasePublicJob(job: ShowcasePublicJobV1): string {
  const now = Date.now();
  prune(now);
  const id = randomUUID();
  store.set(id, { job, expiresAt: now + TTL_MS });
  return id;
}

export function takeShowcasePublicJob(id: string): ShowcasePublicJobV1 | null {
  const now = Date.now();
  prune(now);
  const entry = store.get(id);
  store.delete(id);
  if (!entry || entry.expiresAt <= now) {
    return null;
  }
  return entry.job;
}
