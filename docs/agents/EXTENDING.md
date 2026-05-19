# Extending the project

Patterns for adding features. See [discordx](https://discordx.js.org/) for decorator APIs.

## Commands

1. Add a file under `src/commands/<feature>/`.
2. Export a class with `@Discord()` and `@Slash({ name, description })` (or `@SlashGroup`).
3. Handler method: slash options first, then `CommandInteraction`; use `AutocompleteInteraction` for `@SlashOption({ autocomplete: fn })`.
4. Replies are **ephemeral by default** (only the invoker), except **`/resonite metrics` …** slash replies, which stay **channel-visible**. Add `@SlashOption(slashVisibleOption)` from `src/utility/discord/interactionVisibility.js` and pass `visible` into `slashEphemeralReplyFlags(visible)`, `slashDeferEphemeralFlags(visible)`, or compose with `slashEphemeralMessageFlag(visible)` so **`visible: true`** posts in-channel for other commands. Root `@SlashGroup` objects should include `...slashCommandUserInstallScope` from `src/config/discordSlashInstall.js` so commands stay available for **guild install** and **user install** (DM / private channel contexts).
5. Restart or rebuild — `importx` discovers new files automatically.

Use `MessageFlags.Ephemeral` for component error toasts or staff-only messages that should stay private regardless of the slash `visible` option.

Feature-specific slash command reference:

- [Disconite commands](DISCONITE-COMMANDS.md)
- [Resonite commands](RESONITE-COMMANDS.md)

## Events

1. Add under `src/events/discord/` (subfolders OK).
2. Class with `@Discord()` and `@On({ event: "…" })`.
3. Keep handlers thin — delegate to `loggers`, `prisma`, or modules under `src/services/` when logic grows.

## HTTP

1. Add routes on `createApiRouter()` in the api layer (split into `src/api/*.ts` and import into `routes.ts` if needed).
2. Use `@koa/router` verbs (`router.get`, etc.).
3. Existing public routes: `GET /terms`, `GET /privacy`; `GET /` JSON includes links to both.

## Persistence

1. Edit `prisma/schema.prisma` (optional split across `prisma/models/*.prisma`).
2. Run `npx prisma migrate dev` locally or deploy migrations in CI.
3. Per-guild preferences use `guild_settings` (`GuildSettings`): metrics columns and optional `extras` JSON.
4. Import Prisma types from `./generated/prisma/client.js` after `prisma generate`.

## Background jobs

**Live Resonite metrics:** interval poller started from `clientReady` — no extra scheduler dependency. Uses public Resonite API fetches. Details in [Resonite commands](RESONITE-COMMANDS.md). For other cron-style work, add a scheduler dependency only if needed.

## Related docs

- [Architecture](ARCHITECTURE.md)
- [Environment](ENVIRONMENT.md)
- [Build & run](BUILD.md)
