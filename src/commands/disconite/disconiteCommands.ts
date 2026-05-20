import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "@discordjs/builders";
import {
  Discord,
  SelectMenuComponent,
  Slash,
  SlashGroup,
  SlashOption,
} from "discordx";
import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  CommandInteraction,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuInteraction,
} from "discord.js";
import { loggers } from "../../utility/logging/logger.js";
import { toDiscordStringAutocompleteChoices } from "../../utility/discord/discordAutocompleteChoices.js";
import { linkButtonRow } from "../../utility/discord/linkButtonRow.js";
import {
  buildTranslationContainer,
  buildTranslationLinkRow,
  translationReplyFlags,
} from "../../utility/discord/translationComponentsV2.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";
import { getDisconiteForumBaseUrl } from "../../config/disconite.js";
import { WeblateApiError } from "../../services/disconite/weblate/client.js";
import {
  parseLanguageFilter,
  weblateLanguagesAutocomplete,
} from "../../services/disconite/weblate/languages.js";
import {
  getWeblateKeyGroup,
  searchWeblateUnits,
  weblateKeyAutocomplete,
  type WeblateKeyGroup,
} from "../../services/disconite/weblate/searchUnits.js";
import { DiscourseApiError } from "../../services/disconite/discourse/client.js";
import {
  forumQueryAutocomplete,
  getForumPostHit,
  searchForumPosts,
  type ForumPostHit,
} from "../../services/disconite/discourse/searchPosts.js";
import {
  FORUM_POST_PICK_MENU_ID,
  FORUM_POST_PICK_STATE_PREFIX,
  WEBLATE_KEY_PICK_MENU_ID,
  WEBLATE_KEY_PICK_STATE_PREFIX,
} from "../../utility/discord/discordInteractionIds.js";
import {
  optionalEphemeralInteractionFlags,
  slashEphemeralReplyFlags,
  slashVisibleOption,
} from "../../utility/discord/interactionVisibility.js";
import { slashCommandUserInstallScope } from "../../config/discordSlashInstall.js";

type TranslatePickState = {
  contexts: string[];
  languages: string[] | null;
  ephemeral: boolean;
  rawQuery?: string;
};

type ForumPickState = {
  query: string;
  ephemeral: boolean;
};

function encodeTranslatePickFooter(state: TranslatePickState): string {
  const slim: TranslatePickState = {
    contexts: state.contexts.slice(0, 10).map((c) => c.slice(0, 120)),
    languages: state.languages,
    ephemeral: state.ephemeral,
  };
  let encodedState = Buffer.from(JSON.stringify(slim), "utf8").toString(
    "base64url",
  );
  let footerText = `${WEBLATE_KEY_PICK_STATE_PREFIX}${encodedState}`;
  if (footerText.length > 2048) {
    slim.contexts = slim.contexts.map((context) => context.slice(0, 40));
    encodedState = Buffer.from(JSON.stringify(slim), "utf8").toString(
      "base64url",
    );
    footerText = `${WEBLATE_KEY_PICK_STATE_PREFIX}${encodedState}`;
  }
  return footerText;
}

function decodeTranslatePickFooter(
  text: string | null | undefined,
): TranslatePickState | null {
  if (!text?.startsWith(WEBLATE_KEY_PICK_STATE_PREFIX)) {
    return null;
  }
  try {
    const json = Buffer.from(
      text.slice(WEBLATE_KEY_PICK_STATE_PREFIX.length),
      "base64url",
    ).toString("utf8");
    const parsed = JSON.parse(json) as TranslatePickState;
    if (!Array.isArray(parsed.contexts)) {
      return null;
    }
    return {
      contexts: parsed.contexts,
      languages: Array.isArray(parsed.languages) ? parsed.languages : null,
      ephemeral: Boolean(parsed.ephemeral),
      rawQuery:
        typeof parsed.rawQuery === "string" && parsed.rawQuery.length > 0
          ? parsed.rawQuery
          : undefined,
    };
  } catch {
    return null;
  }
}

function encodeForumPickFooter(state: ForumPickState): string {
  const slim = {
    query: state.query.slice(0, 200),
    ephemeral: state.ephemeral,
  };
  return `${FORUM_POST_PICK_STATE_PREFIX}${Buffer.from(JSON.stringify(slim), "utf8").toString("base64url")}`;
}

function decodeForumPickFooter(
  text: string | null | undefined,
): ForumPickState | null {
  if (!text?.startsWith(FORUM_POST_PICK_STATE_PREFIX)) {
    return null;
  }
  try {
    const json = Buffer.from(
      text.slice(FORUM_POST_PICK_STATE_PREFIX.length),
      "base64url",
    ).toString("utf8");
    const parsed = JSON.parse(json) as ForumPickState;
    if (typeof parsed.query !== "string") {
      return null;
    }
    return { query: parsed.query, ephemeral: Boolean(parsed.ephemeral) };
  } catch {
    return null;
  }
}

async function replyTranslationV2(
  interaction: CommandInteraction | StringSelectMenuInteraction,
  group: WeblateKeyGroup,
  languages: string[] | null,
  visible: boolean | undefined,
  edit = false,
): Promise<void> {
  const container = buildTranslationContainer(group, languages);
  container.addActionRowComponents(buildTranslationLinkRow(group, languages));

  if (edit && "editReply" in interaction) {
    await interaction.editReply({
      embeds: [],
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }
  await (interaction as CommandInteraction).reply({
    embeds: [],
    components: [container],
    flags: translationReplyFlags(visible),
  });
}

function buildTranslateKeyPickMessage(
  groups: WeblateKeyGroup[],
  languages: string[] | null,
  visible: boolean | undefined,
  rawQuery?: string,
): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<StringSelectMenuBuilder>;
} {
  const state: TranslatePickState = {
    contexts: groups.map((g) => g.context),
    languages,
    ephemeral: visible !== true,
    rawQuery: rawQuery?.trim() || undefined,
  };

  const embed = new EmbedBuilder()
    .setTitle("Choose a translation key")
    .setDescription(
      truncateEllipsis(
        groups
          .map((g, i) => {
            const langs = g.translations.map((t) => t.languageCode).join(", ");
            return `**${i + 1}.** \`${g.context}\` (${g.translations.length} langs: ${truncateEllipsis(langs, 80)})`;
          })
          .join("\n\n"),
        4000,
      ),
    )
    .setFooter({ text: encodeTranslatePickFooter(state) });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(WEBLATE_KEY_PICK_MENU_ID)
    .setPlaceholder("Select a key…")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      groups.map((g, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(truncateEllipsis(g.context, 100))
          .setValue(String(i))
          .setDescription(
            truncateEllipsis(
              `${g.translations.length} languages`,
              100,
            ),
          ),
      ),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    menu,
  );
  return { embed, row };
}

function buildForumPostEmbed(hit: ForumPostHit): EmbedBuilder {
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

function buildForumPostPickMessage(
  hits: ForumPostHit[],
  query: string,
  visible: boolean | undefined,
): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<StringSelectMenuBuilder>;
} {
  const state: ForumPickState = {
    query,
    ephemeral: visible !== true,
  };

  const embed = new EmbedBuilder()
    .setTitle("Choose a forum post")
    .setDescription(
      truncateEllipsis(
        hits
          .map((h, i) => `**${i + 1}.** ${h.topicTitle}\n${h.authorLine}`)
          .join("\n\n"),
        4000,
      ),
    )
    .setFooter({ text: encodeForumPickFooter(state) });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(FORUM_POST_PICK_MENU_ID)
    .setPlaceholder("Select a post…")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      hits.map((h, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(truncateEllipsis(h.topicTitle, 100))
          .setValue(String(i))
          .setDescription(truncateEllipsis(h.authorLine, 100)),
      ),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    menu,
  );
  return { embed, row };
}

async function translateKeyAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const query = typeof focused.value === "string" ? focused.value : "";
  try {
    const keys = await weblateKeyAutocomplete(query);
    await interaction.respond(toDiscordStringAutocompleteChoices(keys));
  } catch {
    await interaction.respond([]);
  }
}

async function translateLanguagesAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const query = typeof focused.value === "string" ? focused.value : "";
  try {
    const choices = await weblateLanguagesAutocomplete(query);
    await interaction.respond(choices);
  } catch {
    await interaction.respond([]);
  }
}

async function forumQueryAutocompleteHandler(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const query = typeof focused.value === "string" ? focused.value : "";
  try {
    const choices = await forumQueryAutocomplete(query);
    await interaction.respond(choices);
  } catch {
    await interaction.respond([]);
  }
}

@Discord()
@SlashGroup({
  name: "disconite",
  description:
    "Disconite Weblate translations and forum search (disconite.net).",
  ...slashCommandUserInstallScope,
})
@SlashGroup({
  name: "search",
  description: "Search Weblate translations and Disconite forum posts.",
  root: "disconite",
})
@SlashGroup("search", "disconite")
export class DisconiteCommands {
  @Slash({
    name: "translation",
    description:
      "Look up a translation key on translate.disconite.net (Weblate).",
  })
  async translation(
    @SlashOption({
      name: "key",
      description: "Translation context/key (autocomplete from Weblate)",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: translateKeyAutocomplete,
    })
    key: string,
    @SlashOption({
      name: "languages",
      description:
        "Language codes to show (comma-separated, e.g. en,nl,de). Empty = all.",
      type: ApplicationCommandOptionType.String,
      required: false,
      autocomplete: translateLanguagesAutocomplete,
    })
    languagesRaw: string | undefined,
    @SlashOption({
      name: "query",
      description:
        "Advanced: raw Weblate search query (replaces default context lookup)",
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    query: string | undefined,
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    const languages = parseLanguageFilter(languagesRaw);
    try {
      const groups = await searchWeblateUnits(key, query);
      if (groups.length === 0) {
        await interaction.reply({
          content:
            "No translation units matched. Pick a key from autocomplete or try another search.",
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
      }

      if (groups.length === 1) {
        await replyTranslationV2(interaction, groups[0], languages, visible);
        return;
      }

      const { embed, row } = buildTranslateKeyPickMessage(
        groups,
        languages,
        visible,
        query,
      );
      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: slashEphemeralReplyFlags(visible),
      });
    } catch (err) {
      loggers.disconite.error("translate failed", err, { key, query });
      await replyTranslateError(interaction, err, visible);
    }
  }

  @SelectMenuComponent({ id: WEBLATE_KEY_PICK_MENU_ID })
  async translateKeyPick(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();
      const state = decodeTranslatePickFooter(
        interaction.message.embeds[0]?.footer?.text,
      );
      const idx = parseInt(interaction.values[0] ?? "", 10);
      if (
        !state ||
        Number.isNaN(idx) ||
        idx < 0 ||
        idx >= state.contexts.length
      ) {
        await interaction.followUp({
          content:
            "That menu is out of date. Run `/disconite search translation` again.",
          ...optionalEphemeralInteractionFlags(true),
        });
        return;
      }

      const context = state.contexts[idx];
      if (context === undefined) {
        await interaction.followUp({
          content:
            "That menu is out of date. Run `/disconite search translation` again.",
          ...optionalEphemeralInteractionFlags(true),
        });
        return;
      }

      const group = await getWeblateKeyGroup(context, state.rawQuery);
      if (!group) {
        await interaction.followUp({
          content: `Could not load **${truncateEllipsis(context, 200)}** from Weblate.`,
          ...optionalEphemeralInteractionFlags(state.ephemeral),
        });
        return;
      }

      await replyTranslationV2(
        interaction,
        group,
        state.languages,
        state.ephemeral ? undefined : true,
        true,
      );
    } catch (err) {
      loggers.disconite.error("translate key pick failed", err, {});
      await interaction.followUp({
        content: "Something went wrong applying your choice.",
        ...optionalEphemeralInteractionFlags(true),
      });
    }
  }

  @Slash({
    name: "forum",
    description: "Search posts on disconite.net (Discourse forum).",
  })
  async forum(
    @SlashOption({
      name: "query",
      description: "Search terms or pick a topic (autocomplete)",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: forumQueryAutocompleteHandler,
    })
    query: string,
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      const hits = await searchForumPosts(query);
      if (hits.length === 0) {
        await interaction.reply({
          content: "No forum posts matched that query.",
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
      }

      if (hits.length === 1) {
        const embed = buildForumPostEmbed(hits[0]);
        const forumBase = getDisconiteForumBaseUrl();
        const linkRow = linkButtonRow([
          { label: "Open post", url: hits[0].postUrl },
          {
            label: "More results",
            url: `${forumBase}/search?q=${encodeURIComponent(query.trim())}`,
          },
        ]);
        await interaction.reply({
          embeds: [embed],
          ...(linkRow ? { components: [linkRow] } : {}),
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
      }

      const { embed, row } = buildForumPostPickMessage(
        hits,
        query,
        visible,
      );
      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: slashEphemeralReplyFlags(visible),
      });
    } catch (err) {
      loggers.disconite.error("forum search failed", err, { query });
      await replyForumError(interaction, err, visible);
    }
  }

  @SelectMenuComponent({ id: FORUM_POST_PICK_MENU_ID })
  async forumPostPick(
    interaction: StringSelectMenuInteraction,
  ): Promise<void> {
    try {
      await interaction.deferUpdate();
      const state = decodeForumPickFooter(
        interaction.message.embeds[0]?.footer?.text,
      );
      const idx = parseInt(interaction.values[0] ?? "", 10);
      if (!state || Number.isNaN(idx)) {
        await interaction.followUp({
          content:
            "That menu is out of date. Run `/disconite search forum` again.",
          ...optionalEphemeralInteractionFlags(true),
        });
        return;
      }

      const hit = await getForumPostHit(state.query, idx);
      if (!hit) {
        await interaction.followUp({
          content:
            "Could not load that post. Run `/disconite search forum` again.",
          ...optionalEphemeralInteractionFlags(state.ephemeral),
        });
        return;
      }

      const embed = buildForumPostEmbed(hit);
      const linkRow = linkButtonRow([{ label: "Open post", url: hit.postUrl }]);
      await interaction.editReply({
        embeds: [embed],
        components: linkRow ? [linkRow] : [],
      });
    } catch (err) {
      loggers.disconite.error("forum post pick failed", err, {});
      await interaction.followUp({
        content: "Something went wrong applying your choice.",
        ...optionalEphemeralInteractionFlags(true),
      });
    }
  }
}

async function replyTranslateError(
  interaction: CommandInteraction,
  err: unknown,
  visible: boolean | undefined,
): Promise<void> {
  if (err instanceof WeblateApiError) {
    const hint =
      err.status === 401 || err.status === 403
        ? " Set `WEBLATE_API_TOKEN` if the instance requires auth."
        : "";
    await interaction.reply({
      content: `Weblate lookup failed (${err.status}).${hint}`,
      flags: slashEphemeralReplyFlags(visible),
    });
    return;
  }
  await interaction.reply({
    content:
      "Could not reach translate.disconite.net. Try again in a moment.",
    flags: slashEphemeralReplyFlags(visible),
  });
}

async function replyForumError(
  interaction: CommandInteraction,
  err: unknown,
  visible: boolean | undefined,
): Promise<void> {
  if (err instanceof DiscourseApiError) {
    await interaction.reply({
      content: `Forum search failed (${err.status}).`,
      flags: slashEphemeralReplyFlags(visible),
    });
    return;
  }
  if (err instanceof Error && err.message) {
    await interaction.reply({
      content: `Forum search failed: ${truncateEllipsis(err.message, 300)}`,
      flags: slashEphemeralReplyFlags(visible),
    });
    return;
  }
  await interaction.reply({
    content: "Could not reach disconite.net. Try again in a moment.",
    flags: slashEphemeralReplyFlags(visible),
  });
}
