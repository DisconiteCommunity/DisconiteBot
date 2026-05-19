import {
  ButtonComponent,
  Discord,
  Slash,
  SlashGroup,
  SlashOption,
} from "discordx";
import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  MessageFlags,
} from "discord.js";
import { loggers } from "../../utility/logging/logger.js";
import {
  buildSocialsListContainer,
  buildSocialsPreviewContainer,
  buildSocialsPreviewUnavailableContainer,
  socialsEditFlags,
  socialsReplyFlags,
} from "../../utility/discord/socialsComponentsV2.js";
import {
  slashEphemeralReplyFlags,
  slashVisibleOption,
} from "../../utility/discord/interactionVisibility.js";
import { slashCommandUserInstallScope } from "../../config/discordSlashInstall.js";
import { truncateEllipsis } from "../../utility/text/truncate.js";
import { fetchPlatformPreview } from "../../services/resonite/team/platformPreview.js";
import {
  SOCIALS_BACK_BUTTON_ID_PATTERN,
  SOCIALS_PREVIEW_BUTTON_ID_PATTERN,
} from "../../utility/discord/discordInteractionIds.js";
import {
  parseSocialBackButtonId,
  parseSocialPreviewButtonId,
} from "../../services/resonite/team/platformPreviewIds.js";
import {
  getAvailablePlatformsForMember,
  matchTeamMemberFromQuery,
  normalizePlatformInput,
  platformAutocompleteForUser,
  resolveMemberPlatformLinks,
  teamMemberAutocomplete,
  type TeamMember,
} from "../../services/resonite/team/resoniteTeamSocials.js";

async function socialsAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const query = typeof focused.value === "string" ? focused.value : "";

  try {
    if (focused.name === "user") {
      await interaction.respond(teamMemberAutocomplete(query));
      return;
    }

    if (focused.name === "platform") {
      const userVal = interaction.options.getString("user");
      await interaction.respond(platformAutocompleteForUser(userVal, query));
      return;
    }

    await interaction.respond([]);
  } catch {
    await interaction.respond([]);
  }
}

async function replyWithPlatformPreview(
  interaction: CommandInteraction | ButtonInteraction,
  member: TeamMember,
  platformId: string,
  url: string,
  platformLabel: string,
  showBack: boolean,
  visible: boolean | undefined,
): Promise<void> {
  const preview = await fetchPlatformPreview({
    platformId,
    url,
    member,
    discordClient: interaction.client,
  });

  const editing = interaction.deferred || interaction.replied;

  if (!preview) {
    const { links } = resolveMemberPlatformLinks(member, platformId);
    const link = links[0];
    const container =
      showBack && link
        ? buildSocialsPreviewUnavailableContainer(
            member,
            link,
            platformLabel,
          )
        : buildSocialsListContainer(
            member,
            links,
            platformLabel,
            platformId,
          );
    if (editing) {
      await interaction.editReply({
        components: [container],
        flags: socialsEditFlags(),
      });
    } else {
      await interaction.reply({
        components: [container],
        flags: socialsReplyFlags(visible),
      });
    }
    return;
  }

  const container = buildSocialsPreviewContainer(
    member,
    preview,
    platformId,
    { showBack },
  );
  if (editing) {
    await interaction.editReply({
      components: [container],
      flags: socialsEditFlags(),
    });
  } else {
    await interaction.reply({
      components: [container],
      flags: socialsReplyFlags(visible),
    });
  }
}

@Discord()
@SlashGroup({
  name: "resonite",
  description:
    "Resonite wiki, cloud accounts, record/session links, and team socials.",
  ...slashCommandUserInstallScope,
})
@SlashGroup("resonite")
export class ResoniteSocialsCommands {
  @Slash({
    name: "socials",
    description:
      "Show Resonite team social links (pick user, then platform).",
  })
  async socials(
    @SlashOption({
      name: "user",
      description: "Team member (autocomplete from roster)",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: socialsAutocomplete,
    })
    user: string,
    @SlashOption({
      name: "platform",
      description:
        "Platform to show (autocomplete lists only what this user has)",
      type: ApplicationCommandOptionType.String,
      required: true,
      autocomplete: socialsAutocomplete,
    })
    platform: string,
    @SlashOption(slashVisibleOption)
    visible: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    try {
      const member = matchTeamMemberFromQuery(user);
      if (!member) {
        await interaction.reply({
          content:
            "That user is not on the Resonite team roster. Pick a name from autocomplete.",
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
      }

      const available = getAvailablePlatformsForMember(member);
      const platformNorm = normalizePlatformInput(platform.trim());
      const allowed = available.some((p) => p.id === platformNorm);
      if (!allowed) {
        const list = available.map((p) => `\`${p.id}\``).join(", ");
        await interaction.reply({
          content: `**${member.displayName}** does not have **${platform}** in the roster. Available: ${list || "none"}.`,
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
      }

      const { links, platformLabel } = resolveMemberPlatformLinks(
        member,
        platform,
      );

      if (links.length === 0) {
        await interaction.reply({
          content: `**${member.displayName}** has no **${platformLabel}** link in the roster.`,
          flags: slashEphemeralReplyFlags(visible),
        });
        return;
      }

      const isAll = platformNorm === "all";

      if (!isAll) {
        const primary = links[0];
        if (!primary) {
          return;
        }
        await replyWithPlatformPreview(
          interaction,
          member,
          primary.platformId,
          primary.url,
          platformLabel,
          false,
          visible,
        );
        return;
      }

      const container = buildSocialsListContainer(
        member,
        links,
        platformLabel,
        platformNorm,
      );

      await interaction.reply({
        components: [container],
        flags: socialsReplyFlags(visible),
      });
    } catch (err) {
      loggers.resonite.error("resonite socials failed", err, { user, platform });
      await interaction.reply({
        content: truncateEllipsis(
          "Could not load social links. Try again in a moment.",
          300,
        ),
        flags: slashEphemeralReplyFlags(visible),
      });
    }
  }

  @ButtonComponent({ id: SOCIALS_PREVIEW_BUTTON_ID_PATTERN })
  async socialPreviewButton(interaction: ButtonInteraction): Promise<void> {
    const parsed = parseSocialPreviewButtonId(interaction.customId);
    if (!parsed) {
      return;
    }

    const member = matchTeamMemberFromQuery(parsed.memberId);
    if (!member) {
      await interaction.reply({
        content: "That team member is no longer on the roster.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { links, platformLabel } = resolveMemberPlatformLinks(
      member,
      parsed.platformId,
    );
    const link = links[0];
    if (!link) {
      await interaction.reply({
        content: `No **${platformLabel}** link for **${member.displayName}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await interaction.deferUpdate();
      await replyWithPlatformPreview(
        interaction,
        member,
        link.platformId,
        link.url,
        platformLabel,
        true,
        undefined,
      );
    } catch (err) {
      loggers.resonite.error("social preview button failed", err, parsed);
      await interaction.followUp({
        content: truncateEllipsis(
          "Could not load that profile preview. Try again in a moment.",
          300,
        ),
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  @ButtonComponent({ id: SOCIALS_BACK_BUTTON_ID_PATTERN })
  async socialBackButton(interaction: ButtonInteraction): Promise<void> {
    const memberId = parseSocialBackButtonId(interaction.customId);
    if (!memberId) {
      return;
    }

    const member = matchTeamMemberFromQuery(memberId);
    if (!member) {
      await interaction.reply({
        content: "That team member is no longer on the roster.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const { links, platformLabel } = resolveMemberPlatformLinks(
        member,
        "all",
      );
      await interaction.deferUpdate();
      await interaction.editReply({
        components: [
          buildSocialsListContainer(member, links, platformLabel, "all"),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      loggers.resonite.error("social back button failed", err, { memberId });
      await interaction.followUp({
        content: truncateEllipsis(
          "Could not restore the platform list. Try the command again.",
          300,
        ),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
