import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "@discordjs/builders";
import {
  ButtonStyle,
  MessageFlags,
  SeparatorSpacingSize,
  type InteractionReplyOptions,
} from "discord.js";
import { filterTranslationsByLanguages } from "../../services/disconite/weblate/languages.js";
import {
  buildWeblateBrowseUrl,
  type WeblateKeyGroup,
  type WeblateTranslationRow,
} from "../../services/disconite/weblate/searchUnits.js";
import { truncateEllipsis } from "../text/truncate.js";

const MAX_LANGUAGE_BLOCKS = 12;
const TARGET_PREVIEW_LEN = 900;

export function formatWeblateTranslationLangBlock(
  row: WeblateTranslationRow,
  maxTargetLen = TARGET_PREVIEW_LEN,
): string {
  const flags: string[] = [];
  if (row.fuzzy) {
    flags.push("fuzzy");
  }
  if (!row.translated) {
    flags.push("untranslated");
  }
  const flagSuffix = flags.length > 0 ? ` _(${flags.join(", ")})_` : "";
  const target = truncateEllipsis(row.targetText, maxTargetLen);
  return `### ${row.languageCode}${flagSuffix}\n${target}`;
}

export function translationReplyFlags(
  ephemeral: boolean | undefined,
  forEdit = false,
): InteractionReplyOptions["flags"] {
  let n = MessageFlags.IsComponentsV2;
  if (!forEdit && ephemeral === true) {
    n |= MessageFlags.Ephemeral;
  }
  return n as InteractionReplyOptions["flags"];
}

export function buildTranslationContainer(
  group: WeblateKeyGroup,
  languages: string[] | null,
): ContainerBuilder {
  const filtered = filterTranslationsByLanguages(
    group.translations,
    languages,
  );
  const rows = filtered.length > 0 ? filtered : group.translations;
  const shown = rows.slice(0, MAX_LANGUAGE_BLOCKS);

  const headerLines = [
    `# ${group.context}`,
    "",
    "**Source (reference)**",
    truncateEllipsis(group.sourceText, 600),
    "",
    languages?.length
      ? `_Languages: ${languages.join(", ")}_`
      : "_All languages returned by search_",
  ];
  if (group.totalMatches > shown.length) {
    headerLines.push(`_Showing ${shown.length} of ${rows.length} language(s)._`);
  }

  const container = new ContainerBuilder();
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      truncateEllipsis(headerLines.join("\n"), 4000),
    ),
  );

  for (let i = 0; i < shown.length; i++) {
    const row = shown[i];
    if (!row) {
      continue;
    }
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        formatWeblateTranslationLangBlock(row),
      ),
    );
  }

  if (rows.length > MAX_LANGUAGE_BLOCKS) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `_+${rows.length - MAX_LANGUAGE_BLOCKS} more languages on Weblate_`,
      ),
    );
  }

  return container;
}

export function buildTranslationLinkRow(
  group: WeblateKeyGroup,
  languages: string[] | null,
): ActionRowBuilder<ButtonBuilder> {
  const filtered = filterTranslationsByLanguages(
    group.translations,
    languages,
  );
  const first = (filtered.length > 0 ? filtered : group.translations)[0];
  const browseUrl = buildWeblateBrowseUrl(group.weblateSearchUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Open on Weblate")
      .setURL(browseUrl),
  );

  if (first?.webUrl) {
    row.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel("Edit translation")
        .setURL(first.webUrl),
    );
  }

  return row;
}
