-- CreateEnum
CREATE TYPE "SignalDecayCurve" AS ENUM ('LINEAR', 'EXPONENTIAL', 'STEP');

-- CreateEnum
CREATE TYPE "SignalCategory" AS ENUM ('INTENT', 'MARKET');

-- AlterTable
ALTER TABLE "IntentSignal" DROP COLUMN "raw",
DROP COLUMN "score",
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "decayedPoints" INTEGER,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "signalTypeId" TEXT NOT NULL,
ADD COLUMN     "sourceUrl" TEXT,
ALTER COLUMN "contactId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SignalTypeRegistry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "defaultPoints" INTEGER NOT NULL,
    "decayDays" INTEGER NOT NULL,
    "decayCurve" "SignalDecayCurve" NOT NULL,
    "category" "SignalCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalTypeRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSignal" (
    "id" TEXT NOT NULL,
    "signalTypeId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "vertical" TEXT,
    "points" INTEGER NOT NULL,
    "decayedPoints" INTEGER,
    "metadata" JSONB,
    "sourceUrl" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalTypeRegistry_code_key" ON "SignalTypeRegistry"("code");

-- CreateIndex
CREATE INDEX "SignalTypeRegistry_category_isActive_idx" ON "SignalTypeRegistry"("category", "isActive");

-- CreateIndex
CREATE INDEX "MarketSignal_country_signalTypeId_occurredAt_idx" ON "MarketSignal"("country", "signalTypeId", "occurredAt");

-- CreateIndex
CREATE INDEX "MarketSignal_vertical_signalTypeId_occurredAt_idx" ON "MarketSignal"("vertical", "signalTypeId", "occurredAt");

-- CreateIndex
CREATE INDEX "IntentSignal_companyId_signalTypeId_createdAt_idx" ON "IntentSignal"("companyId", "signalTypeId", "createdAt");

-- CreateIndex
CREATE INDEX "IntentSignal_contactId_signalTypeId_createdAt_idx" ON "IntentSignal"("contactId", "signalTypeId", "createdAt");

-- AddForeignKey
ALTER TABLE "IntentSignal" ADD CONSTRAINT "IntentSignal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentSignal" ADD CONSTRAINT "IntentSignal_signalTypeId_fkey" FOREIGN KEY ("signalTypeId") REFERENCES "SignalTypeRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSignal" ADD CONSTRAINT "MarketSignal_signalTypeId_fkey" FOREIGN KEY ("signalTypeId") REFERENCES "SignalTypeRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

