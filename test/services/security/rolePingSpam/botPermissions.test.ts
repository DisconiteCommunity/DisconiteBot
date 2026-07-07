import { describe, it, expect } from "vitest";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import {
  formatMissingRolePingSpamPermissionsMessage,
  getMissingRolePingSpamPermissions,
  hasRolePingSpamPermissions,
} from "../../../../src/services/security/rolePingSpam/botPermissions.js";

function mockMember(permissions: bigint[]) {
  return {
    permissions: new PermissionsBitField(permissions),
  };
}

describe("botPermissions", () => {
  it("reports no missing permissions when both are granted", () => {
    const member = mockMember([
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ModerateMembers,
    ]);
    expect(getMissingRolePingSpamPermissions(member as never)).toEqual([]);
    expect(hasRolePingSpamPermissions(member as never)).toBe(true);
  });

  it("reports missing permissions individually", () => {
    const member = mockMember([PermissionFlagsBits.ManageMessages]);
    expect(getMissingRolePingSpamPermissions(member as never)).toEqual([
      "Moderate Members",
    ]);
  });

  it("formats a user-facing permission message", () => {
    expect(
      formatMissingRolePingSpamPermissionsMessage([
        "Manage Messages",
        "Moderate Members",
      ]),
    ).toContain("**Manage Messages** and **Moderate Members**");
    expect(
      formatMissingRolePingSpamPermissionsMessage([
        "Manage Messages",
        "Moderate Members",
      ]),
    ).toContain("/disconite security enable");
  });
});
