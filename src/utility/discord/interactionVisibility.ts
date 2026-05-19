import { ApplicationCommandOptionType, MessageFlags } from "discord.js";

/**
 * Optional slash parameter: when `true`, the bot posts a normal channel-visible
 * reply; when omitted or `false`, the reply is ephemeral (only the invoker).
 */
export const slashVisibleOption = {
  name: "visible",
  description:
    "If true, everyone in the channel can see the response. Omit for a private reply (only you).",
  type: ApplicationCommandOptionType.Boolean,
  required: false,
} as const;

export function isSlashReplyPublic(visible: boolean | undefined): boolean {
  return visible === true;
}

/** Use on `interaction.reply` / `followUp` when not composing other flags. */
export function slashEphemeralReplyFlags(
  visible: boolean | undefined,
): MessageFlags.Ephemeral | undefined {
  return isSlashReplyPublic(visible) ? undefined : MessageFlags.Ephemeral;
}

/** For `deferReply` — only `Ephemeral` is valid here alongside loading state. */
export function slashDeferEphemeralFlags(
  visible: boolean | undefined,
): { flags: MessageFlags.Ephemeral } | Record<string, never> {
  return isSlashReplyPublic(visible) ? {} : { flags: MessageFlags.Ephemeral };
}

/** OR with other `MessageFlags` (e.g. `IsComponentsV2`). */
export function slashEphemeralMessageFlag(
  visible: boolean | undefined,
): MessageFlags.Ephemeral | 0 {
  return isSlashReplyPublic(visible) ? 0 : MessageFlags.Ephemeral;
}
