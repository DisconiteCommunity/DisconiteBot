# Environment

Copy `.env.example` → `.env`. **Zod** validates in `src/config/env.ts`; empty strings for optional vars may fail — omit them or set real values.

## Variables

| Variable | Required | Notes |
|----------|----------|--------|
| `BOT_TOKEN` | Yes | Discord bot token |
| `BOT_OWNER_ID` | Yes | Snowflake of bot owner (future guards / owner checks) |
| `DATABASE_URL` | Yes | `mysql://user:password@host:3306/database` |
| `PORT` | No (default `3000`) | Koa listen port |
| `ENV` | No (`development`) | `development` \| `production` \| `test` |
| `LOG_LEVEL` | No (`INFO`) | `DEBUG` \| `INFO` \| `WARN` \| `ERROR` |
| `APPLICATION_ID` | No | Discord application id for tooling or deploy scripts |
| `WEBLATE_BASE_URL` | No | Weblate instance (default `https://translate.disconite.net`) |
| `WEBLATE_PROJECT_SLUG` | No | Project slug for language autocomplete (default `resonite`) |
| `WEBLATE_API_TOKEN` | No | Weblate API token if the instance requires auth |
| `DISCONITE_FORUM_BASE_URL` | No | Discourse forum base URL (default `https://disconite.net`) |
| `RESONITE_METRICS_POLL_SECONDS` | No | Poll interval in seconds (default **60**; clamped **15–3600** at runtime) |
| `RESONITE_METRICS_MAX_RETRIES` | No | Soft failures before auto-removing a guild subscription (default **300**) |

Optional keys for richer `/resonite socials` previews are documented in [Resonite commands](RESONITE-COMMANDS.md) and `.env.example`.

## Windows

`package.json` `start` uses a Unix-style `ENV=development` prefix. On Windows CMD, set `ENV` in the environment, use Git Bash / WSL, or adjust locally (e.g. `cross-env`).

## Related docs

- [Build & run](BUILD.md)
- [Discord setup](DISCORD-SETUP.md)
