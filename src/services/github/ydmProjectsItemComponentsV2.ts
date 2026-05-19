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
import {
  extractGitHubMarkdownImageUrls,
  GITHUB_MARKDOWN_IMAGE_LIMIT,
  stripGitHubMarkdownImages,
} from "./githubMarkdownImages.js";
import {
  formatYdmItemNumberLabel,
  isInProgressItem,
  type YdmProjectItem,
} from "./yellowDogManProjects.js";

function buildYdmProjectItemMarkdown(item: YdmProjectItem): string {
  const title =
    item.number != null
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

export function ydmProjectItemReplyPayload(
  item: YdmProjectItem,
  opts?: { readonly ephemeral?: boolean },
): InteractionReplyOptions {
  let n = MessageFlags.IsComponentsV2;
  if (opts?.ephemeral !== false) {
    n |= MessageFlags.Ephemeral;
  }
  return {
    embeds: [],
    components: buildYdmProjectItemComponents(item),
    flags: n as InteractionReplyOptions["flags"],
  };
}
