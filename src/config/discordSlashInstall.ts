import {
  ApplicationIntegrationType,
  InteractionContextType,
} from "discord.js";

/**
 * Slash command install / usage scope for Discord **guild install** and **user install**
 * (use the bot in servers or from “Apps” / DM with the bot).
 *
 * Add these fields to each **root** `@SlashGroup({ name, description, … })` object
 * (not nested `root: "…"` groups — discordx only accepts them on the root group).
 *
 * You must also enable **User Install** (and contexts you want) for the application
 * in the Discord Developer Portal → **Installation** — see `docs/agents/DISCORD-SETUP.md`.
 */
export const slashCommandUserInstallScope = {
  integrationTypes: [
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  ],
  contexts: [
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
  ],
  /** Legacy field; kept for clients that still honor it alongside `contexts`. */
  dmPermission: true,
};
