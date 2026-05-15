import type { User } from "discord.js";

/** Canonical platform id used for /resonite socials filtering. */
export type SocialPlatform =
  | "twitter"
  | "youtube"
  | "github"
  | "reddit"
  | "bluesky"
  | "twitch"
  | "tiktok"
  | "fediverse"
  | "carrd"
  | "website"
  | "blog";

export type SocialLink = {
  readonly platform: SocialPlatform;
  readonly label: string;
  readonly url: string;
};

export type TeamMemberDiscord = {
  readonly userId?: string;
  readonly username?: string;
};

export type TeamMember = {
  readonly id: string;
  readonly displayName: string;
  readonly wikiPath: string;
  readonly section: string;
  readonly role: string;
  readonly aliases: readonly string[];
  readonly socials: readonly SocialLink[];
  /** When set, `/resonite socials` can surface a Discord profile link for this member. */
  readonly discord?: TeamMemberDiscord;
};

export type DisplayLink = {
  readonly label: string;
  readonly url: string;
  readonly platformId: string;
};

export type PlatformChoice = {
  readonly id: string;
  readonly label: string;
};

/** Optional reference page; roster data below is maintained in-repo, not fetched at runtime. */
export const RESONITE_TEAM_WIKI_URL =
  "https://wiki.resonite.com/Resonite_team";

const PLATFORM_LABELS: Record<string, string> = {
  all: "All platforms",
  wiki: "Resonite Wiki",
  discord: "Discord",
  twitter: "Twitter / X",
  x: "X (Twitter)",
  youtube: "YouTube",
  github: "GitHub",
  reddit: "Reddit",
  bluesky: "BlueSky",
  twitch: "Twitch",
  tiktok: "TikTok",
  fediverse: "Fediverse / Mastodon",
  mastodon: "Mastodon / Fediverse",
  carrd: "Carrd",
  website: "Website",
  blog: "Blog",
};

/**
 * Resonite team roster and social URLs.
 * Update this file when team membership or links change.
 */
export const RESONITE_TEAM_ROSTER: readonly TeamMember[] = [
  {
    id: "frooxius",
    displayName: "Frooxius",
    wikiPath: "User:Frooxius",
    section: "Core development",
    role: "Lead Engineer",
    aliases: ["frooxius", "froox", "yellowdogman"],
    socials: [
      {
        platform: "twitter",
        label: "Twitter",
        url: "https://twitter.com/Frooxius",
      },
      {
        platform: "youtube",
        label: "YouTube",
        url: "https://www.youtube.com/@Frooxius",
      },
      {
        platform: "github",
        label: "GitHub",
        url: "https://github.com/Frooxius",
      },
      {
        platform: "reddit",
        label: "Reddit",
        url: "https://reddit.com/user/Frooxius",
      },
      {
        platform: "bluesky",
        label: "BlueSky",
        url: "https://bsky.app/profile/frooxius.bsky.social",
      },
    ],
  },
  {
    id: "probableprime",
    displayName: "ProbablePrime",
    wikiPath: "User:ProbablePrime",
    section: "Core development",
    role: "Technical Program Manager",
    aliases: ["probableprime", "prime"],
    socials: [
      {
        platform: "twitter",
        label: "Twitter",
        url: "https://twitter.com/ProbablePrime",
      },
      {
        platform: "youtube",
        label: "YouTube",
        url: "https://www.youtube.com/@ProbablePrime",
      },
      {
        platform: "bluesky",
        label: "BlueSky",
        url: "https://bsky.app/profile/probableprime.bsky.social",
      },
    ],
  },
  {
    id: "cyro",
    displayName: "Cyro",
    wikiPath: "User:Cyro",
    section: "Core development",
    role: "Engineer",
    aliases: ["cyro"],
    socials: [
      {
        platform: "bluesky",
        label: "BlueSky",
        url: "https://bsky.app/profile/cyro.bsky.social",
      },
    ],
  },
  {
    id: "gawdl3y",
    displayName: "Gawdl3y",
    wikiPath: "User:Gawdl3y",
    section: "Core development",
    role: "Engineer",
    aliases: ["gawdl3y"],
    socials: [
      {
        platform: "website",
        label: "Website",
        url: "https://gawdl3y.dev/",
      },
    ],
  },
  {
    id: "j4",
    displayName: "J4",
    wikiPath: "User:J4",
    section: "Core development",
    role: "Engineer",
    aliases: ["j4"],
    socials: [
      { platform: "blog", label: "Blog", url: "https://b.j4.lc" },
    ],
  },
  {
    id: "aegis_wolf",
    displayName: "Aegis Wolf",
    wikiPath: "User:Aegis_Wolf",
    section: "Art team",
    role: "Art",
    aliases: ["aegis_wolf", "aegisthewolf", "aegis"],
    socials: [
      {
        platform: "twitter",
        label: "Twitter",
        url: "https://twitter.com/Aegis_The_Wolf",
      },
      {
        platform: "bluesky",
        label: "BlueSky",
        url: "https://bsky.app/profile/aegisthewolf.bsky.social",
      },
    ],
  },
  {
    id: "chroma",
    displayName: "Chroma",
    wikiPath: "User:Chroma",
    section: "Art team",
    role: "Art",
    aliases: ["chroma", "zachhartman"],
    socials: [],
  },
  {
    id: "lacybean",
    displayName: "LacyBean",
    wikiPath: "User:LacyBean",
    section: "Art team",
    role: "Audio Designer",
    aliases: ["lacybean", "lacydoes"],
    socials: [
      {
        platform: "twitter",
        label: "Twitter",
        url: "https://twitter.com/lacydoes",
      },
      {
        platform: "twitch",
        label: "Twitch",
        url: "https://www.twitch.tv/lacydoes",
      },
      {
        platform: "fediverse",
        label: "Fediverse (Mastodon)",
        url: "https://cyberfurz.social/@LacyDoes",
      },
      {
        platform: "carrd",
        label: "Carrd",
        url: "https://lacydoes.carrd.co/",
      },
    ],
  },
  {
    id: "nexulan",
    displayName: "Nexulan",
    wikiPath: "User:Nexulan",
    section: "Art team",
    role: "Community Director",
    aliases: ["nexulan"],
    socials: [
      {
        platform: "twitter",
        label: "Twitter",
        url: "https://twitter.com/Nexulan",
      },
      {
        platform: "tiktok",
        label: "TikTok",
        url: "https://www.tiktok.com/@nexulan",
      },
      {
        platform: "twitch",
        label: "Twitch",
        url: "https://www.twitch.tv/nexulan",
      },
      {
        platform: "carrd",
        label: "Carrd",
        url: "https://nexulan.carrd.co/",
      },
    ],
  },
  {
    id: "rueshejn",
    displayName: "RueShejn",
    wikiPath: "User:RueShejn",
    section: "Art team",
    role: "Art",
    aliases: ["rueshejn"],
    socials: [],
  },
  {
    id: "ryuvi",
    displayName: "Ryuvi",
    wikiPath: "User:Ryuvi",
    section: "Art team",
    role: "Art",
    aliases: ["ryuvi"],
    socials: [],
  },
  {
    id: "decoy",
    displayName: "Decoy",
    wikiPath: "User:Decoy",
    section: "Art team",
    role: "Marketing",
    aliases: ["decoy"],
    socials: [],
  },
  {
    id: "rustybot",
    displayName: "Rustybot",
    wikiPath: "User:Rustybot",
    section: "Art team",
    role: "Marketing",
    aliases: ["rustybot"],
    socials: [],
  },
  {
    id: "bobthegood",
    displayName: "BobTheGood",
    wikiPath: "User:BobTheGood",
    section: "Business team",
    role: "Finance and B2B",
    aliases: ["bobthegood"],
    socials: [],
  },
  {
    id: "canadiangit",
    displayName: "CanadianGit",
    wikiPath: "User:CanadianGit",
    section: "Business team",
    role: "B2B / Moderation Lead",
    aliases: ["canadiangit"],
    socials: [
      {
        platform: "twitter",
        label: "Twitter",
        url: "https://twitter.com/CanadianGit",
      },
    ],
  },
  {
    id: "veer",
    displayName: "Veer",
    wikiPath: "User:Veer",
    section: "Trust and safety",
    role: "Head of Trust & Safety",
    aliases: ["veer", "veer_ydms"],
    socials: [
      {
        platform: "twitter",
        label: "Twitter",
        url: "https://twitter.com/Veer_YDMS",
      },
    ],
  },
  {
    id: "dante",
    displayName: "Dante",
    wikiPath: "User:Dante",
    section: "Trust and safety",
    role: "Support & Moderation Lead",
    aliases: ["dante"],
    socials: [],
  },
];

function normalizeHandle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function wikiProfileUrl(member: TeamMember): string {
  return `https://wiki.resonite.com/${member.wikiPath.replace(/ /g, "_")}`;
}

export function discordProfileUrl(member: TeamMember): string | null {
  const d = member.discord;
  if (!d) {
    return null;
  }
  if (d.userId?.trim()) {
    return `https://discord.com/users/${d.userId.trim()}`;
  }
  return null;
}

export function matchTeamMemberFromQuery(query: string): TeamMember | null {
  const raw = query.trim();
  if (!raw) {
    return null;
  }

  const byId = RESONITE_TEAM_ROSTER.find(
    (m) => m.id.toLowerCase() === raw.toLowerCase(),
  );
  if (byId) {
    return byId;
  }

  const handle = normalizeHandle(raw);
  for (const member of RESONITE_TEAM_ROSTER) {
    const keys = new Set<string>([
      normalizeHandle(member.id),
      normalizeHandle(member.displayName),
      ...member.aliases.map(normalizeHandle),
    ]);
    if (keys.has(handle)) {
      return member;
    }
  }
  return null;
}

export function matchTeamMemberFromDiscordUser(user: User): TeamMember | null {
  const handles = new Set<string>();
  for (const raw of [user.username, user.globalName, user.displayName]) {
    if (raw?.trim()) {
      handles.add(normalizeHandle(raw));
    }
  }

  for (const member of RESONITE_TEAM_ROSTER) {
    const keys = new Set<string>([
      normalizeHandle(member.id),
      normalizeHandle(member.displayName),
      ...member.aliases.map(normalizeHandle),
    ]);
    for (const h of handles) {
      if (keys.has(h)) {
        return member;
      }
    }
  }
  return null;
}

/** Platforms this member actually has links for (plus `all`). */
export function getAvailablePlatformsForMember(
  member: TeamMember,
): PlatformChoice[] {
  const ids = new Set<string>();

  const hasWiki = Boolean(member.wikiPath?.trim());
  const hasDiscord = Boolean(
    member.discord?.userId?.trim() || member.discord?.username?.trim(),
  );
  const hasSocials = member.socials.length > 0;

  if (hasWiki || hasDiscord || hasSocials) {
    ids.add("all");
  }
  if (hasWiki) {
    ids.add("wiki");
  }
  if (hasDiscord) {
    ids.add("discord");
  }

  for (const link of member.socials) {
    ids.add(link.platform);
    if (link.platform === "twitter") {
      ids.add("x");
    }
    if (link.platform === "fediverse") {
      ids.add("mastodon");
    }
  }

  const order = [
    "all",
    "wiki",
    "discord",
    "twitter",
    "x",
    "youtube",
    "github",
    "reddit",
    "bluesky",
    "twitch",
    "tiktok",
    "fediverse",
    "mastodon",
    "carrd",
    "website",
    "blog",
  ];

  return [...ids]
    .sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) {
        return a.localeCompare(b);
      }
      if (ai === -1) {
        return 1;
      }
      if (bi === -1) {
        return -1;
      }
      return ai - bi;
    })
    .map((id) => ({
      id,
      label: PLATFORM_LABELS[id] ?? id,
    }));
}

export function teamMemberAutocomplete(
  query: string,
): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  const matches = RESONITE_TEAM_ROSTER.filter((m) => {
    if (!q) {
      return true;
    }
    if (m.id.toLowerCase().includes(q)) {
      return true;
    }
    if (m.displayName.toLowerCase().includes(q)) {
      return true;
    }
    return m.aliases.some((a) => a.toLowerCase().includes(q));
  });

  return matches.slice(0, 25).map((m) => ({
    name: m.displayName.slice(0, 100),
    value: m.id,
  }));
}

export function platformAutocompleteForUser(
  userQuery: string | null | undefined,
  platformQuery: string,
): { name: string; value: string }[] {
  const member = userQuery ? matchTeamMemberFromQuery(userQuery) : null;
  if (!member) {
    return [];
  }

  const q = platformQuery.trim().toLowerCase();
  return getAvailablePlatformsForMember(member)
    .filter((p) => {
      if (!q) {
        return true;
      }
      return (
        p.id.includes(q) ||
        p.label.toLowerCase().includes(q)
      );
    })
    .slice(0, 25)
    .map((p) => ({
      name: p.label.slice(0, 100),
      value: p.id,
    }));
}

export function normalizePlatformInput(raw: string): string {
  const p = raw.trim().toLowerCase();
  if (p === "x") {
    return "twitter";
  }
  if (p === "mastodon") {
    return "fediverse";
  }
  if (p === "resonite") {
    return "wiki";
  }
  return p;
}

function wikiLink(member: TeamMember): DisplayLink | null {
  if (!member.wikiPath?.trim()) {
    return null;
  }
  return {
    label: "Resonite Wiki",
    url: wikiProfileUrl(member),
    platformId: "wiki",
  };
}

function discordLink(member: TeamMember): DisplayLink | null {
  const url = discordProfileUrl(member);
  if (!url) {
    return null;
  }
  const mention = member.discord?.username
    ? `@${member.discord.username}`
    : "Discord profile";
  return { label: `Discord (${mention})`, url, platformId: "discord" };
}

export function getAllMemberLinks(member: TeamMember): DisplayLink[] {
  const out: DisplayLink[] = [];
  const seen = new Set<string>();

  const push = (link: DisplayLink | null) => {
    if (!link || seen.has(link.url)) {
      return;
    }
    seen.add(link.url);
    out.push(link);
  };

  push(wikiLink(member));
  push(discordLink(member));
  for (const s of member.socials) {
    push({ label: s.label, url: s.url, platformId: s.platform });
  }

  return out;
}

export function resolveMemberPlatformLinks(
  member: TeamMember,
  platform: string,
): { links: DisplayLink[]; platformLabel: string } {
  const p = normalizePlatformInput(platform);

  if (p === "all") {
    return {
      links: getAllMemberLinks(member),
      platformLabel: PLATFORM_LABELS.all ?? "All platforms",
    };
  }

  if (p === "wiki") {
    const link = wikiLink(member);
    return {
      links: link ? [link] : [],
      platformLabel: PLATFORM_LABELS.wiki ?? "Resonite Wiki",
    };
  }

  if (p === "discord") {
    const link = discordLink(member);
    return {
      links: link ? [link] : [],
      platformLabel: PLATFORM_LABELS.discord ?? "Discord",
    };
  }

  const social = member.socials.filter((s) => s.platform === p);
  const label = PLATFORM_LABELS[p] ?? p;

  return {
    links: social.map((s) => ({
      label: s.label,
      url: s.url,
      platformId: s.platform,
    })),
    platformLabel: label,
  };
}
