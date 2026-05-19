import { ContainerBuilder, TextDisplayBuilder } from "@discordjs/builders";
import { Discord, Slash, SlashGroup, SlashOption } from "discordx";
import {
  CommandInteraction,
  MessageFlags,
} from "discord.js";
import {
  slashEphemeralMessageFlag,
  slashVisibleOption,
} from "../../utility/discord/interactionVisibility.js";
import { slashCommandUserInstallScope } from "../../config/discordSlashInstall.js";

/** Accent visible as Components v2 container sidebar (subdued slate). */
const QUEST_REPLY_ACCENT = 0x64748b;

@Discord()
@SlashGroup({
  name: "resonite",
  description:
    "Resonite wiki, cloud accounts, record/session links, and team socials.",
  ...slashCommandUserInstallScope,
})
@SlashGroup("resonite")
export class ResoniteQuestCommand {
  @Slash({
    name: "quest",
    description:
      "Whether Resonite runs on Meta Quest / Oculus Quest headsets.",
  })
  async quest(
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    const container = new ContainerBuilder()
      .setAccentColor(QUEST_REPLY_ACCENT)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "# Resonite on Quest?",
            "",
            "**Resonite does not support Meta Quest (or other standalone VR headsets).**",
            "",
            "There are plans to add Quest support in the future, however this is dependent on the progress of the replacement of the rendering engine ([From Unity to a different engine](https://github.com/Yellow-Dog-Man/Renderite.Candidates))",
          ].join("\n"),
        ),
      );

    await interaction.reply({
      components: [container],
      flags:
        MessageFlags.IsComponentsV2 | slashEphemeralMessageFlag(visible),
    });
  }
}
