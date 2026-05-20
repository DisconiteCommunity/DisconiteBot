import {
  ApplicationCommandOptionType,
  MessageFlags,
  type InteractionReplyOptions,
} from "discord.js";

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

/**
 * Prefer over deprecated `ephemeral: boolean` on `deferReply`, `followUp`, etc.
 * When `ephemeral` is false, returns `{}` (channel-visible follow-up).
 */
export function optionalEphemeralInteractionFlags(
  ephemeral: boolean,
): { flags: MessageFlags.Ephemeral } | Record<string, never> {
  return ephemeral ? { flags: MessageFlags.Ephemeral } : {};
}

/**
 * Channel-visible follow-up: converts flags to numeric bits (no deprecated `ephemeral` field),
 * drops {@link MessageFlags.Ephemeral}, and returns Discord.js–compatible interaction flags.
 */
export function interactionFollowUpFlagsWithoutEphemeral(
  flagBits: number | undefined,
): InteractionReplyOptions["flags"] | undefined {
  if (flagBits === undefined) {
    return undefined;
  }
  const cleared = flagBits & ~Number(MessageFlags.Ephemeral);
  return cleared === 0 ? undefined : (cleared as InteractionReplyOptions["flags"]);
}

/** OR with other `MessageFlags` (e.g. `IsComponentsV2`). */
export function slashEphemeralMessageFlag(
  visible: boolean | undefined,
): MessageFlags.Ephemeral | 0 {
  return isSlashReplyPublic(visible) ? 0 : MessageFlags.Ephemeral;
}
