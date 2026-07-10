-- Apify PR3c-b — Company capture-source marker (the pipeline-UI filter's missing
-- piece; crossed-T = intentScore >= T and enriched = enrichedAt NOT NULL already
-- exist). Front-end filter is a separate later slice.
--
-- ADDITIVE + 0-ROW-SAFE: a plain nullable ADD COLUMN — metadata-only on any
-- PostgreSQL (no default, no rewrite, no lock), instant at any row count. Mirrors
-- the existing CrmContact/Deal."acquisitionSource" TEXT columns (0_baseline).
-- Values written by the PR3c-a capture ('apify-jobboard' / 'apify-crunchbase');
-- existing non-pipeline companies stay NULL. No index (a source filter over a
-- ~1.6k-row table needs none — add later if the UI grows).

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "acquisitionSource" TEXT;
