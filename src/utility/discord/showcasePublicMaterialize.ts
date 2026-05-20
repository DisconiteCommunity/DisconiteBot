import { EmbedBuilder, MessageFlags, type MessageCreateOptions } from "discord.js";
import type { ShowcasePublicJobV1 } from "./showcasePublicStore.js";
import {
  fetchYdmRepoIssueRestSummary,
} from "../../services/github/resoniteIssuesRepoSearch.js";
import {
  syntheticYdmProjectItemFromRepoIssue,
  ydmProjectItemReplyPayload,
} from "../../services/github/ydmProjectsItemComponentsV2.js";
import { resolveYdmProjectItemByRef } from "../../services/github/ydmProjectsCache.js";
import { findYdmProjectItemByRepoAndNumber } from "../../services/github/ydmProjectsCache.js";
import {
  buildUsersSearchApiUrl,
  searchUsersByName,
} from "../../services/resonite/users/users.js";
import { parseRecordInput } from "../../services/resonite/records/recordLinks.js";
import {
  buildRecordInventoryJsonApiUrl,
  buildGoResoniteWorldUrl,
  fetchRecordById,
  fetchRecordByInventoryPath,
  fetchSession,
  summarizeRecordPayload,
  summarizeSessionPayload,
  buildGoResoniteSessionUrl,
  buildRecordJsonApiUrl,
  buildSessionJsonApiUrl,
  buildSessionResoniteComUrl,
  buildOpenResoniteSessionUrl,
} from "../../services/resonite/records/records.js";
import {
  materializeWikiEmbedPickShowcase,
  materializeWikiExactV2Showcase,
} from "./wikiShowcasePayload.js";
import { getForumPostHit } from "../../services/disconite/discourse/searchPosts.js";
import {
  buildTranslationContainer,
  buildTranslationLinkRow,
} from "./translationComponentsV2.js";
import { getWeblateKeyGroup } from "../../services/disconite/weblate/searchUnits.js";
import { truncateEllipsis } from "../text/truncate.js";
import { linkButtonRow } from "./linkButtonRow.js";

export type ShowcasePublicMaterializePayload = Pick<
  MessageCreateOptions,
  "content" | "embeds" | "components" | "flags"
>;

export type ShowcasePublicMaterializeResult =
  | { ok: true; payload: ShowcasePublicMaterializePayload }
  | { ok: false; message: string };

async function ghIssuePayload(
  job: Extract<ShowcasePublicJobV1, { kind: "gh_issue" }>,
): Promise<ShowcasePublicMaterializeResult> {
  const { ref } = job;
  let item =
    ref.repo !== null && ref.repo.length > 0
      ? await findYdmProjectItemByRepoAndNumber(ref.repo, ref.number)
      : null;
  item ??= await resolveYdmProjectItemByRef(ref);
  if (
    !item &&
    typeof ref.repo === "string" &&
    ref.repo.trim().length > 0 &&
    Number.isFinite(ref.number) &&
    ref.number > 0
  ) {
    const summary = await fetchYdmRepoIssueRestSummary(ref.repo.trim(), ref.number);
    if (summary) {
      item = syntheticYdmProjectItemFromRepoIssue(summary.hit, summary.body);
    }
  }
  if (!item || item.number === null || item.number < 1) {
    return {
      ok: false,
      message:
        "Could not reload that GitHub issue (cache may have refreshed). Try the command again.",
    };
  }
  const built = ydmProjectItemReplyPayload(item, {
    privateReply: false,
    showcase: false,
  });
  return {
    ok: true,
    payload: {
      embeds: built.embeds ?? [],
      components: built.components ?? [],
      flags: MessageFlags.IsComponentsV2,
    },
  };
}

function buildForumPostEmbedFromHit(hit: {
  topicTitle: string;
  postUrl: string;
  authorLine: string;
  blurb: string;
  likeCount: number;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(truncateEllipsis(hit.topicTitle, 256))
    .setURL(hit.postUrl)
    .setDescription(
      truncateEllipsis(
        [hit.authorLine, "", hit.blurb, "", `❤ ${hit.likeCount}`].join("\n"),
        4096,
      ),
    );
}

async function recordUrlPayload(
  url: string,
): Promise<ShowcasePublicMaterializeResult> {
  const parsed = parseRecordInput(url);
  if (!parsed.ok) {
    return { ok: false, message: parsed.reason };
  }

  try {
    if (parsed.value.kind === "session") {
      const json = await fetchSession(parsed.value.sessionId);
      const sum = summarizeSessionPayload(json, parsed.value.sessionId);
      const desc = truncateEllipsis(
        sum.lines.length ? sum.lines.join("\n") : "No extra session fields.",
        4096,
      );
      const openSession = buildOpenResoniteSessionUrl(sum.sessionId);
      const embed = new EmbedBuilder()
        .setTitle(sum.title)
        .setDescription(desc)
        .setFooter({ text: `${sum.sessionId} · ${openSession}` });
      const row = linkButtonRow([
        { label: "Session (API)", url: buildSessionJsonApiUrl(sum.sessionId) },
        { label: "Join session", url: openSession },
        { label: "Web preview", url: buildGoResoniteSessionUrl(sum.sessionId) },
        {
          label: "View Session",
          url: buildSessionResoniteComUrl(sum.sessionId),
        },
      ]);
      return {
        ok: true,
        payload: {
          embeds: [embed],
          components: row ? [row] : [],
        },
      };
    }

    let ownerId = parsed.value.ownerId;
    let json: Record<string, unknown>;

    if (parsed.value.kind === "record") {
      json = await fetchRecordById(ownerId, parsed.value.recordId);
    } else {
      json = await fetchRecordByInventoryPath(ownerId, parsed.value.path);
      const rid = typeof json.id === "string" ? json.id : "";
      if (rid.startsWith("R-")) {
        ownerId =
          typeof json.ownerId === "string" && json.ownerId
            ? json.ownerId
            : ownerId;
      }
    }

    const summary = summarizeRecordPayload(json, ownerId);
    const parts: string[] = [];
    parts.push(`Owner: ${summary.ownerName ?? summary.ownerId}`);
    parts.push(`Record id: ${summary.recordId || "—"}`);
    if (summary.recordType) {
      parts.push(`Type: ${summary.recordType}`);
    }
    if (summary.isPublic !== undefined) {
      parts.push(`Public: ${summary.isPublic ? "yes" : "no"}`);
    }
    if (summary.isListed !== undefined) {
      parts.push(`Listed: ${summary.isListed ? "yes" : "no"}`);
    }
    for (const line of summary.extraLines) {
      parts.push(line);
    }
    if (summary.openInResoniteUrl) {
      parts.push(`${summary.openInResoniteLabel}: ${summary.openInResoniteUrl}`);
    }

    const embed = new EmbedBuilder()
      .setTitle(truncateEllipsis(summary.title, 256))
      .setDescription(truncateEllipsis(parts.join("\n"), 4096));

    if (summary.imageUrl) {
      embed.setThumbnail(summary.imageUrl);
    } else {
      embed.setFooter({
        text: "No thumbnail or preview image in this API response.",
      });
    }

    const apiLinks: { label: string; url: string }[] =
      parsed.value.kind === "record"
        ? [
            {
              label: "Record (API)",
              url: buildRecordJsonApiUrl(
                parsed.value.ownerId,
                parsed.value.recordId,
              ),
            },
          ]
        : [
            {
              label: "Record (API)",
              url: buildRecordInventoryJsonApiUrl(ownerId, parsed.value.path),
            },
          ];
    if (summary.openInResoniteUrl) {
      apiLinks.push({
        label: summary.openInResoniteLabel,
        url: summary.openInResoniteUrl,
      });
    }
    if (
      summary.recordType?.toLowerCase() === "world" &&
      summary.recordId.startsWith("R-")
    ) {
      apiLinks.push({
        label: "Web preview",
        url: buildGoResoniteWorldUrl(summary.ownerId, summary.recordId),
      });
    }
    if (summary.imageUrl) {
      apiLinks.push({
        label: "Thumbnail (CDN)",
        url: summary.imageUrl,
      });
    }
    const row = linkButtonRow(apiLinks);

    return {
      ok: true,
      payload: {
        embeds: [embed],
        components: row ? [row] : [],
      },
    };
  } catch {
    return {
      ok: false,
      message:
        "Could not reload that session or record link. Try `/resonite search record` again.",
    };
  }
}

export async function materializeShowcasePublicJob(
  job: ShowcasePublicJobV1,
): Promise<ShowcasePublicMaterializeResult> {
  switch (job.kind) {
    case "gh_issue":
      return ghIssuePayload(job);
    case "wiki_exact_v2":
      return materializeWikiExactV2Showcase(job.title, job.previewLimit);
    case "wiki_embed":
      return materializeWikiEmbedPickShowcase(job.title, job.previewLimit);
    case "account_users": {
      const username = job.username.trim();
      if (!username) {
        return { ok: false, message: "Missing username." };
      }
      const users = await searchUsersByName(username);
      if (users.length === 0) {
        return {
          ok: false,
          message: "Those user results are no longer available. Run the search again.",
        };
      }
      const embed = new EmbedBuilder()
        .setTitle("Resonite users")
        .setDescription(
          truncateEllipsis(
            `Matches for **${username.trim()}** (showing up to 5).`,
            4096,
          ),
        );
      const slice = users.slice(0, 5);
      for (const u of slice) {
        const bits: string[] = [`**ID:** ${String(u.id)}`];
        if (u.normalizedUsername) {
          bits.push(`Normalized: ${u.normalizedUsername}`);
        }
        if (u.registrationDate) {
          bits.push(`Registered: ${u.registrationDate}`);
        }
        bits.push(
          `Verified: ${u.isVerified === true ? "yes" : u.isVerified === false ? "no" : "—"}`,
        );
        bits.push(
          `Locked: ${u.isLocked === true ? "yes" : u.isLocked === false ? "no" : "—"}`,
        );
        bits.push(
          `Supporter: ${u.isActiveSupporter === true ? "yes" : u.isActiveSupporter === false ? "no" : "—"}`,
        );
        embed.addFields({
          name: truncateEllipsis(u.username, 256),
          value: truncateEllipsis(bits.join("\n"), 1024),
          inline: false,
        });
      }
      const row = linkButtonRow([
        { label: "Users search (API)", url: buildUsersSearchApiUrl(username) },
      ]);

      return {
        ok: true,
        payload: {
          embeds: [embed],
          components: row ? [row] : [],
        },
      };
    }
    case "record_url":
      return recordUrlPayload(job.url);
    case "forum_post": {
      const hit = await getForumPostHit(job.query, job.index);
      if (!hit) {
        return {
          ok: false,
          message:
            "That forum hit is stale. Run `/disconite search forum` again.",
        };
      }
      const embed = buildForumPostEmbedFromHit(hit);
      const row = linkButtonRow([{ label: "Open post", url: hit.postUrl }]);
      return {
        ok: true,
        payload: {
          embeds: [embed],
          components: row ? [row] : [],
        },
      };
    }
    case "translate": {
      const group = await getWeblateKeyGroup(
        job.context,
        job.rawQuery ?? undefined,
      );
      if (!group) {
        return {
          ok: false,
          message:
            "That translation key row is stale. Run `/disconite search translation` again.",
        };
      }
      const container = buildTranslationContainer(group, job.languages);
      container.addActionRowComponents(
        buildTranslationLinkRow(group, job.languages),
      );

      return {
        ok: true,
        payload: {
          embeds: [],
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        },
      };
    }
    default:
      return { ok: false, message: "Unknown showcase payload." };
  }
}
