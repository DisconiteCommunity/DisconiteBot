# AI agents: Disconite Bot

This document orients future coding agents to **disconite-bot**, a Discord application built on the stack described below.

## Purpose

**Disconite Bot** is a Discord bot: TypeScript, **discordx** (slash commands, decorators, Koa integration), **discord.js v14**, **Prisma 7** (MySQL via **MariaDB adapter**), **Zod**-validated configuration. Use it as the foundation for Disconite-specific features (commands, events, HTTP routes, persistence).

## How the app boots

1. **`reflect-metadata`** is loaded first (required for **discordx** / decorator metadata under `ts-node` and Node).
2. **`dotenv/config`** loads `.env` before anything else.
3. **`validateEnv()`** in `src/config/env.ts` parses `.env` with Zod. On failure, the process exits after logging via `loggers.startup`.
4. **`PrismaClient`** is constructed with **`PrismaMariaDb`** and `DATABASE_URL`.
5. **`discordx` `Client`** is created with intents from `src/config/discord.ts`.
6. **`importx`** (from `@discordx/importer`) loads all modules under:
   - `src/commands/**/*.ts`
   - `src/events/**/*.ts`
   - `src/api/**/*.ts`  
   This is the **registration** mechanism: decorated classes are discovered at runtime (no manual command registry array).
7. **`bot.login(BOT_TOKEN)`** connects to Discord.
8. **`Koa`** (plain `koa` + **`@koa/router`**) listens on **`PORT`**. Routes are registered in **`src/api/routes.ts`** (`createApiRouter()`), mounted from `main.ts`.

Slash commands are published in **`clientReady`** via **`bot.initApplicationCommands()`**.

**Interaction path:** `interactionCreate` → `bot.executeInteraction(interaction)` with ephemeral error fallback.

## Folder layout

| Path | Role |
|------|------|
| `src/main.ts` | Entry: env, Prisma, Discord client, importx, Koa listen, shutdown handlers |
| `src/config/` | `env.ts` (Zod), `discord.ts` (intents, client flags), `constants.ts` |
| `src/commands/` | Slash / prefix command classes (`@Discord()`, `@Slash()`, etc.), grouped by feature folder |
| `src/events/` | Discord event classes (`@On({ event: "..." })`) |
| `src/api/` | HTTP routes: **`createApiRouter()`** in `routes.ts` (Koa + `@koa/router`; not discordx) |
| `src/utility/` | Shared helpers: `logging/`, `errors/`, `text/`, `discord/` (+ colocated tests) |
| `prisma/` | Schema + migrations; client generated into `src/generated/prisma` (gitignored) |
| `scripts/copy-prisma.js` | Post-`tsc` copy of generated Prisma runtime into `build/generated/prisma` |
| `build/` | Compiled output (`tsc`); do not commit |

## Dependencies and runtime

- **Node:** `>=20` (see `package.json` `engines`).
- **Package manager:** **npm** (see `package.json` scripts); Yarn works if you prefer it.
- **Discord:** `discord.js` **v14**, **`discordx`** for decorators and command dispatch.
- **Database:** **Prisma 7** + **`@prisma/adapter-mariadb`** + **`mysql`** driver; (`mysql://...`).
- **HTTP:** `koa`, `@koa/router`, `@koa/bodyparser`, `@koa/multer`, `multer`.
- **Config:** `dotenv`, `zod`.
- **Tooling:** `typescript` **5.9** (runtime dep for panels), `tsx` for local dev, **`ts-node`** for eggs that run `.ts` with `ts-node --esm`, `vitest` for tests, `eslint` + `@typescript-eslint/*`.
- **ESM:** `"type": "module"`; TypeScript **`module` / `moduleResolution`: `NodeNext`**; **import paths use `.js` extensions** in source (matches emitted ESM).
- **Decorators:** `experimentalDecorators` + `emitDecoratorMetadata` in `tsconfig.json`; **`reflect-metadata`** imported at the top of `main.ts`.
- **Panels:** `npm install` runs **`postinstall` → `prisma generate`**. Use **`build/main.js`** after **`npm run build`**, or run **`src/main.ts`** via **`ts-node --esm`** (see README). **`prisma`** and **`typescript`** are in **`dependencies`** so `npm install --omit=dev` still works.
- **Strictness:** `strict`, `noUnusedLocals`, `noUnusedParameters`, etc.—follow this repo’s `tsconfig.json`.
- **Logging:** `logger` + `loggers.*` in `src/utility/logging/logger.ts` (structured levels + prefixed helpers for domains such as `bot`, `resonite`, `database`, …).
- **Errors:** `ConfigError`, `AppError`, … in `src/utility/errors/errors.ts` (shared taxonomy for HTTP, config, and Discord surfaces).
- **Discord client:** Central `export const bot` and `export const prisma` from `main.ts` when other modules need them.
- **Resilience:** `unhandledRejection`, bounded `uncaughtException` handling, **`SIGINT` / `SIGTERM`** → **`gracefulShutdown`** (prisma disconnect + bot destroy).

## How agents should extend this project

### Commands

1. Add a file under `src/commands/<feature>/<name>.ts`.
2. Export a class with **`@Discord()`** and **`@Slash({ name, description })`** (or `@SlashGroup`).
3. Method receives slash options first, then **`CommandInteraction`** (see [discordx slash execution](https://discordx.js.org/)); use **`AutocompleteInteraction`** for `@SlashOption({ autocomplete: fn })` handlers.
4. No manual registration: **`importx`** glob picks up new files after restart / rebuild.

Use **`MessageFlags.Ephemeral`** for staff-only or noisy replies when appropriate.

**Disconite helpers:**

| Command | Purpose |
|---------|---------|
| `/disconite` `translate` | Info embed + link to the unofficial community translation site ([translate.disconite.net](https://translate.disconite.net)). |
| `/disconite` `forum` | Info embed + links to [disconite.net](https://disconite.net) and the [welcome topic](https://disconite.net/t/welcome-to-the-disconite-forum/53/5). |
| `/disconite search` `translation` `key` [`languages`] [`query`] [`ephemeral`] | Search [translate.disconite.net](https://translate.disconite.net) (Weblate). **`key`** and **`languages`** use autocomplete. Optional **`languages`**: comma-separated codes (e.g. `en,nl`); empty = all langs. One matching key → embed; several → string select menu. |
| `/disconite search` `forum` `query` [`ephemeral`] | Search [disconite.net](https://disconite.net) via `GET /search.json`. **`query`** autocomplete suggests topics. One post → single embed; several → string select menu. Author lines are **forum accounts** (trust, roles, badges when available). |

Optional env (defaults in code): `WEBLATE_BASE_URL`, `WEBLATE_API_TOKEN`, `DISCONITE_FORUM_BASE_URL`. See `.env.example`.

Shared logic: `src/services/disconite/weblate/`, `src/services/disconite/discourse/`.

**Resonite helpers:**

| Command | Purpose |
|---------|---------|
| `/resonite search` `record` `url` | Parse `resrec://`, `https://api.resonite.com/open/world|session/…`, `Resonite:?world=…`, or pasted text containing those patterns; load metadata from **unauthenticated** `GET https://api.resonite.com/...` (records, sessions). Embed + link buttons (API JSON, open junction, thumbnail CDN when available). |
| `/resonite search` `wiki` `query` [`ephemeral`] [`preview_chars`] | Optional **`preview_chars`** integer **500–1500** (default **500**) caps preview length for v2 text, pick-list description, and post-select embed. Exact title → Components v2 preview. If not exact: opensearch up to **10** hits; **one** hit → auto-load when possible, else one-option select. **Two or more** → embed list + string select; footer stores titles + ephemeral + **preview_chars** for the handler. |
| `/resonite search` `account` `username` | `GET https://api.resonite.com/users?name=…` — public user list only (no login). Autocomplete suggests usernames from that API. |
| `/resonite` `socials` `user` `platform` | Team roster in `src/services/resonite/team/resoniteTeamSocials.ts`. **`user`** autocomplete lists roster members. **`platform`** autocomplete only shows platforms that user has (`wiki`, `discord`, `twitter`, …, or `all`). A specific platform loads a **profile preview** (avatar/banner, bio, stats) via **official platform APIs only** (`platformPreview.ts`, `team/previews/`). **`all`** lists links with **Open** + **View profile** buttons; **All platforms** returns from preview. Members with only a wiki page get `wiki` / `all`; add optional `discord: { userId, username }` on a roster entry for Discord-only links. |

Optional env for richer socials previews (see `.env.example`): `YOUTUBE_API_KEY` (YouTube Data API v3; without it, YouTube falls back to the official **oEmbed** endpoint only), `X_API_BEARER_TOKEN`, `TWITCH_CLIENT_ID`, `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`. GitHub, BlueSky, Mastodon/fediverse, wiki, and Discord use public or bot APIs with no extra keys. Platforms without API support (e.g. TikTok, generic websites) show links only.

Shared Resonite logic lives under `src/services/resonite/` in subfolders: `api/` (HTTP client), `wiki/`, `users/`, `records/` (sessions, record summaries, link parsing), `team/` (socials roster). The Resonite cloud API is read-only and public. The Resonite API is a WIP and may return 404 or limited fields without auth.

### Events

1. Add `src/events/discord/<event>.ts` (or subfolders).
2. Class with **`@Discord()`** and **`@On({ event: "guildMemberUpdate" })`** (etc.).
3. Keep handlers thin: call **`loggers`**, **`prisma`**, or small **service/manager** modules under `src/managers/` or `src/services/` when logic grows.

### HTTP / internal APIs

1. Add handlers on **`createApiRouter()`** in **`src/api/routes.ts`** (or split into `src/api/*.ts` and import into `routes.ts`).
2. Use **`router.get(path, middleware)`** (and other verbs) from **`@koa/router`**.
3. Public HTML: **`GET /terms`** and **`GET /privacy`**; **`GET /`** JSON includes `links` to both.

### Persistence

1. Edit **`prisma/schema.prisma`** (and optional `prisma/models/*.prisma` if you split models across files).
2. Run **`npx prisma migrate dev`** (or deploy migrations in CI).
3. Import **`PrismaClient`** types from `./generated/prisma/client.js` in application code (after `prisma generate`).

### Schedules / background jobs

This template does **not** include `node-cron` or schedule modules yet. Add dependency and folder layout when you need cron-style work, and initialize from `clientReady`.

## Environment configuration

Copy **`.env.example`** → **`.env`** and set:

| Variable | Required | Notes |
|----------|----------|--------|
| `BOT_TOKEN` | Yes | Discord bot token |
| `BOT_OWNER_ID` | Yes | Snowflake of bot owner (for future guards / owner checks) |
| `DATABASE_URL` | Yes | `mysql://user:password@host:3306/database` |
| `PORT` | No (default `3000`) | Koa listen port |
| `ENV` | No (`development`) | `development` \| `production` \| `test` |
| `LOG_LEVEL` | No (`INFO`) | `DEBUG` \| `INFO` \| `WARN` \| `ERROR` |
| `APPLICATION_ID` | No | Discord application id if tooling or future deploy scripts need it |
| `WEBLATE_BASE_URL` | No | Weblate instance (default `https://translate.disconite.net`) |
| `WEBLATE_PROJECT_SLUG` | No | Project slug for language autocomplete (default `resonite`) |
| `WEBLATE_API_TOKEN` | No | Weblate API token if the instance requires auth |
| `DISCONITE_FORUM_BASE_URL` | No | Discourse forum base URL (default `https://disconite.net`) |

**Zod** validates URLs and numeric `PORT`. Empty strings in `.env` may fail validation—omit optional vars or set real values.

**Windows note:** `package.json` **`start`** uses `ENV=development` Unix-style prefix. On Windows CMD, set `ENV` in the environment or run via **Git Bash / WSL**, or adjust the script locally (e.g. `cross-env`).

## Build, run, and test

From **`disconite-bot/`**:

```bash
npm install
# postinstall runs prisma generate; migrations still need DATABASE_URL
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run build
npm run start:prod
```

**Development (TypeScript directly):**

```bash
npm run dev
```

**Quality:**

```bash
npm run lint
npm run test
```

After **`prisma generate`**, `src/generated/` exists locally; **`npm run build`** runs **`tsc`** then **`scripts/copy-prisma.js`** so the compiled `build/` tree can load Prisma at runtime.

## Discord Developer Portal checklist

1. Create an application and bot user; copy **`BOT_TOKEN`**.
2. Enable **Privileged Gateway Intents** that match `src/config/discord.ts` (e.g. **Server Members Intent** if you use member data).
3. Invite the bot with **`applications.commands`** scope.
4. Run the bot once with a valid token so **`initApplicationCommands`** registers slash commands (global propagation can take up to an hour; use a test guild + `botGuilds` for faster iteration if needed).