import { Discord, Slash, SlashGroup } from "discordx";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import {
  getDisconiteForumBaseUrl,
  getDisconiteForumWelcomePostUrl,
} from "../../config/disconite.js";
import { linkButtonRow } from "../../utility/discord/linkButtonRow.js";

@Discord()
@SlashGroup({
  name: "disconite",
  description:
    "Disconite Weblate translations and forum search (disconite.net).",
})
@SlashGroup("disconite")
export class DisconiteForumInfoCommand {
  @Slash({
    name: "forum",
    description:
      "Learn about the Disconite community forum and how to get started.",
  })
  async forum(interaction: CommandInteraction): Promise<void> {
    const forumUrl = getDisconiteForumBaseUrl();
    const welcomeUrl = getDisconiteForumWelcomePostUrl();

    const embed = new EmbedBuilder()
      .setTitle("Disconite community forum")
      .setDescription(
        [
          "The **Disconite forum** is the community discussion site for Resonite players and contributors, hosted at **[disconite.net](https://disconite.net)**.",
          "",
          "Browse categories, ask questions, and read announcements from the community.",
          "",
          "New here? Start with the welcome topic:",
          `**[Welcome to the Disconite forum!](${welcomeUrl})**`,
          "",
          "To search forum posts from Discord, use **`/disconite search forum`**.",
        ].join("\n"),
      )
      .setURL(forumUrl);

    const row = linkButtonRow([
      { label: "Open disconite.net", url: forumUrl },
      { label: "Welcome post", url: welcomeUrl },
    ]);

    await interaction.reply({
      embeds: [embed],
      ...(row ? { components: [row] } : {}),
    });
  }
}
