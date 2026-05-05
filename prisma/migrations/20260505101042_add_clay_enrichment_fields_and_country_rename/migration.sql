/*
  Warnings:

  - You are about to drop the column `hqCountry` on the `Company` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CrmGroup" AS ENUM ('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7A', 'G7B');

-- CreateEnum
CREATE TYPE "CrmPainTier" AS ENUM ('T1', 'T2', 'T3');

-- CreateEnum
CREATE TYPE "CrmPersona" AS ENUM ('DM', 'OP');

-- CreateEnum
CREATE TYPE "EnrichmentSource" AS ENUM ('clay', 'trigify', 'manual', 'csv_import', 'inbound_form');

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "hqCountry",
ADD COLUMN     "clayTableSegment" TEXT,
ADD COLUMN     "companySize" TEXT,
ADD COLUMN     "companyType" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "enrichedAt" TIMESTAMP(3),
ADD COLUMN     "enrichmentSource" "EnrichmentSource",
ADD COLUMN     "group" "CrmGroup",
ADD COLUMN     "location" TEXT,
ADD COLUMN     "painTier" "CrmPainTier";

-- AlterTable
ALTER TABLE "CrmContact" ADD COLUMN     "enrichedAt" TIMESTAMP(3),
ADD COLUMN     "enrichmentSource" "EnrichmentSource",
ADD COLUMN     "group" "CrmGroup",
ADD COLUMN     "location" TEXT,
ADD COLUMN     "painTier" "CrmPainTier",
ADD COLUMN     "persona" "CrmPersona";

-- CreateIndex
CREATE INDEX "Company_group_idx" ON "Company"("group");

-- CreateIndex
CREATE INDEX "Company_painTier_idx" ON "Company"("painTier");

-- CreateIndex
CREATE INDEX "CrmContact_group_idx" ON "CrmContact"("group");

-- CreateIndex
CREATE INDEX "CrmContact_painTier_idx" ON "CrmContact"("painTier");

-- CreateIndex
CREATE INDEX "CrmContact_persona_idx" ON "CrmContact"("persona");
