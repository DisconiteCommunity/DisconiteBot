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
  EmbedBuilder,
  MessageFlags,
  type MessageCreateOptions,
} from "discord.js";
import { truncateEllipsis } from "../text/truncate.js";
import {
  fetchWikiPageWikitextIfExists,
  resolveWikiImageUrlFromWikitext,
  wikiArticleUrl,
  wikitextToDiscordMarkdown,
} from "../../services/resonite/wiki/wikiSearch.js";
import { linkButtonRow } from "./linkButtonRow.js";

const WIKI_PREVIEW_CHARACTER_MIN = 500;
const WIKI_PREVIEW_CHARACTER_MAX = 1500;

function clampWikiPreviewLen(
  raw: number | null | undefined,
): number {
  if (raw === null || raw === undefined) {
    return WIKI_PREVIEW_CHARACTER_MIN;
  }
  const truncated = Math.trunc(Number(raw));
  if (Number.isNaN(truncated)) {
    return WIKI_PREVIEW_CHARACTER_MIN;
  }
  return Math.min(
    WIKI_PREVIEW_CHARACTER_MAX,
    Math.max(WIKI_PREVIEW_CHARACTER_MIN, truncated),
  );
}

export function buildWikiPreviewEmbed(
  canonicalTitle: string,
  wikitext: string,
  previewLimit: number,
  imageUrl: string | null,
): EmbedBuilder {
  const md = wikitextToDiscordMarkdown(wikitext, previewLimit);
  const embed = new EmbedBuilder()
    .setTitle(truncateEllipsis(canonicalTitle, 256))
    .setDescription(truncateEllipsis(md, previewLimit));
  if (imageUrl) {
    embed.setImage(imageUrl);
  }
  return embed;
}

export async function materializeWikiExactV2Showcase(
  title: string,
  previewRaw: number,
): Promise<
  | { ok: true; payload: Pick<MessageCreateOptions, "components" | "embeds" | "flags"> }
  | { ok: false; message: string }
> {
  const previewLimit = clampWikiPreviewLen(previewRaw);
  const page = await fetchWikiPageWikitextIfExists(title);
  if (!page) {
    return { ok: false, message: "That wiki page is no longer available." };
  }

  let titleLine = `# ${page.title}`;
  if (titleLine.length > previewLimit) {
    titleLine = truncateEllipsis(titleLine, previewLimit);
  }
  const sep = titleLine.length < previewLimit ? "\n\n" : "";
  const bodyBudget = Math.max(0, previewLimit - titleLine.length - sep.length);
  const body =
    bodyBudget > 0
      ? wikitextToDiscordMarkdown(page.wikitext, bodyBudget)
      : "";
  const content = body ? `${titleLine}${sep}${body}` : titleLine;

  const imageUrl = await resolveWikiImageUrlFromWikitext(page.wikitext);

  const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Open full page")
      .setURL(wikiArticleUrl(page.title)),
  );

  const container = new ContainerBuilder();
  if (imageUrl) {
    const item = new MediaGalleryItemBuilder()
      .setURL(imageUrl)
      .setDescription(truncateEllipsis(page.title, 100));
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(item),
    );
  }
  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
    .addActionRowComponents(linkRow);

  const payload: Pick<MessageCreateOptions, "components" | "embeds" | "flags"> = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };

  return { ok: true, payload };
}

export async function materializeWikiEmbedPickShowcase(
  title: string,
  previewRaw: number,
): Promise<
  | { ok: true; payload: Pick<MessageCreateOptions, "components" | "embeds"> }
  | { ok: false; message: string }
> {
  const previewLimit = clampWikiPreviewLen(previewRaw);
  const page = await fetchWikiPageWikitextIfExists(title);
  if (!page) {
    return { ok: false, message: "That wiki page is no longer available." };
  }
  const imageUrl = await resolveWikiImageUrlFromWikitext(page.wikitext);
  const embed = buildWikiPreviewEmbed(
    page.title,
    page.wikitext,
    previewLimit,
    imageUrl,
  );
  const linkRow = linkButtonRow([
    { label: "Open full page", url: wikiArticleUrl(page.title) },
  ]);

  const payload: Pick<MessageCreateOptions, "components" | "embeds"> = {
    embeds: [embed],
    components: linkRow ? [linkRow] : [],
  };

  return { ok: true, payload };
}
