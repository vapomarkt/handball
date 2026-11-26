-- AlterEnum
ALTER TYPE "MemberRole" ADD VALUE IF NOT EXISTS 'TEAM_MANAGER';

-- AlterTable
ALTER TABLE "team_invite" ADD COLUMN IF NOT EXISTS "shortCode" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_onboarding_state" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profilePromptDismissed" BOOLEAN NOT NULL DEFAULT false,
    "passkeyPromptDismissed" BOOLEAN NOT NULL DEFAULT false,
    "tourDisabled" BOOLEAN NOT NULL DEFAULT false,
    "tourCompletedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tourLastCompletedAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_onboarding_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "passkey_credentialID_key" ON "passkey"("credentialID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "passkey_userId_idx" ON "passkey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_onboarding_state_userId_key" ON "user_onboarding_state"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "team_invite_shortCode_key" ON "team_invite"("shortCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_invite_shortCode_idx" ON "team_invite"("shortCode");

-- AddForeignKey
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_onboarding_state" ADD CONSTRAINT "user_onboarding_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
