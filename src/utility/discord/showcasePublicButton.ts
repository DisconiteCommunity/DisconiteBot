import {
  ActionRowBuilder,
  ButtonBuilder,
} from "@discordjs/builders";
import { ButtonStyle } from "discord.js";
import { DISCONITE_BOT_SHOWCASE_PUBLIC_PREFIX } from "./discordInteractionIds.js";
import {
  stashShowcasePublicJob,
  type ShowcasePublicJobV1,
} from "./showcasePublicStore.js";

export function buildShowcaseInChannelRow(
  job: ShowcasePublicJobV1,
): ActionRowBuilder<ButtonBuilder> {
  const token = stashShowcasePublicJob(job);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${DISCONITE_BOT_SHOWCASE_PUBLIC_PREFIX}${token}`)
      .setLabel("Showcase in channel")
      .setStyle(ButtonStyle.Primary),
  );
}
