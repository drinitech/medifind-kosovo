-- CreateEnum
CREATE TYPE "PharmacySource" AS ENUM ('REGISTRATION', 'OSM', 'SEED');

-- AlterTable
ALTER TABLE "Pharmacy" ADD COLUMN     "dataSource" "PharmacySource" NOT NULL DEFAULT 'REGISTRATION',
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "sourceUpdatedAt" TIMESTAMP(3),
ALTER COLUMN "address" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Pharmacy_externalId_key" ON "Pharmacy"("externalId");

-- CreateIndex
CREATE INDEX "Pharmacy_dataSource_isActive_idx" ON "Pharmacy"("dataSource", "isActive");


-- Existing demo rows came from the seed script.
UPDATE "Pharmacy" SET "dataSource" = 'SEED' WHERE "isDemo" = true;
