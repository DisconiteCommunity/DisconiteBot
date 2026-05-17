import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} from "@discordjs/builders";
import {
  ButtonStyle,
  DiscordAPIError,
  MessageFlags,
  type Message,
  type MessageCreateOptions,
  type MessageEditOptions,
  type SendableChannels,
} from "discord.js";
import { METRICS_SESSIONS_GOTO_BUTTON_ID } from "../../../utility/discord/discordInteractionIds.js";
import { truncateEllipsis } from "../../../utility/text/truncate.js";
import type { ResoniteSessionDto } from "./resoniteMetricsFetch.js";
import {
  pickTopSessionsForEmbeds,
  sessionMetricsDisplay,
} from "./resoniteMetricsFormat.js";
import {
  METRICS_MAIN_SESSION_COUNT,
  encodeMetricsSessionsPageId,
  metricsHasExtraSessions,
  metricsSessionsHasMorePages,
  metricsSessionsHasPreviousPage,
  metricsSessionsPageCount,
  metricsSessionsPageSlice,
} from "./resoniteMetricsSessionPages.js";

export function buildMetricsStatsContainer(
  markdown: string,
  options?: { showMoreSessionsButton?: boolean },
): ContainerBuilder {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(markdown),
  );

  if (options?.showMoreSessionsButton) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(encodeMetricsSessionsPageId(0))
          .setLabel("More sessions")
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  return container;
}

export function buildSessionMetricsContainer(
  session: ResoniteSessionDto,
  showThumbnail: boolean,
): ContainerBuilder {
  const display = sessionMetricsDisplay(session);
  const container = new ContainerBuilder().setAccentColor(display.accentColor);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(display.textContent),
  );

  if (showThumbnail && display.thumbnailUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(display.thumbnailUrl)
          .setDescription(truncateEllipsis(display.title, 100)),
      ),
    );
  }

  const sessionOrbUrl = display.sessionOrbUrl;
  if (sessionOrbUrl.startsWith("https://") || sessionOrbUrl.startsWith("http://")) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("Get session orb")
          .setURL(sessionOrbUrl),
      ),
    );
  }

  return container;
}

export function buildSessionMetricsContainers(
  sessions: ResoniteSessionDto[],
  showThumbnail: boolean,
): ContainerBuilder[] {
  return sessions.map((s) => buildSessionMetricsContainer(s, showThumbnail));
}

export function buildMetricsMessageComponents(
  markdown: string,
  sessions: ResoniteSessionDto[],
  showThumbnail: boolean,
): ContainerBuilder[] {
  const ranked = pickTopSessionsForEmbeds(sessions);
  const top = ranked.slice(0, METRICS_MAIN_SESSION_COUNT);

  return [
    buildMetricsStatsContainer(markdown, {
      showMoreSessionsButton: metricsHasExtraSessions(ranked),
    }),
    ...buildSessionMetricsContainers(top, showThumbnail),
  ];
}

export function buildMetricsSessionsPaginationContainer(
  pageIndex: number,
  ranked: ResoniteSessionDto[],
): ContainerBuilder {
  const totalPages = metricsSessionsPageCount(ranked);
  const pageNum = pageIndex + 1;
  const hasPrev = metricsSessionsHasPreviousPage(pageIndex);
  const hasNext = metricsSessionsHasMorePages(ranked, pageIndex);

  const pageLabel =
    `( ${pageNum} / ${totalPages} )`.length <= 80
      ? `( ${pageNum} / ${totalPages} )`
      : `${pageNum}/${totalPages}`;

  return new ContainerBuilder().addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(encodeMetricsSessionsPageId(pageIndex - 1))
        .setLabel("<")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasPrev),
      new ButtonBuilder()
        .setCustomId(METRICS_SESSIONS_GOTO_BUTTON_ID)
        .setLabel(pageLabel)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(encodeMetricsSessionsPageId(pageIndex + 1))
        .setLabel(">")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasNext),
    ),
  );
}

export function buildMetricsSessionsPageComponents(
  pageIndex: number,
  ranked: ResoniteSessionDto[],
  showThumbnail: boolean,
): ContainerBuilder[] {
  const slice = metricsSessionsPageSlice(ranked, pageIndex);
  const components = buildSessionMetricsContainers(slice, showThumbnail);

  if (metricsSessionsPageCount(ranked) > 0) {
    components.push(
      buildMetricsSessionsPaginationContainer(pageIndex, ranked),
    );
  }

  return components;
}

export function buildMetricsMessagePayload(
  components: ContainerBuilder[],
): MessageCreateOptions & MessageEditOptions {
  return {
    embeds: [],
    components,
    flags: MessageFlags.IsComponentsV2,
  };
}

/** Legacy metrics messages used `content` and/or embeds; they must be replaced, not edited in place. */
export function metricsMessageNeedsReplace(message: Message): boolean {
  if (!message.flags.has(MessageFlags.IsComponentsV2)) {
    return true;
  }
  if (message.content.length > 0) {
    return true;
  }
  if (message.embeds.length > 0) {
    return true;
  }
  return false;
}

export function isMetricsLegacyContentConflict(err: unknown): boolean {
  if (!(err instanceof DiscordAPIError) || err.code !== 50035) {
    return false;
  }
  const text = JSON.stringify(err.rawError ?? err.message);
  return text.includes("MESSAGE_CANNOT_USE_LEGACY_FIELDS_WITH_COMPONENTS_V2");
}

/**
 * Send or update the single metrics message. Replaces legacy (content/embed) messages
 * so Discord does not keep old `content` when IS_COMPONENTS_V2 is set.
 */
export async function publishMetricsMessage(
  channel: SendableChannels,
  messageId: string | null,
  components: ContainerBuilder[],
): Promise<string> {
  const payload = buildMetricsMessagePayload(components);

  if (!messageId) {
    const msg = await channel.send(payload);
    return msg.id;
  }

  const existing = await channel.messages.fetch(messageId);

  if (metricsMessageNeedsReplace(existing)) {
    await existing.delete().catch(() => undefined);
    const msg = await channel.send(payload);
    return msg.id;
  }

  try {
    await existing.edit(payload);
    return existing.id;
  } catch (err) {
    if (!isMetricsLegacyContentConflict(err)) {
      throw err;
    }
    await existing.delete().catch(() => undefined);
    const msg = await channel.send(payload);
    return msg.id;
  }
}
