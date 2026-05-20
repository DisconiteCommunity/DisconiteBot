# Architecture

Entry point is `src/main.ts`. Dependencies and versions are in `package.json`.

## Boot sequence

1. **`reflect-metadata`** loads first (required for discordx decorator metadata).
2. **Environment** — `dotenv` then Zod validation; invalid config exits after startup logging.
3. **Prisma** — client with MariaDB adapter and `DATABASE_URL`.
4. **Discord client** — discordx `Client` with intents from config.
5. **Module discovery** — `importx` loads decorated classes under `commands/`, `events/`, and `api/` (no manual command registry).
6. **Discord login** — `bot.login(BOT_TOKEN)`.
7. **HTTP** — Koa listens on `PORT`; routes from `createApiRouter()` in the api layer.

On **`clientReady`**, slash commands publish via `bot.initApplicationCommands()`. Root command groups spread `slashCommandUserInstallScope` (`src/config/discordSlashInstall.ts`) so commands register for **guild** and **user** installs (guild, bot DM, and private-channel contexts). The Resonite metrics poller starts here unless `ENV=test`.

**Interactions:** `interactionCreate` → `bot.executeInteraction(interaction)` with ephemeral error fallback.

## Codebase shape

| Area | Role |
|------|------|
| `src/main.ts` | Entry: env, Prisma, Discord, importx, Koa, shutdown |
| `src/config/` | Zod env, Discord intents/flags, constants |
| `src/commands/` | Slash commands: `src/commands/<mainCommand>/<subgroup>/*.ts` (`root/` = subcommands directly under `/resonite` or `/disconite`; named folders match `@SlashGroup`, e.g. `search/`, `metrics/`, `projects/`) |
| `src/events/` | Discord handlers under `discord/` |
| `src/api/` | Koa HTTP (`createApiRouter()`; not discordx) |
| `src/services/` | Feature logic (Disconite, Resonite, guild settings, …) |
| `src/utility/` | Logging, errors, text, Discord helpers (+ tests) |
| `prisma/` | Schema and migrations; generated client under `src/generated/prisma` |
| `build/` | Compiled output (`tsc`); do not commit |

Post-build, `scripts/copy-prisma.js` copies the generated Prisma runtime into `build/generated/prisma`.

## Runtime patterns

- **Logging:** `logger` and `loggers.*` in `src/utility/logging/` (domain prefixes such as `bot`, `resonite`, `database`).
- **Errors:** shared taxonomy (`ConfigError`, `AppError`, …) in `src/utility/errors/`.
- **Shared instances:** `bot` and `prisma` exported from `main.ts` where modules need them.
- **Shutdown:** `SIGINT` / `SIGTERM` → graceful disconnect (Prisma + Discord destroy); bounded handling for unhandled rejections and uncaught exceptions.

## Related docs

- [Extending the project](EXTENDING.md)
- [Environment](ENVIRONMENT.md)
- [Build & run](BUILD.md)
