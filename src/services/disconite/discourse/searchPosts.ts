import { getDisconiteForumBaseUrl } from "../../../config/disconite.js";
import { truncateEllipsis } from "../../../utility/text/truncate.js";
import { fetchDiscourseJson } from "./client.js";

export type DiscourseSearchPost = {
  readonly id: number;
  readonly name: string;
  readonly username: string;
  readonly blurb: string;
  readonly post_number: number;
  readonly topic_id: number;
  readonly like_count: number;
  readonly created_at: string;
};

export type DiscourseSearchTopic = {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
};

export type DiscourseSearchUser = {
  readonly id: number;
  readonly username: string;
  readonly name: string;
  readonly trust_level?: number;
  readonly admin?: boolean;
  readonly moderator?: boolean;
  readonly title?: string;
  readonly primary_group_name?: string;
  readonly flair_name?: string;
};

type DiscourseSearchResponse = {
  readonly posts?: DiscourseSearchPost[] | null;
  readonly topics?: DiscourseSearchTopic[] | null;
  readonly users?: DiscourseSearchUser[] | null;
  readonly grouped_search_result?: {
    readonly error?: string;
    readonly term?: string;
  };
};

type DiscourseUserCardResponse = {
  readonly user?: {
    readonly trust_level?: number;
    readonly admin?: boolean;
    readonly moderator?: boolean;
    readonly title?: string;
    readonly primary_group_name?: string;
    readonly flair_name?: string;
  };
  readonly badges?: readonly { readonly name: string; readonly slug?: string }[];
};

export type ForumPostHit = {
  readonly postId: number;
  readonly topicTitle: string;
  readonly blurb: string;
  readonly postUrl: string;
  readonly authorLine: string;
  readonly likeCount: number;
  readonly createdAt: string;
};

const TRUST_LABELS: Record<number, string> = {
  0: "New User",
  1: "Basic",
  2: "Member",
  3: "Regular",
  4: "Leader",
};

const MAX_POSTS = 10;
const MAX_PROFILE_FETCHES = 5;
const AUTOCOMPLETE_POSTS = 25;

export function buildForumPostUrl(
  topicSlug: string,
  topicId: number,
  postNumber: number,
): string {
  const base = getDisconiteForumBaseUrl();
  return `${base}/t/${encodeURIComponent(topicSlug)}/${topicId}/${postNumber}`;
}

export function buildForumUserUrl(username: string): string {
  const base = getDisconiteForumBaseUrl();
  return `${base}/u/${encodeURIComponent(username)}`;
}

export function trustLevelLabel(level: number | undefined): string | null {
  if (level === undefined || level === null) {
    return null;
  }
  return TRUST_LABELS[level] ?? `Trust ${level}`;
}

export function formatForumAuthorLine(
  post: Pick<DiscourseSearchPost, "username" | "name">,
  user?: Pick<
    DiscourseSearchUser,
    | "trust_level"
    | "admin"
    | "moderator"
    | "title"
    | "primary_group_name"
    | "flair_name"
  >,
  badgeNames?: readonly string[],
): string {
  const display = post.name?.trim() || post.username;
  const parts: string[] = [
    `Forum account: **@${post.username}** (${display})`,
  ];

  const trust = trustLevelLabel(user?.trust_level);
  if (trust) {
    parts.push(trust);
  }
  if (user?.admin) {
    parts.push("Admin");
  }
  if (user?.moderator) {
    parts.push("Moderator");
  }
  if (user?.title?.trim()) {
    parts.push(user.title.trim());
  } else if (user?.primary_group_name?.trim()) {
    parts.push(user.primary_group_name.trim());
  } else if (user?.flair_name?.trim()) {
    parts.push(user.flair_name.trim());
  }

  if (badgeNames && badgeNames.length > 0) {
    const shown = badgeNames.slice(0, 4).join(", ");
    parts.push(`Badges: ${shown}`);
  }

  return parts.join(" · ");
}

async function fetchUserProfile(username: string): Promise<{
  user?: DiscourseUserCardResponse["user"];
  badgeNames: string[];
} | null> {
  try {
    const data = await fetchDiscourseJson<DiscourseUserCardResponse>(
      `/u/${encodeURIComponent(username)}.json`,
    );
    const badgeNames =
      data.badges
        ?.map((b) => b.name)
        .filter((n): n is string => Boolean(n?.trim())) ?? [];
    return { user: data.user, badgeNames };
  } catch {
    return null;
  }
}

async function enrichAuthors(
  posts: DiscourseSearchPost[],
  usersByUsername: Map<string, DiscourseSearchUser>,
): Promise<
  Map<string, { user?: DiscourseUserCardResponse["user"]; badgeNames: string[] }>
> {
  const usernames = [
    ...new Set(
      posts
        .map((p) => p.username)
        .filter((u) => u && !usersByUsername.has(u)),
    ),
  ].slice(0, MAX_PROFILE_FETCHES);

  const out = new Map<
    string,
    { user?: DiscourseUserCardResponse["user"]; badgeNames: string[] }
  >();

  await Promise.all(
    usernames.map(async (username) => {
      const profile = await fetchUserProfile(username);
      if (profile) {
        out.set(username, profile);
      }
    }),
  );

  return out;
}

/** Lightweight labels for slash autocomplete (topic title + author). */
export async function forumQueryAutocomplete(
  query: string,
): Promise<{ name: string; value: string }[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  const params = new URLSearchParams({ q });
  const data = await fetchDiscourseJson<DiscourseSearchResponse>(
    `/search.json?${params.toString()}`,
  );

  const posts = data.posts ?? [];
  const topics = data.topics ?? [];
  const topicById = new Map(topics.map((t) => [t.id, t]));

  const out: { name: string; value: string }[] = [];
  const seen = new Set<string>();

  for (const post of posts.slice(0, AUTOCOMPLETE_POSTS)) {
    const topic = topicById.get(post.topic_id);
    const title = topic?.title ?? `Topic #${post.topic_id}`;
    const label = `${title} — @${post.username}`;
    if (seen.has(title)) {
      continue;
    }
    seen.add(title);
    const name = truncateEllipsis(label, 100);
    const value = truncateEllipsis(title, 100);
    out.push({ name, value });
    if (out.length >= 25) {
      break;
    }
  }

  if (out.length === 0 && q) {
    out.push({ name: truncateEllipsis(q, 100), value: truncateEllipsis(q, 100) });
  }

  return out;
}

export async function searchForumPosts(
  query: string,
  limit = MAX_POSTS,
): Promise<ForumPostHit[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  const params = new URLSearchParams({ q });
  const data = await fetchDiscourseJson<DiscourseSearchResponse>(
    `/search.json?${params.toString()}`,
  );

  const searchError = data.grouped_search_result?.error;
  if (searchError) {
    throw new Error(searchError);
  }

  const posts = data.posts ?? [];
  const topics = data.topics ?? [];
  const topicById = new Map(topics.map((t) => [t.id, t]));

  const usersById = new Map<number, DiscourseSearchUser>();
  const usersByUsername = new Map<string, DiscourseSearchUser>();
  for (const u of data.users ?? []) {
    usersById.set(u.id, u);
    usersByUsername.set(u.username, u);
  }

  const slice = posts.slice(0, limit);
  const profiles = await enrichAuthors(slice, usersByUsername);

  const hits: ForumPostHit[] = [];
  for (const post of slice) {
    const topic = topicById.get(post.topic_id);
    const slug = topic?.slug ?? String(post.topic_id);
    const title = topic?.title ?? `Topic #${post.topic_id}`;

    const fromSearch = usersByUsername.get(post.username);
    const profile = profiles.get(post.username);
    const mergedUser = {
      trust_level: fromSearch?.trust_level ?? profile?.user?.trust_level,
      admin: fromSearch?.admin ?? profile?.user?.admin,
      moderator: fromSearch?.moderator ?? profile?.user?.moderator,
      title: fromSearch?.title ?? profile?.user?.title,
      primary_group_name:
        fromSearch?.primary_group_name ?? profile?.user?.primary_group_name,
      flair_name: fromSearch?.flair_name ?? profile?.user?.flair_name,
    };

    const authorLine = formatForumAuthorLine(
      post,
      mergedUser,
      profile?.badgeNames,
    );

    hits.push({
      postId: post.id,
      topicTitle: title,
      blurb: truncateEllipsis(post.blurb?.trim() || "—", 400),
      postUrl: buildForumPostUrl(slug, post.topic_id, post.post_number),
      authorLine,
      likeCount: post.like_count ?? 0,
      createdAt: post.created_at,
    });
  }

  return hits;
}

export async function getForumPostHit(
  query: string,
  index: number,
): Promise<ForumPostHit | null> {
  const hits = await searchForumPosts(query, MAX_POSTS);
  return hits[index] ?? null;
}
