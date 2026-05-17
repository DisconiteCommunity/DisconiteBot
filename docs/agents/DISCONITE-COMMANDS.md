# Disconite commands

Slash commands under `/disconite`. Shared logic: `src/services/disconite/weblate/`, `src/services/disconite/discourse/`.

Optional env (defaults in code): `WEBLATE_BASE_URL`, `WEBLATE_API_TOKEN`, `DISCONITE_FORUM_BASE_URL`. See [Environment](ENVIRONMENT.md) and `.env.example`.

| Command | Purpose |
|---------|---------|
| `/disconite` `translate` | Info embed + link to [translate.disconite.net](https://translate.disconite.net). |
| `/disconite` `forum` | Info embed + links to [disconite.net](https://disconite.net) and the [welcome topic](https://disconite.net/t/welcome-to-the-disconite-forum/53/5). |
| `/disconite search` `translation` `key` [`languages`] [`query`] [`ephemeral`] | Search Weblate. `key` and `languages` use autocomplete. Optional `languages`: comma-separated codes (e.g. `en,nl`); empty = all langs. One key → embed; several → string select menu. |
| `/disconite search` `forum` `query` [`ephemeral`] | Search forum via `GET /search.json`. `query` autocomplete suggests topics. One post → embed; several → string select menu. Author lines show forum account metadata when available. |

## Related docs

- [Extending the project](EXTENDING.md)
- [Environment](ENVIRONMENT.md)
