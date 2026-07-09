-- Apify PR3c-b-migration — company-level intent score columns.
--
-- Purely ADDITIVE: two nullable columns on "Company", no default, no backfill.
-- 0-ROW-SAFE: nullable ADD COLUMN takes no table rewrite and no long lock;
-- every existing row reads NULL (= "never scored", distinct from 0.0 —
-- mirrors how CrmContact treats unscored contacts).
--
--   intentScore  — decay-adjusted sum of the company's ACCOUNT-LEVEL signals
--                  only ({companyId, contactId: null} — the PR2.5 reflection
--                  set). Written by the PR3c-b-score recompute (not yet built
--                  at migration time; deploy-ahead on purpose).
--   lastScoredAt — when the company score was last written.
--
-- ⚠️ Deliberately NO index in this migration: the enrichment-trigger sweep
-- (intentScore >= T AND "enrichedAt" IS NULL AND "domain" IS NULL) ships its
-- partial index WITH its consumer in PR3c-b-enrich.

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "intentScore" DOUBLE PRECISION,
ADD COLUMN     "lastScoredAt" TIMESTAMP(3);
