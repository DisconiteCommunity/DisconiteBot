import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from "@discordjs/builders";
import { Discord, SelectMenuComponent, Slash, SlashGroup, SlashOption } from "discordx";
import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ButtonStyle,
  CommandInteraction,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import { loggers } from "../../utility/logging/logger.js";
import { toDiscordStringAutocompleteChoices } from "../../utility/discord/discordAutocompleteChoices.js";
import { linkButtonRow } from "../../utility/discord/linkButtonRow.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";
import { isGitHubConfigured } from "../../config/github.js";
import {
  defaultYdmIssuesSearchState,
  renderYdmIssuesSearchDashboard,
} from "../../services/github/ydmIssuesSearchDashboard.js";
import { missingGitHubTokenMessage } from "../../services/github/ydmProjectsReply.js";
import { ResoniteApiError } from "../../services/resonite/api/api.js";
import { parseRecordInput } from "../../services/resonite/records/recordLinks.js";
import {
  buildRecordInventoryJsonApiUrl,
  buildGoResoniteSessionUrl,
  buildGoResoniteWorldUrl,
  buildRecordJsonApiUrl,
  buildOpenResoniteSessionUrl,
  buildSessionJsonApiUrl,
  buildSessionResoniteComUrl,
  fetchRecordById,
  fetchRecordByInventoryPath,
  fetchSession,
  summarizeRecordPayload,
  summarizeSessionPayload,
} from "../../services/resonite/records/records.js";
import {
  buildUsersSearchApiUrl,
  searchResoniteUsernamesAutocomplete,
  searchUsersByName,
} from "../../services/resonite/users/users.js";
import {
  fetchWikiPageWikitextIfExists,
  resolveWikiImageUrlFromWikitext,
  searchWikiTitles,
  type WikiSearchHit,
  wikiArticleUrl,
  wikiOpenSearchForAutocomplete,
  wikitextToDiscordMarkdown,
} from "../../services/resonite/wiki/wikiSearch.js";
import {
  WIKI_PAGE_PICK_MENU_ID,
  WIKI_PAGE_PICK_STATE_PREFIX,
} from "../../utility/discord/discordInteractionIds.js";
import {
  slashDeferEphemeralFlags,
  slashEphemeralMessageFlag,
  slashEphemeralReplyFlags,
  slashVisibleOption,
} from "../../utility/discord/interactionVisibility.js";

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

type WikiPickState = {
  titles: string[];
  ephemeral: boolean;
  previewLimit: number;
};

function encodeWikiPickFooter(state: WikiPickState): string {
  const slim: WikiPickState = {
    titles: state.titles.slice(0, 10).map((title) => title.slice(0, 150)),
    ephemeral: state.ephemeral,
    previewLimit: state.previewLimit,
  };
  let encodedState = Buffer.from(JSON.stringify(slim), "utf8").toString(
    "base64url",
  );
  let footerText = `${WIKI_PAGE_PICK_STATE_PREFIX}${encodedState}`;
  if (footerText.length > 2048) {
    slim.titles = slim.titles.map((title) => title.slice(0, 60));
    encodedState = Buffer.from(JSON.stringify(slim), "utf8").toString(
      "base64url",
    );
    footerText = `${WIKI_PAGE_PICK_STATE_PREFIX}${encodedState}`;
  }
  return footerText;
}

function decodeWikiPickFooter(text: string | null | undefined): WikiPickState | null {
  if (!text?.startsWith(WIKI_PAGE_PICK_STATE_PREFIX)) {
    return null;
  }
  try {
    const json = Buffer.from(
      text.slice(WIKI_PAGE_PICK_STATE_PREFIX.length),
      "base64url",
    ).toString("utf8");
    const parsed = JSON.parse(json) as WikiPickState;
    if (!Array.isArray(parsed.titles)) {
      return null;
    }
    return {
      titles: parsed.titles,
      ephemeral: Boolean(parsed.ephemeral),
      previewLimit: clampWikiPreviewLen(
        typeof parsed.previewLimit === "number"
          ? parsed.previewLimit
          : WIKI_PREVIEW_CHARACTER_MIN,
      ),
    };
  } catch {
    return null;
  }
}

async function replyWikiExactV2(
  interaction: CommandInteraction,
  exact: { title: string; wikitext: string },
  visible: boolean | undefined,
  previewLimit: number,
): Promise<void> {
  let titleLine = `# ${exact.title}`;
  if (titleLine.length > previewLimit) {
    titleLine = truncateEllipsis(titleLine, previewLimit);
  }
  const sep = titleLine.length < previewLimit ? "\n\n" : "";
  const bodyBudget = Math.max(0, previewLimit - titleLine.length - sep.length);
  const body =
    bodyBudget > 0
      ? wikitextToDiscordMarkdown(exact.wikitext, bodyBudget)
      : "";
  const content = body ? `${titleLine}${sep}${body}` : titleLine;

  const imageUrl = await resolveWikiImageUrlFromWikitext(exact.wikitext);

  const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Open full page")
      .setURL(wikiArticleUrl(exact.title)),
  );

  const container = new ContainerBuilder();
  if (imageUrl) {
    const item = new MediaGalleryItemBuilder()
      .setURL(imageUrl)
      .setDescription(truncateEllipsis(exact.title, 100));
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(item),
    );
  }
  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
    .addActionRowComponents(linkRow);

  await interaction.reply({
    components: [container],
    flags: wikiReplyFlags(visible, true),
  });
}

function buildWikiPreviewEmbed(
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

function buildWikiPickListMessage(
  hits: WikiSearchHit[],
  visible: boolean | undefined,
  previewLimit: number,
): { embed: EmbedBuilder; row: ActionRowBuilder<StringSelectMenuBuilder> } {
  const state: WikiPickState = {
    titles: hits.map((h) => h.title),
    ephemeral: visible !== true,
    previewLimit,
  };
  const desc = truncateEllipsis(
    hits
      .map((h, i) => {
        const sn = h.snippet
          ? `\n${truncateEllipsis(h.snippet, 72)}`
          : "";
        return `**${i + 1}.** ${h.title}${sn}`;
      })
      .join("\n\n"),
    previewLimit,
  );

  const embed = new EmbedBuilder()
    .setTitle("Choose a wiki page")
    .setDescription(desc)
    .setFooter({ text: encodeWikiPickFooter(state) });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(WIKI_PAGE_PICK_MENU_ID)
    .setPlaceholder("Select a page…")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      hits.map((h, i) => {
        const opt = new StringSelectMenuOptionBuilder()
          .setLabel(truncateEllipsis(h.title, 100))
          .setValue(String(i));
        if (h.snippet) {
          opt.setDescription(truncateEllipsis(h.snippet, 100));
        }
        return opt;
      }),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    menu,
  );
  return { embed, row };
}

function wikiReplyFlags(
  visible: boolean | undefined,
  useComponentsV2: boolean,
): InteractionReplyOptions["flags"] | undefined {
  let n = 0;
  if (useComponentsV2) {
    n |= MessageFlags.IsComponentsV2;
  }
  n |= slashEphemeralMessageFlag(visible);
  if (n === 0) {
    return undefined;
  }
  return n as InteractionReplyOptions["flags"];
}

async function wikiQueryAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const query = typeof focused.value === "string" ? focused.value : "";
  try {
    const titles = await wikiOpenSearchForAutocomplete(query, 25);
    await interaction.respond(toDiscordStringAutocompleteChoices(titles));
  } catch {
    await interaction.respond([]);
  }
}

async function accountUsernameAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const query = typeof focused.value === "string" ? focused.value : "";
  try {
    const names = await searchResoniteUsernamesAutocomplete(query, 25);
    await interaction.respond(toDiscordStringAutocompleteChoices(names));
  } catch {
    await interaction.respond([]);
  }
}

@Discord()
@SlashGroup({
  name: "resonite",
  description:
    "Resonite wiki, accounts, records, and team socials (public APIs + roster).",
})
@SlashGroup({
  name: "search",
  description: "Search wiki & users, or resolve a record or session URL.",
  root: "resonite",
})
@SlashGroup("search", "resonite")
export class ResoniteSearchCommands {
  @Slash({
    name: "github",
    description:
      "Search Resonite GitHub issues and YDM project-board items with interactive filters.",
  })
  async github(
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!isGitHubConfigured()) {
      await interaction.reply({
        content: missingGitHubTokenMessage(),
        flags: slashEphemeralReplyFlags(visible),
      });
      return;
    }

    await interaction.deferReply(slashDeferEphemeralFlags(visible));
    try {
      await renderYdmIssuesSearchDashboard(interaction, {
        ...defaultYdmIssuesSearchState(),
      });
    } catch (err) {
      loggers.resonite.error("github search dashboard failed", err, {});
      await interaction.editReply({
        content: "Could not load the GitHub search dashboard.",
        components: [],
      });
    }
  }

  @Slash({
    name: "wiki",
    description:
      "Search the official Resonite wiki (MediaWiki opensearch; type for suggestions).",
  })
  async wiki(
    @SlashOption({
      name: "query",
      description: "Wiki page title or keywords (autocomplete)",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: wikiQueryAutocomplete,
    })
    query: string,
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    @SlashOption({
      name: "preview_characters",
      description:
        "Max characters for wiki preview text (500–1500). Default 500.",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: WIKI_PREVIEW_CHARACTER_MIN,
      maxValue: WIKI_PREVIEW_CHARACTER_MAX,
    })
    previewCharacters: number | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    const previewLimit = clampWikiPreviewLen(previewCharacters);
    try {
      const exact = await fetchWikiPageWikitextIfExists(query);
      if (exact) {
        await replyWikiExactV2(interaction, exact, visible, previewLimit);
        return;
      }

      const hits = await searchWikiTitles(query, 10);
      if (hits.length === 0) {
        await interaction.reply({
          content: "No wiki pages matched that query.",
          flags: wikiReplyFlags(visible, false),
        });
        return;
      }

      if (hits.length === 1) {
        const only = await fetchWikiPageWikitextIfExists(hits[0].title);
        if (only) {
          await replyWikiExactV2(interaction, only, visible, previewLimit);
          return;
        }
        const { embed, row } = buildWikiPickListMessage(
          hits,
          visible,
          previewLimit,
        );
        await interaction.reply({
          embeds: [embed],
          components: [row],
          flags: wikiReplyFlags(visible, false),
        });
        return;
      }

      const { embed, row } = buildWikiPickListMessage(
        hits,
        visible,
        previewLimit,
      );
      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: wikiReplyFlags(visible, false),
      });
    } catch (err) {
      loggers.resonite.error("wiki search failed", err, { query });
      await interaction.reply({
        content:
          "Wiki search failed (network or API error). Try again in a moment.",
        flags: wikiReplyFlags(visible, false),
      });
    }
  }

  @SelectMenuComponent({ id: WIKI_PAGE_PICK_MENU_ID })
  async wikiPagePick(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      await interaction.deferUpdate();
      const footer = interaction.message.embeds[0]?.footer?.text;
      const pickState = decodeWikiPickFooter(footer);
      const selectedIndex = parseInt(interaction.values[0] ?? "", 10);
      if (
        !pickState ||
        Number.isNaN(selectedIndex) ||
        selectedIndex < 0 ||
        selectedIndex >= pickState.titles.length
      ) {
        await interaction.followUp({
          content:
            "That menu is out of date or invalid. Run `/resonite search wiki` again.",
          ephemeral: true,
        });
        return;
      }
      const title = pickState.titles[selectedIndex];
      if (title === undefined) {
        await interaction.followUp({
          content:
            "That menu is out of date or invalid. Run `/resonite search wiki` again.",
          ephemeral: true,
        });
        return;
      }
      const page = await fetchWikiPageWikitextIfExists(title);
      if (!page) {
        await interaction.followUp({
          content: `Could not load **${truncateEllipsis(title, 200)}** from the wiki.`,
          ephemeral: pickState.ephemeral,
        });
        return;
      }
      const imageUrl = await resolveWikiImageUrlFromWikitext(page.wikitext);
      const embed = buildWikiPreviewEmbed(
        page.title,
        page.wikitext,
        pickState.previewLimit,
        imageUrl,
      );
      const linkRow = linkButtonRow([
        { label: "Open full page", url: wikiArticleUrl(page.title) },
      ]);
      await interaction.editReply({
        embeds: [embed],
        components: linkRow ? [linkRow] : [],
      });
    } catch (err) {
      loggers.resonite.error("wiki pick menu failed", err, {});
      try {
        await interaction.followUp({
          content: "Something went wrong applying your choice.",
          ephemeral: true,
        });
      } catch {
        /* ignore */
      }
    }
  }

  @Slash({
    name: "account",
    description:
      "Search Resonite cloud users by name (autocomplete from public API).",
  })
  async account(
    @SlashOption({
      name: "username",
      description: "Partial username (autocomplete)",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: accountUsernameAutocomplete,
    })
    username: string,
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      const users = await searchUsersByName(username);
      if (users.length === 0) {
        await interaction.reply({
          content:
            "No users matched that name. Try a different spelling or a longer substring.",
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
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

      await interaction.reply({
        embeds: [embed],
        ...(row ? { components: [row] } : {}),
        flags: slashEphemeralReplyFlags(visible),
      });
    } catch (err) {
      loggers.resonite.error("account search failed", err, { username });
      if (err instanceof ResoniteApiError) {
        await interaction.reply({
          content: `Resonite user search failed (${err.status}). The API may be unavailable.`,
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
      }
      await interaction.reply({
        content: "Could not reach the Resonite API. Try again later.",
        flags: slashEphemeralReplyFlags(visible),
      });
    }
  }

  @Slash({
    name: "record",
    description:
      "Resolve record and session links: resrec, ressession, go.resonite, api /open/, Resonite:?world=",
  })
  async record(
    @SlashOption({
      name: "url",
      description:
        "Paste: resrec, ressession:///, go.resonite session URL, api /open/, or Resonite:?world=",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    url: string,
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    const parsed = parseRecordInput(url);
    if (!parsed.ok) {
      await interaction.reply({
        content: parsed.reason,
        flags: slashEphemeralReplyFlags(visible),
      });
      return;
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
        await interaction.reply({
          embeds: [embed],
          ...(row ? { components: [row] } : {}),
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
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
                url: buildRecordInventoryJsonApiUrl(
                  ownerId,
                  parsed.value.path,
                ),
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
      await interaction.reply({
        embeds: [embed],
        ...(row ? { components: [row] } : {}),
        flags: slashEphemeralReplyFlags(visible),
      });
    } catch (err) {
      loggers.resonite.error("record command failed", err, { url });
      if (err instanceof ResoniteApiError && err.status === 404) {
        await interaction.reply({
          content:
            "Nothing found for that link (404). The record may be private, deleted, or the link may be outdated.",
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
      }
      await interaction.reply({
        content:
          "Could not load that record from the Resonite API. Try again later or check the link.",
        flags: slashEphemeralReplyFlags(visible),
      });
    }
  }
}
