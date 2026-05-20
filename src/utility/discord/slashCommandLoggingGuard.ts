import { performance } from "node:perf_hooks";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  type CommandInteractionOption,
} from "discord.js";
import type { Client, GuardFunction } from "discordx";
import { loggers } from "../logging/logger.js";

const SENSITIVE_OPTION_NAME = /(?:^|[_-])(?:token|secret|password|api[_-]?key|auth)(?:$|[_-])/i;
const MAX_OPTION_STRING_LENGTH = 200;

export function getSlashCommandPath(
  interaction: ChatInputCommandInteraction,
): string {
  const parts = [interaction.commandName];
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(false);
  if (group) {
    parts.push(group);
  }
  if (sub) {
    parts.push(sub);
  }
  return parts.join(" ");
}

function redactOptionValue(option: CommandInteractionOption): unknown {
  if (SENSITIVE_OPTION_NAME.test(option.name)) {
    return "[redacted]";
  }

  switch (option.type) {
    case ApplicationCommandOptionType.Subcommand:
    case ApplicationCommandOptionType.SubcommandGroup:
      return Object.fromEntries(
        (option.options ?? []).map((nested) => [
          nested.name,
          redactOptionValue(nested),
        ]),
      );
    case ApplicationCommandOptionType.String:
      return truncateOptionString(String(option.value));
    case ApplicationCommandOptionType.Attachment:
      return option.attachment ? { id: option.attachment.id } : undefined;
    default:
      return "value" in option ? option.value : undefined;
  }
}

function truncateOptionString(value: string): string {
  if (value.length <= MAX_OPTION_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_OPTION_STRING_LENGTH)}…`;
}

export function serializeSlashCommandOptions(
  interaction: ChatInputCommandInteraction,
): Record<string, unknown> | undefined {
  const topLevel = interaction.options.data;
  if (topLevel.length === 0) {
    return undefined;
  }

  const options: Record<string, unknown> = {};
  for (const option of topLevel) {
    options[option.name] = redactOptionValue(option);
  }
  return options;
}

export function slashCommandLogContext(
  interaction: ChatInputCommandInteraction,
): Record<string, unknown> {
  const context: Record<string, unknown> = {
    command: getSlashCommandPath(interaction),
    userId: interaction.user.id,
    interactionId: interaction.id,
  };

  if (interaction.guildId) {
    context.guildId = interaction.guildId;
  }
  if (interaction.channelId) {
    context.channelId = interaction.channelId;
  }

  const options = serializeSlashCommandOptions(interaction);
  if (options) {
    context.options = options;
  }

  return context;
}

export const slashCommandLoggingGuard: GuardFunction = async (
  interaction: unknown,
  _client: Client,
  next: () => Promise<unknown>,
) => {
  if (
    typeof interaction !== "object" ||
    interaction === null ||
    !("isChatInputCommand" in interaction) ||
    typeof (interaction as ChatInputCommandInteraction).isChatInputCommand !==
      "function" ||
    !(interaction as ChatInputCommandInteraction).isChatInputCommand()
  ) {
    return await next();
  }

  const slash = interaction as ChatInputCommandInteraction;
  const context = slashCommandLogContext(slash);
  const startedAt = performance.now();

  loggers.commands.info("Slash command started", context);

  try {
    const result = await next();
    loggers.commands.info("Slash command completed", {
      ...context,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return result;
  } catch (error) {
    loggers.commands.error("Slash command failed", error, {
      ...context,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw error;
  }
};
