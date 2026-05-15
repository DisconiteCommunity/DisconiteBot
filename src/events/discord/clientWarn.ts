import { ArgsOf, Discord, On } from "discordx";
import { loggers } from "../../utility/logging/logger.js";

@Discord()
export class ClientWarnEvent {
  @On({ event: "warn" })
  async onWarn([message]: ArgsOf<"warn">): Promise<void> {
    loggers.bot.warn(`Discord.js client: ${message}`);
  }
}
