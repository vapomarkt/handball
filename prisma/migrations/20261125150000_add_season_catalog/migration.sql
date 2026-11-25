-- CreateTable
CREATE TABLE "season_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "season_catalog_name_key" ON "season_catalog"("name");

-- CreateIndex
CREATE INDEX "season_catalog_isActive_sortOrder_idx" ON "season_catalog"("isActive", "sortOrder");

-- Seed initial German handball seasons (idempotent)
INSERT INTO "season_catalog" ("id", "name", "startDate", "endDate", "sortOrder", "isDefault", "isActive", "createdAt", "updatedAt")
VALUES
    ('season_cat_2024_25', '2024/25', '2024-07-01T00:00:00.000Z', '2025-06-30T23:59:59.000Z', 10, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('season_cat_2025_26', '2025/26', '2025-07-01T00:00:00.000Z', '2026-06-30T23:59:59.000Z', 20, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('season_cat_2026_27', '2026/27', '2026-07-01T00:00:00.000Z', '2027-06-30T23:59:59.000Z', 30, true,  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('season_cat_2027_28', '2027/28', '2027-07-01T00:00:00.000Z', '2028-06-30T23:59:59.000Z', 40, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('season_cat_2028_29', '2028/29', '2028-07-01T00:00:00.000Z', '2029-06-30T23:59:59.000Z', 50, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
