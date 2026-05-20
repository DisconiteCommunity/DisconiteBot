# Resonite commands

Slash commands under `/resonite`. Shared logic under `src/services/resonite/`:

Commands are registered for **guild install** and **user install** (DM / private channel). Enable **User Install** in the [Discord Developer Portal](https://discord.com/developers/applications) → **Installation**; see [Discord setup](DISCORD-SETUP.md). **`/resonite metrics` …** admin commands still require a **server** and **Administrator**.

| Subfolder | Role |
|-----------|------|
| `api/` | HTTP client for public Resonite API |
| `wiki/` | Wiki search and previews |
| `users/` | Public user lookup |
| `records/` | Sessions, record summaries, link parsing |
| `team/` | Socials roster and platform previews |
| `metrics/` | Sessions + stats for live Discord mirror posts |

The Resonite cloud API is read-only and public; it is a WIP and may return 404 or limited fields without auth.

Optional **`visible`** on slash commands **except** **`/resonite metrics` …** (those are channel-visible only) and **except** commands that inherently need a guild (metrics admin): elsewhere, omit or false → only you see the reply; **`visible: true`** → channel-visible.

## Slash commands

| Command | Purpose |
|---------|---------|
| `/resonite search` `record` `url` [`visible`] | Parse `resrec://`, `https://api.resonite.com/open/world\|session/…`, `Resonite:?world=…`, or pasted text with those patterns; load metadata via unauthenticated API. Embed + link buttons (API JSON, open junction, thumbnail CDN when available). |
| `/resonite search` `wiki` `query` [`visible`] [`preview_chars`] | `preview_chars` **500–1500** (default **500**). Exact title → Components v2 preview. Otherwise opensearch up to **10** hits; one hit → auto-load or single-option select; two or more → list + string select. |
| `/resonite search` `account` `username` [`visible`] | Public user list (`GET …/users?name=…`). Autocomplete from API. |
| `/resonite search` `github` [`visible`] | Components v2 dashboard for Yellow-Dog-Man project boards and Resonite issue repositories. **Boards** scope opens the paginated board list; **repo** scope supports repository, query, author, label paging (25 labels per page), issue results pagination, and a **string select on each results page** that opens the **same Components v2 issue detail** as **`/resonite projects list`** when the issue is on a team board (body + images); otherwise loads the issue body from GitHub REST. Requires `GITHUB_TOKEN`. |
| `/resonite projects` `list` [`board`] [`in_progress`] [`done`] [`visible`] | Browse Yellow-Dog-Man GitHub Project boards. Omit `board` for a board picker; list/search pages show up to **10** items per page with a **Status** filter menu (Kanban columns) when applicable, a string select to open an issue embed (same as the picker), and pagination. |
| `/resonite` `quest` [`visible`] | Components v2 notice about Quest / standalone VR; cites [Renderite candidates](https://github.com/Yellow-Dog-Man/Renderite.Candidates); directs toward PC VR. |
| `/resonite metrics` `register` | **Administrator.** Subscribe channel: one live metrics message (global stats + top sessions), rewritten each poll. Stored in `guild_settings` (`GuildSettings.metrics*`). Replies are **channel-visible** (not ephemeral). |
| `/resonite metrics` `status` | **Administrator.** Show registered channel + thumbnail setting (channel-visible). |
| `/resonite metrics` `unregister` | **Administrator.** Confirm/cancel buttons; removes subscription and best-effort deletes the metrics message (channel-visible). |
| `/resonite metrics` `preview` `enabled` | **Administrator.** Toggle large session thumbnails per guild (channel-visible). |
| `/resonite metrics` `info` | Short embed: upstream Resonite Discord Sessions (MIT) and public API endpoints used (channel-visible). |
| `/resonite` `socials` `user` `platform` [`visible`] | Team roster. `user` autocomplete lists members; `platform` shows only platforms that user has (`wiki`, `discord`, `twitter`, …, or `all`). Specific platform → profile preview via official APIs (`platformPreview`, `team/previews/`). `all` → link buttons; **All platforms** returns from preview. Wiki-only members support `wiki` / `all`; optional `discord: { userId, username }` on roster entries for Discord-only links. |

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
