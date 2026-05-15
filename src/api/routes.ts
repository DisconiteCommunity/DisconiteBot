import Router from "@koa/router";
import type { Context } from "koa";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LEGAL_COPY_REVISION = new Date().toISOString().slice(0, 10);

function layout(title: string, innerHtml: string): string {
  const safeTitle = escapeHtml(title);
  const safeDate = escapeHtml(LEGAL_COPY_REVISION);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${safeTitle} — Disconite Bot</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem;
      line-height: 1.55; color: #111; }
    nav { margin-bottom: 1.75rem; font-size: 0.9rem; }
    nav a { margin-right: 1rem; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.05rem; margin-top: 1.35rem; margin-bottom: 0.35rem; }
    p, li { font-size: 0.95rem; }
    ul { padding-left: 1.25rem; }
    .muted { color: #555; font-size: 0.85rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <nav><a href="/">API</a><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a></nav>
  <h1>${safeTitle}</h1>
  ${innerHtml}
  <p class="muted">Last updated: ${safeDate}. This text is informational; have qualified counsel review before relying on it.</p>
</body>
</html>`;
}

function sendHtml(ctx: Context, html: string): void {
  ctx.type = "html";
  ctx.body = html;
}

const TERMS_INNER = `
<p>By adding or using this bot on a Discord server, you agree to these terms for that server and bot instance.</p>
<h2>1. The service</h2>
<p>This bot is software that runs on Discord. Features may change at any time. Availability is not guaranteed.</p>
<h2>2. Acceptable use</h2>
<p>You must not use the bot to violate Discord's Terms of Service or Community Guidelines, or applicable law. Do not attempt to disrupt, exploit, or misuse the bot, its infrastructure, or other users' data.</p>
<h2>3. Your content and servers</h2>
<p>Server administrators are responsible for how the bot is configured and used on their servers. Users are responsible for their own conduct when interacting with the bot.</p>
<h2>4. Disclaimer</h2>
<p>The bot is provided "as is" without warranties of any kind. Operators are not liable for indirect or consequential damages to the extent permitted by law.</p>
<h2>5. Changes</h2>
<p>These terms may be updated by publishing a new version at this URL. Continued use after changes constitutes acceptance of the revised terms.</p>
<h2>6. Contact</h2>
<p>For questions about this deployment, contact the person or team operating this bot instance (for example, your server's administrators).</p>
`;

const PRIVACY_INNER = `
<p>This policy describes how a typical deployment of this Discord bot handles information. The operator of your instance may amend or supplement this text.</p>
<h2>1. Who is responsible</h2>
<p>The operator of the bot instance (server staff or hosting organization) is responsible for how data is processed in practice.</p>
<h2>2. What the bot may process</h2>
<p>Depending on its features and permissions, the bot may process:</p>
<ul>
  <li>Discord identifiers (such as user, guild, and channel IDs) needed to run commands and store bot state.</li>
  <li>Message or interaction content visible to the bot in channels where it is used.</li>
  <li>Technical logs (errors, diagnostics) on the host running the bot.</li>
</ul>
<h2>3. Why and how long</h2>
<p>Data is used to provide bot functionality, maintain security, and troubleshoot issues. Retention depends on configuration (for example, database records and log rotation). Minimize data you store to what you need.</p>
<h2>4. Sharing</h2>
<p>Discord processes data under Discord's own policies. This bot does not sell personal data. Other processors depend on your deployment (database host, cloud provider, etc.).</p>
<h2>5. Security</h2>
<p>Operators should protect tokens, database credentials, and backups. Users should not share secrets in Discord messages.</p>
<h2>6. Your rights</h2>
<p>Where laws such as the GDPR apply, you may have rights to access, rectify, or delete personal data. Contact the operator of this bot instance to exercise those rights.</p>
<h2>7. Children</h2>
<p>Discord's age rules apply. The bot is not intended for use outside those rules.</p>
<h2>8. Changes</h2>
<p>This policy may be updated by publishing a new version at this URL.</p>
`;

/** Plain Koa routes (avoids @discordx/koa, which targets an older @discordx/internal API than discordx 11). */
export function createApiRouter(): Router {
  const router = new Router();

  router.get("/", (ctx) => {
    ctx.body = {
      ok: true,
      service: "disconite-bot",
      links: { terms: "/terms", privacy: "/privacy" },
    };
  });

  router.get("/terms", (ctx) => {
    sendHtml(ctx, layout("Terms of Service", TERMS_INNER));
  });

  router.get("/privacy", (ctx) => {
    sendHtml(ctx, layout("Privacy Policy", PRIVACY_INNER));
  });

  return router;
}
