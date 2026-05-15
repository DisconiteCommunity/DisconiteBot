import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "@discordjs/builders";
import {
  ButtonStyle,
  MessageFlags,
  SeparatorSpacingSize,
  type InteractionReplyOptions,
} from "discord.js";
import type { PlatformPreview } from "../../services/resonite/team/platformPreview.js";
import {
  encodeSocialBackButtonId,
  encodeSocialPreviewButtonId,
} from "../../services/resonite/team/platformPreviewIds.js";
import type { DisplayLink } from "../../services/resonite/team/resoniteTeamSocials.js";
import type { TeamMember } from "../../services/resonite/team/resoniteTeamSocials.js";
import { truncateEllipsis } from "../text/truncate.js";
import { getPlatformAccentColor } from "./socialPlatformColors.js";

const MAX_LINK_ROWS = 30;
const MAX_BUTTON_LABEL = 80;
const MAX_GALLERY_IMAGES = 4;

export function socialsReplyFlags(
  ephemeral?: boolean,
): InteractionReplyOptions["flags"] {
  let n = MessageFlags.IsComponentsV2;
  if (ephemeral === true) {
    n |= MessageFlags.Ephemeral;
  }
  return n as InteractionReplyOptions["flags"];
}

/** Ephemeral is only valid on the initial reply, not on edit. */
export function socialsEditFlags(): MessageFlags.IsComponentsV2 {
  return MessageFlags.IsComponentsV2;
}

function buttonLabel(prefix: string, label: string): string {
  const open = `${prefix} ${label}`;
  if (open.length <= MAX_BUTTON_LABEL) {
    return open;
  }
  return truncateEllipsis(open, MAX_BUTTON_LABEL);
}

function memberHeaderLines(
  member: TeamMember,
  platformLabel: string,
): string {
  return [
    `# ${member.displayName}`,
    platformLabel,
    `**Team:** ${member.section} · **Role:** ${member.role}`,
  ].join("\n");
}

function previewBodyText(preview: PlatformPreview): string {
  const lines: string[] = [];
  if (preview.subtitle) {
    lines.push(preview.subtitle);
  }
  if (preview.description) {
    lines.push("", preview.description);
  }
  if (preview.stats.length > 0) {
    lines.push("", ...preview.stats);
  }
  return lines.join("\n").trim();
}

function addPreviewGallery(
  container: ContainerBuilder,
  preview: PlatformPreview,
): void {
  const items = preview.images.slice(0, MAX_GALLERY_IMAGES);
  if (items.length === 0) {
    return;
  }
  const gallery = new MediaGalleryBuilder();
  for (const img of items) {
    gallery.addItems(
      new MediaGalleryItemBuilder()
        .setURL(img.url)
        .setDescription(
          truncateEllipsis(img.description ?? preview.title, 100),
        ),
    );
  }
  container.addMediaGalleryComponents(gallery);
}

function viewProfileButton(
  memberId: string,
  platformId: string,
): ButtonBuilder {
  return new ButtonBuilder()
    .setStyle(ButtonStyle.Primary)
    .setLabel("View profile")
    .setCustomId(encodeSocialPreviewButtonId(memberId, platformId));
}

function allProfilesButton(memberId: string): ButtonBuilder {
  return new ButtonBuilder()
    .setStyle(ButtonStyle.Secondary)
    .setLabel("All profiles")
    .setCustomId(encodeSocialBackButtonId(memberId));
}

function openAndViewRow(
  link: DisplayLink,
  memberId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(buttonLabel("Open", link.label))
      .setURL(link.url),
    viewProfileButton(memberId, link.platformId),
  );
}

function withPlatformAccent(
  container: ContainerBuilder,
  platformId: string,
): ContainerBuilder {
  return container.setAccentColor(getPlatformAccentColor(platformId));
}

export function buildSocialsPreviewContainer(
  member: TeamMember,
  preview: PlatformPreview,
  platformId: string,
  opts?: { showBack?: boolean },
): ContainerBuilder {
  const container = withPlatformAccent(new ContainerBuilder(), platformId);

  const header = [
    memberHeaderLines(member, preview.platformLabel),
    "",
    `## ${preview.title}`,
  ].join("\n");

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(truncateEllipsis(header, 4000)),
  );

  addPreviewGallery(container, preview);

  const body = previewBodyText(preview);
  if (body) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(truncateEllipsis(body, 4000)),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
  );

  const buttons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(buttonLabel("Open", preview.platformLabel))
      .setURL(preview.url),
  ];
  if (opts?.showBack === true) {
    buttons.push(allProfilesButton(member.id));
  }
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons),
  );

  return container;
}

/** Shown when a profile API preview fails but the user came from the all-profiles list. */
export function buildSocialsPreviewUnavailableContainer(
  member: TeamMember,
  link: DisplayLink,
  platformLabel: string,
): ContainerBuilder {
  const container = withPlatformAccent(new ContainerBuilder(), link.platformId);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      truncateEllipsis(
        [
          memberHeaderLines(member, platformLabel),
          "",
          `_Could not load a profile preview for **${link.label}**._`,
        ].join("\n"),
        4000,
      ),
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
  );
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(buttonLabel("Open", link.label))
        .setURL(link.url),
      allProfilesButton(member.id),
    ),
  );

  return container;
}

export function buildSocialsListContainer(
  member: TeamMember,
  links: readonly DisplayLink[],
  platformLabel: string,
  platformId: string,
): ContainerBuilder {
  const container = withPlatformAccent(new ContainerBuilder(), platformId);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      truncateEllipsis(memberHeaderLines(member, platformLabel), 4000),
    ),
  );

  const shown = links.slice(0, MAX_LINK_ROWS);
  const overflow = links.slice(MAX_LINK_ROWS);

  for (const link of shown) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${link.label}**`),
    );
    container.addActionRowComponents(openAndViewRow(link, member.id));
  }

  if (overflow.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        truncateEllipsis(
          [
            `_Showing ${shown.length} of ${links.length} links (message limit)._`,
            ...overflow.map((l) => `• **${l.label}:** ${l.url}`),
          ].join("\n"),
          4000,
        ),
      ),
    );
  }

  return container;
}

/** @deprecated Use buildSocialsListContainer or buildSocialsPreviewContainer */
export function buildSocialsContainer(
  member: TeamMember,
  links: readonly DisplayLink[],
  platformLabel: string,
  platformId: string,
): ContainerBuilder {
  return buildSocialsListContainer(member, links, platformLabel, platformId);
}
