import { fetchResoniteJson } from "../api/api.js";

/** Loose shapes — API evolves; extra fields are ignored. */

export type ResoniteSessionUserDto = {
  username?: string;
  userId?: string;
  isPresent?: boolean;
};

export type ResoniteSessionDto = {
  name?: string;
  description?: string;
  correspondingWorldId?: { recordId?: string; ownerId?: string };
  tags?: string[];
  sessionId?: string;
  normalizedSessionId?: string;
  hostUserId?: string;
  hostUsername?: string;
  appVersion?: string;
  headlessHost?: boolean;
  sessionURLs?: string[];
  sessionUrLs?: string[];
  sessionUsers?: ResoniteSessionUserDto[];
  joinedUsers?: number;
  activeUsers?: number;
  totalJoinedUsers?: number;
  totalActiveUsers?: number;
  maxUsers?: number;
  mobileFriendly?: boolean;
  sessionBeginTime?: string;
  lastUpdate?: string;
  accessLevel?: string;
  thumbnailUrl?: string;
};

export type ResoniteCloudStatsDto = {
  uploadJobs?: number;
  recordPreprocessJobs?: number;
  assetVariantJobs?: number;
  captureTimestamp?: string;
};

export type ResoniteOnlineStatsDto = {
  captureTimestamp?: string;
  registeredUsers?: number;
  instanceCount?: number;
  usersInVR?: number;
  usersOnDesktop?: number;
  usersInScreen?: number;
  activeVisibleSessionsByAccessLevel?: Record<string, number>;
  activeHiddenSessionsByAccessLevel?: Record<string, number>;
  /** Nested keys are often PascalCase (`Anyone`, `Private`, …). */
  usersBySessionAccessLevel?: Record<string, number>;
  /** Nested keys are often PascalCase (`Headless`, `Bot`, …). */
  usersByClientType?: Record<string, number>;
};

export async function fetchResoniteSessions(): Promise<ResoniteSessionDto[]> {
  return fetchResoniteJson<ResoniteSessionDto[]>("/sessions");
}

export async function fetchResoniteCloudStats(): Promise<ResoniteCloudStatsDto> {
  return fetchResoniteJson<ResoniteCloudStatsDto>("/stats/cloudStats");
}

export async function fetchResoniteOnlineStats(): Promise<ResoniteOnlineStatsDto> {
  return fetchResoniteJson<ResoniteOnlineStatsDto>(
    "/stats/onlineStats",
  );
}
