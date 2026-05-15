> [!CAUTION]
> **Built with AI** - This Discord bot and its documentation were produced with assistance from AI coding tool. Treat the codebase as a **starting point** for people to start working on.

# Disconite Bot

Minimal Discord bot for the **Resonite community** stack: TypeScript, [discordx](https://discordx.js.org/), Discord.js v14, Prisma (MySQL/MariaDB), and a small Koa HTTP surface.

## Quick start

1. **Requirements:** Node.js 20+, a MySQL-compatible database, and a [Discord application](https://discord.com/developers/applications) with a bot token.
2. **Environment:** Copy `.env.example` to `.env` and fill in `BOT_TOKEN`, `BOT_OWNER_ID`, and `DATABASE_URL`.
3. **Database:** `npm install` runs **`prisma generate`** via `postinstall`. Apply schema with `npx prisma migrate deploy` (or `migrate dev` while iterating); requires **`DATABASE_URL`** in the environment when you run Prisma CLI commands.
4. **Run locally:** `npm install`, then `npm run dev` (tsx), **`npm run start:ts-node`** (same entry as many panels), or `npm run build` + **`npm run start:prod`** for compiled JS.

## Pterodactyl / Node panel (standard egg)

Typical startup uses `node` for a `.js` **`MAIN_FILE`** or `ts-node --esm` for TypeScript. This repo supports both.

1. **`npm install`** — installs dependencies; **`postinstall`** runs **`prisma generate`** (no separate generate step needed for the client).
2. **Migrations:** run **`npx prisma migrate deploy`** once (Install script or SSH), with **`DATABASE_URL`** set.
3. **Choose an entry:**
   - **Compiled (recommended):** add **`npm run build`** to your install or startup **before** launch. Set **`MAIN_FILE`** to **`build/main.js`**, and use **`node`** (not `ts-node`).
   - **TypeScript:** set **`MAIN_FILE`** to **`src/main.ts`** and keep the panel’s **`ts-node --esm`** branch.

**Bash note:** the pattern `[[ "${MAIN_FILE}" == "*.js" ]]` never matches a filename (it compares to the literal string `*.js`). Use a glob match instead, for example:

```bash
if [[ "$MAIN_FILE" == *.js ]]; then
  /usr/local/bin/node "/home/container/${MAIN_FILE}" ${NODE_ARGS}
else
  /usr/local/bin/ts-node --esm "/home/container/${MAIN_FILE}" ${NODE_ARGS}
fi
```

Equivalent **`package.json`** scripts: **`start:prod`** → `node build/main.js`, **`start:ts-node`** → `ts-node --esm src/main.ts`. A **`ts-node`** config block (`esm`, `experimentalSpecifierResolution`, `transpileOnly`) supports ESM + decorators.

On Windows, the `start` script uses a Unix-style `ENV=` prefix; use Git Bash/WSL, set `ENV` yourself, or see **AI-AGENTS.md** for details.

## Docs

- **[AI-AGENTS.md](./AI-AGENTS.md)** — Architecture, folders, env vars, and how to extend commands, events, and APIs.

## License

See [LICENSE](./LICENSE) for license details.
