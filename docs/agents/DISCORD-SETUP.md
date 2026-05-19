# Discord setup

Checklist for a new bot deployment. Env vars: [Environment](ENVIRONMENT.md).

1. Create an application and bot user in the [Discord Developer Portal](https://discord.com/developers/applications); copy `BOT_TOKEN`.
2. Enable **Privileged Gateway Intents** that match `src/config/discord.ts` (e.g. **Server Members Intent** if member data is used).
3. **Installation (guild + user):** In the app’s **Installation** page, enable **Guild Install** and **User Install** as needed. Slash commands in this repo declare both integration types and contexts (guild, bot DM, private channel) via `src/config/discordSlashInstall.ts` on each root `@SlashGroup`. Users who **install the app to their account** can run `/disconite` and `/resonite` from DMs with the bot or elsewhere the client allows; **metrics** subcommands still require a server and **Administrator** and will reply with “Use this in a server.” when invoked outside a guild.
4. Invite the bot with the `applications.commands` scope (guild installs). For user installs, users add the app from the profile / Apps directory per Discord’s current UX.
5. Run the bot once with a valid token so `initApplicationCommands` registers slash commands. Global propagation can take up to an hour; use a test guild + `botGuilds` for faster iteration if needed.

## Related docs

- [Environment](ENVIRONMENT.md)
- [Build & run](BUILD.md)
