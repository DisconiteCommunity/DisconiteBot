import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { getWeblateBaseUrl } from "../../config/disconite.js";
import { linkButtonRow } from "../../utility/discord/linkButtonRow.js";
import {
  slashEphemeralReplyFlags,
  slashVisibleOption,
} from "../../utility/discord/interactionVisibility.js";
import { slashCommandUserInstallScope } from "../../config/discordSlashInstall.js";

@Discord()
@SlashGroup({
  name: "disconite",
  description:
    "Disconite Weblate translations and forum search (disconite.net).",
  ...slashCommandUserInstallScope,
})
@SlashGroup("disconite")
export class DisconiteTranslateInfoCommand {
  @Slash({
    name: "translate",
    description:
      "Learn about the unofficial Disconite community translation platform.",
  })
  async translate(
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    const url = getWeblateBaseUrl();
    const embed = new EmbedBuilder()
      .setTitle("Community translation")
      .setDescription(
        [
          "If you'd like to translate, here's an **unofficial** translation platform that can be used to do so.",
          "",
          `Help localize Resonite-related strings on **[translate.disconite.net](${url})** (community-run Weblate).`,
          "",
          "To look up existing keys and strings in Discord, use **`/disconite search translation`**.",
        ].join("\n"),
      )
      .setURL(url);

    const row = linkButtonRow([
      { label: "Open translate.disconite.net", url },
    ]);

    await interaction.reply({
      embeds: [embed],
      ...(row ? { components: [row] } : {}),
      flags: slashEphemeralReplyFlags(visible),
    });
  }
}
