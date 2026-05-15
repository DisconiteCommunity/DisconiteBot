import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

const MAX_LABEL = 80;
const MAX_LINKS = 5;

/** Discord link buttons (max five per row). Skips invalid or non-http(s) URLs. */
export function linkButtonRow(
  links: readonly { label: string; url: string }[],
): ActionRowBuilder<ButtonBuilder> | null {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const { label, url } of links) {
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      continue;
    }
    if (row.components.length >= MAX_LINKS) {
      break;
    }
    const safeLabel =
      label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
    row.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(safeLabel)
        .setURL(url),
    );
  }
  return row.components.length > 0 ? row : null;
}
