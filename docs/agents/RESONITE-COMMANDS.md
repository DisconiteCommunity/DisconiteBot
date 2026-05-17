# Resonite commands

Slash commands under `/resonite`. Shared logic under `src/services/resonite/`:

| Subfolder | Role |
|-----------|------|
| `api/` | HTTP client for public Resonite API |
| `wiki/` | Wiki search and previews |
| `users/` | Public user lookup |
| `records/` | Sessions, record summaries, link parsing |
| `team/` | Socials roster and platform previews |
| `metrics/` | Sessions + stats for live Discord mirror posts |

The Resonite cloud API is read-only and public; it is a WIP and may return 404 or limited fields without auth.

## Slash commands

| Command | Purpose |
|---------|---------|
| `/resonite search` `record` `url` | Parse `resrec://`, `https://api.resonite.com/open/world\|session/…`, `Resonite:?world=…`, or pasted text with those patterns; load metadata via unauthenticated API. Embed + link buttons (API JSON, open junction, thumbnail CDN when available). |
| `/resonite search` `wiki` `query` [`ephemeral`] [`preview_chars`] | `preview_chars` **500–1500** (default **500**). Exact title → Components v2 preview. Otherwise opensearch up to **10** hits; one hit → auto-load or single-option select; two or more → list + string select. |
| `/resonite search` `account` `username` | Public user list (`GET …/users?name=…`). Autocomplete from API. |
| `/resonite` `quest` | Components v2 notice about Quest / standalone VR; cites [Renderite candidates](https://github.com/Yellow-Dog-Man/Renderite.Candidates); directs toward PC VR. |
| `/resonite metrics` `register` | **Administrator.** Subscribe channel: one live metrics message (global stats + top sessions), rewritten each poll. Stored in `guild_settings` (`GuildSettings.metrics*`). |
| `/resonite metrics` `status` | **Administrator.** Show registered channel + thumbnail setting. |
| `/resonite metrics` `unregister` | **Administrator.** Ephemeral confirm/cancel; removes subscription and best-effort deletes the metrics message. |
| `/resonite metrics` `preview` `enabled` | **Administrator.** Toggle large session thumbnails per guild. |
| `/resonite metrics` `info` | Short embed: upstream Resonite Discord Sessions (MIT) and public API endpoints used. |
| `/resonite` `socials` `user` `platform` | Team roster. `user` autocomplete lists members; `platform` shows only platforms that user has (`wiki`, `discord`, `twitter`, …, or `all`). Specific platform → profile preview via official APIs (`platformPreview`, `team/previews/`). `all` → link buttons; **All platforms** returns from preview. Wiki-only members support `wiki` / `all`; optional `discord: { userId, username }` on roster entries for Discord-only links. |

## Optional environment

For richer socials previews (see `.env.example`):

- `YOUTUBE_API_KEY` — YouTube Data API v3; without it, YouTube uses official oEmbed only
- `X_API_BEARER_TOKEN`
- `TWITCH_CLIENT_ID`
- `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`

GitHub, BlueSky, Mastodon/fediverse, wiki, and Discord use public or bot APIs without extra keys. Platforms without API support (e.g. TikTok, generic websites) show links only.

## Live metrics poller

Started from `clientReady` unless `ENV=test`. Optional: `RESONITE_METRICS_POLL_SECONDS`, `RESONITE_METRICS_MAX_RETRIES` — see [Environment](ENVIRONMENT.md). Fetches `sessions`, `stats/cloudStats`, `stats/onlineStats` on an interval.

## Related docs

- [Extending the project](EXTENDING.md)
- [Environment](ENVIRONMENT.md)
- [Architecture](ARCHITECTURE.md)
