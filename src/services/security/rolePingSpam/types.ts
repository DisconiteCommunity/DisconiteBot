import { z } from "zod";

export const ROLE_PING_SPAM_EXTRAS_KEY = "rolePingSpamProtection" as const;

export const rolePingSpamConfigSchema = z.object({
  enabled: z.boolean(),
  modLogChannelId: z.string().min(1),
  modPingRoleId: z.string().min(1).optional(),
  minChannels: z.number().int().min(2).default(2),
  minImages: z.number().int().min(1).default(2),
  minMessages: z.number().int().min(2).default(3),
  windowMs: z.number().int().min(500).default(3000),
  cacheRetentionMs: z.number().int().min(5000).default(60_000),
  timeoutMinutes: z.number().int().min(1).max(10_080).default(1440),
  dryRunUserIds: z.array(z.string().min(1)).default([]),
});

export type RolePingSpamConfig = z.infer<typeof rolePingSpamConfigSchema>;

export const DEFAULT_ROLE_PING_SPAM_CONFIG: Omit<
  RolePingSpamConfig,
  "enabled" | "modLogChannelId"
> = {
  minChannels: 2,
  minImages: 2,
  minMessages: 3,
  windowMs: 3000,
  cacheRetentionMs: 60_000,
  timeoutMinutes: 1440,
  dryRunUserIds: [],
};

export interface CachedSpamMessage {
  messageId: string;
  channelId: string;
  authorId: string;
  fingerprint: string;
  createdAt: number;
}

export interface SpamCluster {
  guildId: string;
  authorId: string;
  fingerprint: string;
  messages: CachedSpamMessage[];
}

export function isDryRunUser(
  config: RolePingSpamConfig,
  userId: string,
): boolean {
  return config.dryRunUserIds.includes(userId);
}
