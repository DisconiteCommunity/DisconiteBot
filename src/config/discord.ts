/**
 * Discord-specific configuration constants
 */

import { IntentsBitField } from "discord.js";

export const BOT_INTENTS = [
  IntentsBitField.Flags.Guilds
] as const;

export const BOT_CONFIG = {
  silent: false,
} as const;
