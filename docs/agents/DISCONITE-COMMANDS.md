# Disconite commands

Slash commands under `/disconite`. Command modules: `src/commands/disconite/search/` (`/disconite search` …) and `src/commands/disconite/root/` (`/disconite translate`, `/disconite forum`). Shared logic: `src/services/disconite/weblate/`, `src/services/disconite/discourse/`.

Commands are registered for **guild install** and **user install** (DM / private channel). Enable **User Install** in the [Discord Developer Portal](https://discord.com/developers/applications) → **Installation**; see [Discord setup](DISCORD-SETUP.md).

Optional env (defaults in code): `WEBLATE_BASE_URL`, `WEBLATE_API_TOKEN`, `DISCONITE_FORUM_BASE_URL`. See [Environment](ENVIRONMENT.md) and `.env.example`.

Optional **`visible`** on most slash commands: omit or false → only you see the reply; **`visible: true`** → channel-visible.

Ephemeral search results can include **Showcase in channel** (server text channels only): posts the same preview publicly with attribution; the button payload is kept in memory for ~45 minutes.

| Command | Purpose |
|---------|---------|
| `/disconite` `translate` [`visible`] | Info embed + link to [translate.disconite.net](https://translate.disconite.net). |
| `/disconite` `forum` [`visible`] | Info embed + links to [disconite.net](https://disconite.net) and the [welcome topic](https://disconite.net/t/welcome-to-the-disconite-forum/53/5). |
| `/disconite search` `translation` `key` [`languages`] [`query`] [`visible`] | Search Weblate. `key` and `languages` use autocomplete. Optional `languages`: comma-separated codes (e.g. `en,nl`); empty = all langs. One key → embed; several → string select menu. |
| `/disconite search` `forum` `query` [`visible`] | Search forum via `GET /search.json`. `query` autocomplete suggests topics. One post → embed; several → string select menu. Author lines show forum account metadata when available. |

## Related docs

- [Extending the project](EXTENDING.md)
- [Environment](ENVIRONMENT.md)
