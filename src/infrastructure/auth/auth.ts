import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "../db/prisma";

function resolveBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

function resolveTrustedOrigins(): string[] {
  const origins = new Set<string>(["http://localhost:3000"]);
  if (process.env.BETTER_AUTH_URL) origins.add(process.env.BETTER_AUTH_URL);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.add(process.env.NEXT_PUBLIC_APP_URL);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
    for (const origin of process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }
  return Array.from(origins);
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "throwoff-dev-fallback-secret-change-in-production",
  baseURL: resolveBaseUrl(),
  trustedOrigins: resolveTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 Tage
    updateAge: 60 * 60 * 24, // Täglich erneuern
  },
  rateLimit: {
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 40,
      },
      "/sign-up/email": {
        window: 60,
        max: 30,
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
