import { describe, it, expect } from "vitest";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
} from "discord.js";
import {
  getSlashCommandPath,
  serializeSlashCommandOptions,
} from "../../../src/utility/discord/slashCommandLoggingGuard.js";

function mockSlashInteraction(
  overrides: Partial<{
    commandName: string;
    data: ChatInputCommandInteraction["options"]["data"];
    group: string | null;
    sub: string | null;
  }> = {},
): ChatInputCommandInteraction {
  const {
    commandName = "resonite",
    data = [],
    group = null,
    sub = null,
  } = overrides;

  return {
    commandName,
    options: {
      data,
      getSubcommandGroup: () => group,
      getSubcommand: () => sub,
    },
  } as unknown as ChatInputCommandInteraction;
}

describe("slashCommandLoggingGuard helpers", () => {
  it("builds command path with group and subcommand", () => {
    const interaction = mockSlashInteraction({
      commandName: "resonite",
      group: "search",
      sub: "issues",
    });

    expect(getSlashCommandPath(interaction)).toBe("resonite search issues");
  });

  it("redacts sensitive option names and truncates long strings", () => {
    const longValue = "x".repeat(250);
    const interaction = mockSlashInteraction({
      data: [
        {
          name: "query",
          type: ApplicationCommandOptionType.String,
          value: longValue,
        },
        {
          name: "api_key",
          type: ApplicationCommandOptionType.String,
          value: "should-not-appear",
        },
      ],
    });

    expect(serializeSlashCommandOptions(interaction)).toEqual({
      query: `${"x".repeat(200)}…`,
      api_key: "[redacted]",
    });
  });

  it("serializes nested subcommand options", () => {
    const interaction = mockSlashInteraction({
      data: [
        {
          name: "forum",
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: "query",
              type: ApplicationCommandOptionType.String,
              value: "hello",
            },
          ],
        },
      ],
    });

    expect(serializeSlashCommandOptions(interaction)).toEqual({
      forum: { query: "hello" },
    });
  });
});
