import "server-only";

import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type ServerEnvironment = z.infer<typeof schema>;

export function getServerEnvironment(): ServerEnvironment {
  return schema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    LOG_LEVEL: process.env.LOG_LEVEL
  });
}

