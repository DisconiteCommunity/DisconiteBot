import "reflect-metadata";
import "dotenv/config";
import { dirname, importx } from "@discordx/importer";
import multer from "@koa/multer";
import bodyParser from "@koa/bodyparser";
import Koa from "koa";
import { Interaction, Message, MessageFlags } from "discord.js";
import { Client } from "discordx";
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { validateEnv, getEnv } from "./config/env.js";
import { loggers, logger, LogLevel } from "./utility/logging/logger.js";
import { ConfigError } from "./utility/errors/errors.js";
import { ExceptionConstants } from "./config/constants.js";
import { BOT_INTENTS, BOT_CONFIG } from "./config/discord.js";
import { createApiRouter } from "./api/routes.js";
import { startResoniteMetricsPoller } from "./services/resonite/metrics/resoniteMetricsPoller.js";
import { slashCommandLoggingGuard } from "./utility/discord/slashCommandLoggingGuard.js";
import { loadRolePingSpamConfigCache } from "./services/security/rolePingSpam/configCache.js";
import { startRolePingSpamCacheJanitor } from "./services/security/rolePingSpam/janitor.js";

let env;
try {
  env = validateEnv();

  const logLevelMap: Record<string, LogLevel> = {
    DEBUG: LogLevel.DEBUG,
    INFO: LogLevel.INFO,
    WARN: LogLevel.WARN,
    ERROR: LogLevel.ERROR,
  };
  const logLevel = logLevelMap[env.LOG_LEVEL] ?? LogLevel.INFO;
  logger.setLevel(logLevel);
} catch (error) {
  loggers.startup.error("Failed to validate environment variables", error);
  process.exit(1);
}

const databaseUrl = env.DATABASE_URL;
const adapter = new PrismaMariaDb(databaseUrl);
export const prisma = new PrismaClient({ adapter });

export const bot = new Client({
  intents: BOT_INTENTS,
  silent: BOT_CONFIG.silent,
  guards: [slashCommandLoggingGuard],
});

bot.rest.on("rateLimited", (info) => {
  loggers.bot.warn("Rate limit hit!", {
    endpoint: info.route,
    timeout: info.timeToReset,
    limit: info.limit,
  });
});

bot.once("clientReady", async () => {
  try {
    await bot.initApplicationCommands();
    loggers.bot.info("################################################################");
    loggers.bot.info("#                                                              #");
    loggers.bot.info("#                    Disconite Bot                             #");
    loggers.bot.info("#                  https://disconite.net                       #");
    loggers.bot.info("#                                                              #");
    loggers.bot.info("###############################################################");
    loggers.bot.info("#  Github:  https://github.com/DisconiteCommunity/DisconiteBot #");
    loggers.bot.info("#  Credits: Created by Xeravax                                 #");
    loggers.bot.info("#           https://stefanocoding.me                           #");
    loggers.bot.info("#  Special thanks to Resonite and the community!               #");
    loggers.bot.info("################################################################");
  } catch (error) {
    loggers.bot.error("Failed to initialize application commands", error);
  }

  startResoniteMetricsPoller(bot, prisma);
  await loadRolePingSpamConfigCache(prisma, bot);
  startRolePingSpamCacheJanitor();
});

bot.on("interactionCreate", async (interaction: Interaction) => {
  try {
    await bot.executeInteraction(interaction);
  } catch (error) {
    loggers.bot.error("Error handling interaction", error, {
      interactionId: interaction.id,
      type: interaction.type,
    });
    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      try {
        await interaction.reply({
          content: "❌ An error occurred while processing your request.",
          flags: MessageFlags.Ephemeral,
        });
      } catch (replyError) {
        loggers.bot.error("Failed to send error reply", replyError);
      }
    }
  }
});

bot.on("messageCreate", async (message: Message) => {
  try {
    await bot.executeCommand(message);
  } catch (error) {
    loggers.bot.error("Error handling message", error, {
      messageId: message.id,
      channelId: message.channelId,
    });
  }
});

async function run(): Promise<void> {
  await importx(
    `${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`,
  );

  const runtimeEnv = getEnv();
  if (!runtimeEnv.BOT_TOKEN) {
    throw new ConfigError(
      "Bot token missing. Please check you have included it in the .env file. Required field: BOT_TOKEN=xxx",
    );
  }

  await bot.login(runtimeEnv.BOT_TOKEN);

  const server = new Koa();
  server.use(multer().single("file"));
  server.use(bodyParser());
  const api = createApiRouter();
  server.use(api.routes());
  server.use(api.allowedMethods());

  const port = runtimeEnv.PORT;
  server.listen(port, () => {
    loggers.bot.info(`Running On Port: ${port}`);
  });
}

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  loggers.shutdown.info(`Received ${signal}, shutting down gracefully...`);

  try {
    if (bot.isReady()) {
      bot.destroy();
      loggers.shutdown.info("Discord bot disconnected");
    }

    await prisma.$disconnect();
    loggers.shutdown.info("Database connection closed");

    loggers.shutdown.info("Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    loggers.shutdown.error("Error during shutdown", error);
    process.exit(1);
  }
}

let uncaughtExceptionCount = 0;
let lastUncaughtExceptionTime = 0;

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    "Unhandled Rejection",
    "Unhandled promise rejection",
    reason instanceof Error ? reason : new Error(String(reason)),
    { promise: String(promise) },
  );
});

process.on("uncaughtException", (error) => {
  const now = Date.now();

  if (
    now - lastUncaughtExceptionTime >
    ExceptionConstants.EXCEPTION_RESET_TIME
  ) {
    uncaughtExceptionCount = 0;
  }

  uncaughtExceptionCount++;
  lastUncaughtExceptionTime = now;

  logger.error(
    "Uncaught Exception",
    `Uncaught exception #${uncaughtExceptionCount}`,
    error,
  );

  if (
    uncaughtExceptionCount >= ExceptionConstants.MAX_UNCAUGHT_EXCEPTIONS
  ) {
    logger.error(
      "Fatal",
      `Too many uncaught exceptions (${uncaughtExceptionCount}) in a short period. Shutting down to prevent infinite loop.`,
    );
    gracefulShutdown("uncaughtException").catch(() => {
      process.exit(1);
    });
  } else {
    logger.warn(
      "Warning",
      "Bot will continue running despite uncaught exception. This may lead to unstable behavior.",
    );
  }
});

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

run().catch((error) => {
  loggers.startup.error("Fatal error during startup", error);
  process.exit(1);
});
