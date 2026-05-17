# Discord setup

Checklist for a new bot deployment. Env vars: [Environment](ENVIRONMENT.md).

1. Create an application and bot user in the [Discord Developer Portal](https://discord.com/developers/applications); copy `BOT_TOKEN`.
2. Enable **Privileged Gateway Intents** that match `src/config/discord.ts` (e.g. **Server Members Intent** if member data is used).
3. Invite the bot with the `applications.commands` scope.
4. Run the bot once with a valid token so `initApplicationCommands` registers slash commands. Global propagation can take up to an hour; use a test guild + `botGuilds` for faster iteration if needed.

## Related docs

- [Environment](ENVIRONMENT.md)
- [Build & run](BUILD.md)
