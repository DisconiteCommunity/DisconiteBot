import { GuildMember, PermissionFlagsBits } from "discord.js";

export function getMissingRolePingSpamPermissions(
  member: GuildMember | null | undefined,
): string[] {
  if (!member) {
    return ["Manage Messages", "Moderate Members"];
  }

  const missing: string[] = [];
  if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    missing.push("Manage Messages");
  }
  if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    missing.push("Moderate Members");
  }
  return missing;
}

export function hasRolePingSpamPermissions(
  member: GuildMember | null | undefined,
): boolean {
  return getMissingRolePingSpamPermissions(member).length === 0;
}

export function formatMissingRolePingSpamPermissionsMessage(
  missing: string[],
): string {
  const permissionList = missing.map((permission) => `**${permission}**`).join(" and ");
  return (
    `The bot needs ${permissionList} to run compromised account spam protection. ` +
    "Grant these permissions to the bot's role in **Server settings → Roles**, then run **`/disconite security enable`** again."
  );
}
