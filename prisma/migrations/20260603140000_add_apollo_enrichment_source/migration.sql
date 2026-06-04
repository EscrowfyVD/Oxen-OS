-- Apollo PR-W (1/2) — add the `apollo` value to the EnrichmentSource enum.
--
-- ISOLATED in its own migration on purpose: Postgres `ALTER TYPE … ADD VALUE`
-- is emitted standalone and (pre-PG12) cannot share a transaction block with
-- other DDL — keeping it alone is bulletproof across PG versions. ADDITIVE only:
-- `clay` is KEPT (historical rows reference it); we only add `apollo`.

-- AlterEnum
ALTER TYPE "EnrichmentSource" ADD VALUE 'apollo';
