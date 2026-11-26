import { expo } from "@better-auth/expo";
import { getAuthenticatorName, passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { bearer, emailOTP } from "better-auth/plugins";
import { BRANDING } from "@/config/branding";
import { prisma } from "../db/prisma";
import { getMailProvider, recordDevOtp } from "../mail/mail-provider";
import { renderOtpEmail } from "../mail/templates";

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

function resolvePasskeyRpId(): string {
  if (process.env.PASSKEY_RP_ID) {
    return process.env.PASSKEY_RP_ID.trim();
  }
  try {
    return new URL(resolveBaseUrl()).hostname;
  } catch {
    return "localhost";
  }
}

function resolveTrustedOrigins(): string[] {
  const origins = new Set<string>([
    "http://localhost:3000",
    "throwoff://",
  ]);
  if (process.env.NODE_ENV !== "production") {
    origins.add("exp://");
    origins.add("exp://*/*");
    origins.add("exp://10.0.*.*:*/*");
    origins.add("exp://192.168.*.*:*/*");
    origins.add("exp://172.*.*.*:*/*");
  }
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

function resolvePasskeyOrigins(): string[] {
  return resolveTrustedOrigins().filter(
    (origin) => origin.startsWith("https://") || origin.startsWith("http://")
  );
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
  // Vorbereitung für langfristiges Social Login (Google, Apple, etc.) ohne Schema-Migration
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "apple"],
    },
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
      "/email-otp/send-verification-otp": {
        window: 60,
        max: 12,
      },
      "/sign-in/email-otp": {
        window: 60,
        max: 25,
      },
    },
  },
  plugins: [
    nextCookies(),
    bearer(),
    expo(),
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 Minuten
      allowedAttempts: 5,
      sendVerificationOTP: async ({ email, otp, type }) => {
        recordDevOtp({ email, otp, type });
        const rendered = renderOtpEmail({ otp, type });
        const provider = getMailProvider();
        await provider.send({
          to: email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
        });
      },
    }),
    passkey({
      rpID: resolvePasskeyRpId(),
      rpName: BRANDING.appName,
      origin: resolvePasskeyOrigins(),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      registration: {
        afterVerification: async ({ verification }) => ({
          name:
            getAuthenticatorName(verification.registrationInfo?.aaguid) ??
            "Passkey",
        }),
      },
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
