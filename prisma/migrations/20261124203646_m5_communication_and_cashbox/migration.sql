-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'STAFF_ONLY');

-- CreateEnum
CREATE TYPE "CashEntryType" AS ENUM ('FINE', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CashEntryStatus" AS ENUM ('OPEN', 'PAID');

-- CreateTable
CREATE TABLE "team_announcement" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_poll" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "closesAt" TIMESTAMP(3),
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_poll_option" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "team_poll_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_poll_vote" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voterName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_poll_vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fine_catalog_item" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Allgemein',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fine_catalog_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_cash_entry" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "memberId" TEXT,
    "type" "CashEntryType" NOT NULL DEFAULT 'FINE',
    "status" "CashEntryStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_cash_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_announcement_teamId_isPinned_createdAt_idx" ON "team_announcement"("teamId", "isPinned", "createdAt");

-- CreateIndex
CREATE INDEX "team_poll_teamId_createdAt_idx" ON "team_poll"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "team_poll_option_pollId_idx" ON "team_poll_option"("pollId");

-- CreateIndex
CREATE INDEX "team_poll_vote_optionId_idx" ON "team_poll_vote"("optionId");

-- CreateIndex
CREATE INDEX "team_poll_vote_userId_idx" ON "team_poll_vote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_poll_vote_optionId_userId_key" ON "team_poll_vote"("optionId", "userId");

-- CreateIndex
CREATE INDEX "fine_catalog_item_teamId_idx" ON "fine_catalog_item"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "fine_catalog_item_teamId_title_key" ON "fine_catalog_item"("teamId", "title");

-- CreateIndex
CREATE INDEX "team_cash_entry_teamId_status_createdAt_idx" ON "team_cash_entry"("teamId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "team_cash_entry_memberId_idx" ON "team_cash_entry"("memberId");

-- AddForeignKey
ALTER TABLE "team_announcement" ADD CONSTRAINT "team_announcement_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_announcement" ADD CONSTRAINT "team_announcement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_poll" ADD CONSTRAINT "team_poll_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_poll" ADD CONSTRAINT "team_poll_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_poll_option" ADD CONSTRAINT "team_poll_option_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "team_poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_poll_vote" ADD CONSTRAINT "team_poll_vote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "team_poll_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fine_catalog_item" ADD CONSTRAINT "fine_catalog_item_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fine_catalog_item" ADD CONSTRAINT "fine_catalog_item_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_cash_entry" ADD CONSTRAINT "team_cash_entry_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_cash_entry" ADD CONSTRAINT "team_cash_entry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_cash_entry" ADD CONSTRAINT "team_cash_entry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
