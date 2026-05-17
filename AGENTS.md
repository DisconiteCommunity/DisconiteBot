# Disconite Bot

Discord bot for the Resonite / Disconite community: TypeScript, [discordx](https://discordx.js.org/), Discord.js v14, Prisma (MySQL/MariaDB), and a small Koa HTTP surface.

## Tooling

- **Package manager:** npm (Node `>=20`; see `package.json` `engines`).
- **ESM:** import paths in source use `.js` extensions (`NodeNext`); see `tsconfig.json` for compiler strictness.

## Commands

```bash
npm install          # postinstall runs prisma generate
npm run dev          # tsx, local development
npm run build        # tsc + scripts/copy-prisma.js
npm run start:prod   # node build/main.js
npm run lint
npm run test
```

Migrations need `DATABASE_URL`: `npx prisma migrate deploy` (or `migrate dev` while iterating). See [docs/agents/BUILD.md](docs/agents/BUILD.md) for install and panel notes.

## More detail

- [Architecture](docs/agents/ARCHITECTURE.md) — boot flow, codebase shape, runtime patterns
- [Extending the project](docs/agents/EXTENDING.md) — commands, events, HTTP, persistence, background jobs
- [Environment](docs/agents/ENVIRONMENT.md) — `.env` variables and validation
- [Build & run](docs/agents/BUILD.md) — install, migrate, compiled vs TypeScript entry
- [Disconite commands](docs/agents/DISCONITE-COMMANDS.md) — `/disconite` slash commands
- [Resonite commands](docs/agents/RESONITE-COMMANDS.md) — `/resonite` slash commands and services
- [Discord setup](docs/agents/DISCORD-SETUP.md) — Developer Portal checklist
