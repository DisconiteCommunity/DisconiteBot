import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  APPLICATION_ID: z
    .string()
    .min(1, "APPLICATION_ID is required")
    .optional(),
  BOT_OWNER_ID: z.string().min(1, "BOT_OWNER_ID is required"),

  DATABASE_URL: z.string().url("DATABASE_URL must be a valid database URL"),

  PORT: z
    .string()
    .regex(/^\d+$/, "PORT must be a number")
    .default("3000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(65535)),

  ENV: z.enum(["development", "production", "test"]).default("development"),

  LOG_LEVEL: z
    .enum(["DEBUG", "INFO", "WARN", "ERROR"])
    .default("INFO")
    .transform((val) => val.toUpperCase()),

  WEBLATE_BASE_URL: z
    .string()
    .url("WEBLATE_BASE_URL must be a valid URL")
    .optional(),
  WEBLATE_API_TOKEN: z.string().optional(),
  WEBLATE_PROJECT_SLUG: z.string().min(1).optional(),
  DISCONITE_FORUM_BASE_URL: z
    .string()
    .url("DISCONITE_FORUM_BASE_URL must be a valid URL")
    .optional(),

  /** YouTube Data API v3 — channel snippets and statistics for socials previews. */
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  /** X (Twitter) API v2 app-only bearer token — user profile lookups. */
  X_API_BEARER_TOKEN: z.string().min(1).optional(),
  /** Twitch Helix client id — user profile and follower totals. */
  TWITCH_CLIENT_ID: z.string().min(1).optional(),
  /** Reddit API app credentials (script/app) — oauth.reddit.com user about. */
  REDDIT_CLIENT_ID: z.string().min(1).optional(),
  REDDIT_CLIENT_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function validateEnv(): Env {
  try {
    env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .filter((e: z.ZodIssue) => {
          if (e.code === "invalid_type") {
            const invalidTypeIssue = e as z.ZodIssue & { received?: string };
            return invalidTypeIssue.received === "undefined";
          }
          return false;
        })
        .map((e: z.ZodIssue) => e.path.join("."));
      const invalidVars = error.issues
        .filter((e: z.ZodIssue) => {
          if (e.code === "invalid_type") {
            const invalidTypeIssue = e as z.ZodIssue & { received?: string };
            return invalidTypeIssue.received !== "undefined";
          }
          return true;
        })
        .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`);

      let errorMessage = "Environment variable validation failed:\n\n";

      if (missingVars.length > 0) {
        errorMessage += `Missing required variables:\n${missingVars.map((v: string) => `  - ${v}`).join("\n")}\n\n`;
      }

      if (invalidVars.length > 0) {
        errorMessage += `Invalid variables:\n${invalidVars.map((v: string) => `  - ${v}`).join("\n")}\n`;
      }

      throw new Error(errorMessage);
    }
    throw error;
  }
}

export function getEnv(): Env {
  if (!env) {
    throw new Error(
      "Environment variables not validated. Call validateEnv() at startup first.",
    );
  }
  return env;
}
