import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} from "@discordjs/builders";
import {
  ButtonStyle,
  MessageFlags,
  type InteractionReplyOptions,
} from "discord.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";
import { buildShowcaseInChannelRow } from "../../utility/discord/showcasePublicButton.js";
import type { ShowcasePublicJobV1 } from "../../utility/discord/showcasePublicStore.js";
import {
  extractGitHubMarkdownImageUrls,
  GITHUB_MARKDOWN_IMAGE_LIMIT,
  stripGitHubMarkdownImages,
} from "./githubMarkdownImages.js";
import type { YdmIssueRepoResult } from "./resoniteIssuesRepoSearch.js";
import {
  formatYdmItemNumberLabel,
  isInProgressItem,
  YDM_PROJECT_BOARDS,
  type YdmProjectItem,
} from "./yellowDogManProjects.js";

function buildYdmProjectItemMarkdown(item: YdmProjectItem): string {
  const title =
    item.number !== null
      ? `# ${formatYdmItemNumberLabel(item)} ${item.title}`
      : `# ${item.title}`;

  const meta: string[] = [];
  if (item.status) {
    meta.push(`**Status:** ${item.status}`);
  }
  if (item.state) {
    meta.push(`**State:** ${item.state}`);
  }
  if (item.repo) {
    meta.push(`**Repo:** ${item.repo}`);
  }
  meta.push(`**Board:** ${item.memberLabel} — ${item.projectTitle}`);

  const rawBody = item.body?.trim() ?? "";
  const images = extractGitHubMarkdownImageUrls(rawBody);
  const body = rawBody
    ? truncateEllipsis(
        images.length > 0 ? stripGitHubMarkdownImages(rawBody) : rawBody,
        3500,
      )
    : "_No description on the project item._";

  const parts = [title, meta.join("\n"), "", body];
  if (images.length > GITHUB_MARKDOWN_IMAGE_LIMIT) {
    parts.push(
      "",
      `_Showing first ${GITHUB_MARKDOWN_IMAGE_LIMIT} image(s) from the description._`,
    );
  }

  return parts.join("\n");
}

export function buildYdmProjectItemComponents(
  item: YdmProjectItem,
): ContainerBuilder[] {
  const container = new ContainerBuilder().setAccentColor(
    isInProgressItem(item) ? 0x57f287 : 0x5865f2,
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      truncateEllipsis(buildYdmProjectItemMarkdown(item), 4000),
    ),
  );

  const imageUrls = extractGitHubMarkdownImageUrls(item.body);
  if (imageUrls.length > 0) {
    const gallery = new MediaGalleryBuilder();
    for (const url of imageUrls) {
      gallery.addItems(
        new MediaGalleryItemBuilder()
          .setURL(url)
          .setDescription(truncateEllipsis(item.title, 100)),
      );
    }
    container.addMediaGalleryComponents(gallery);
  }

  if (item.url?.startsWith("http")) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("Open on GitHub")
          .setURL(item.url),
      ),
    );
  }

  return [container];
}

/**
 * When a repo search hit is not on a team project board, still render like {@link buildYdmProjectItemComponents}
 * using REST-fetched body text.
 */
export function syntheticYdmProjectItemFromRepoIssue(
  hit: YdmIssueRepoResult,
  body: string | null,
): YdmProjectItem {
  const firstBoard = YDM_PROJECT_BOARDS[0];
  return {
    projectKey: firstBoard.key,
    projectTitle: hit.repo,
    memberLabel: "Repository search",
    title: hit.title,
    number: hit.number,
    url: hit.url,
    status: hit.labels.length
      ? truncateEllipsis(hit.labels.join(", "), 500)
      : null,
    state: hit.state,
    repo: hit.repo,
    body,
  };
}

/**
 * Discord interaction replies must use {@link MessageFlags.Ephemeral}, not `ephemeral: boolean`.
 *
 * `privateReply` — when omitted or true, reply is ephemeral (only invoker).
 */
export function ydmProjectItemReplyPayload(
  item: YdmProjectItem,
  opts?: { readonly privateReply?: boolean; showcase?: boolean },
): InteractionReplyOptions {
  let n = MessageFlags.IsComponentsV2;
  const hideFromOthers = opts?.privateReply !== false;
  if (hideFromOthers) {
    n |= MessageFlags.Ephemeral;
  }
  const base = buildYdmProjectItemComponents(item);
  const allowShowcase = hideFromOthers && opts?.showcase !== false;
  const components =
    allowShowcase && item.number !== null && item.number > 0
      ? [
          ...base,
          buildShowcaseInChannelRow({
            v: 1,
            kind: "gh_issue",
            ref: {
              boardKey: item.projectKey,
              number: item.number,
              repo: item.repo ?? null,
              includeDone: true,
              inProgressOnly: false,
            },
          } satisfies ShowcasePublicJobV1),
        ]
      : base;
  return {
    embeds: [],
    components,
    flags: n as InteractionReplyOptions["flags"],
  };
}
