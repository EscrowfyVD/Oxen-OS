-- Apollo PR-W (2/2) — add `enrichmentRaw Json?` to Company + CrmContact.
--
-- Stores the raw Apollo enrich response (same idea as Meeting.raw) so un-mapped
-- fields (founded_year, latest_funding_stage, seniority, departments…) are
-- preserved and can be backfilled into columns later WITHOUT re-paying Apollo
-- credits. ADDITIVE, nullable, NO default, NO backfill — a catalog-only
-- ADD COLUMN, 0-row-safe even on the populated Company / CrmContact tables.

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "enrichmentRaw" JSONB;

-- AlterTable
ALTER TABLE "CrmContact" ADD COLUMN     "enrichmentRaw" JSONB;
