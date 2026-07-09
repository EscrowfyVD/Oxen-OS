-- Apify PR3c-b-enrich slice 1 — enrichment attempt-tracking + the sweep's
-- partial index (deploy-ahead: columns + index land BEFORE their writer/reader,
-- the pass-3 sweep of slices 2-4).
--
-- ADDITIVE + 0-ROW-SAFE:
--   - "enrichmentAttemptedAt" TIMESTAMP NULL — plain nullable ADD COLUMN, no
--     rewrite, no lock. Last attempt timestamp (debug + give-up policy).
--     DISTINCT from "enrichedAt", which stays SUCCESS-only.
--   - "enrichmentAttempts" INTEGER NOT NULL DEFAULT 0 — on PostgreSQL >= 11 an
--     ADD COLUMN with a CONSTANT default is METADATA-ONLY ("fast default":
--     the default is stored in the catalog, existing rows are NOT rewritten).
--     Prod runs PG16 → instant at any row count (and the table is ~1.6k rows
--     anyway). Verified on the PG16 shadow.
--
-- THE PARTIAL INDEX (promised since #31 — lands with this deploy-ahead slice;
-- its reader is the pass-3 sweep):
--     sweep query: WHERE "intentScore" >= T AND "enrichedAt" IS NULL
--                    AND "domain" IS NULL AND "enrichmentAttempts" < 3
--                  ORDER BY "intentScore" DESC
--   - PARTIAL (the WHERE below) because the sweep-eligible set is a tiny
--     fraction of Company: never-enriched, domain-less, SCORED rows only.
--     "intentScore IS NOT NULL" is structural, not policy: a NULL score can
--     never satisfy >= T for ANY T, and today the vast majority of rows are
--     unscored — excluding them keeps the index near-empty.
--   - Ordered ("intentScore" DESC) so the hottest-first sweep reads the index
--     in order (no sort).
--   - Deliberately NOT in the predicate: `intentScore >= T` (T is
--     runtime-configurable — a literal would pin it) and
--     `enrichmentAttempts < 3` (give-up policy may move; also the counter
--     mutates — keeping it out avoids index churn on every attempt). Both are
--     runtime filters over the already-narrow indexed set.
--   - Prisma PSL cannot express partial indexes → this DDL lives HERE only;
--     schema.prisma carries a comment pointing at it.

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "enrichmentAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "enrichmentAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex (partial — hand-written, see header)
CREATE INDEX "Company_enrichment_sweep_idx" ON "Company"("intentScore" DESC)
WHERE "enrichedAt" IS NULL AND "domain" IS NULL AND "intentScore" IS NOT NULL;
