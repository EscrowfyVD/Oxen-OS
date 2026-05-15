-- Backfill CrmContact.acquisitionSource for Clay legacy contacts.
--
-- Refs:
--   - Recon Phase 3 Sprint 3a Finding R0 (audit 2026-05-15)
--   - PRD-004 Decision D5
--   - Hotfix commit: fix(clay-enrichment): set acquisitionSource on upsert
--
-- Context:
--   Pre-fix, upsertPersonFromClay() in src/lib/clay-enrichment.ts never
--   wrote acquisitionSource on CREATE since Sprint S0.5 + S1. 597 rows
--   in CrmContact are now NULL on this column. PRD-004 ICP scoring
--   (intermediaryType factor) needs the field set to compute correctly.
--
-- Scope clarification (post-recon correction):
--   The recon report initially flagged "597 CrmContacts + 1586 Companies"
--   but Company has NO acquisitionSource column — Company tracks origin
--   via enrichmentSource (enum, already set to 'clay' by the helpers).
--   So this backfill is CrmContact-only.
--
-- Idempotency:
--   The WHERE clause restricts to NULL rows + excludes Trigify
--   auto-created contacts (those have acquisitionSourceDetail='Trigify'
--   per src/lib/trigify-matching.ts:254-255). Re-running this script
--   after the first successful COMMIT is a safe no-op (0 rows match).
--
-- Execution:
--   railway connect Postgres
--   \i scripts/db/backfill-acquisition-source-clay.sql
--   -- review the verify SELECT output
--   -- if contacts_still_null = 0 → COMMIT;
--   -- otherwise → ROLLBACK; and investigate

BEGIN;

-- Backfill CrmContacts (~597 expected, all legacy Clay imports).
UPDATE "CrmContact"
SET "acquisitionSource" = 'Clay / Outbound Sequence'
WHERE "acquisitionSource" IS NULL
  -- Exclude Trigify auto-created contacts (already labeled 'Other' /
  -- 'Trigify' by the webhook). Defensive — the writer should already
  -- have set acquisitionSource for these, but the predicate keeps the
  -- script safe if a legacy null slipped through that path too.
  AND (
    "acquisitionSourceDetail" IS NULL
    OR "acquisitionSourceDetail" != 'Trigify'
  );

-- Verify counts.
SELECT
  (SELECT COUNT(*) FROM "CrmContact"
    WHERE "acquisitionSource" IS NULL) AS contacts_still_null,
  (SELECT COUNT(*) FROM "CrmContact"
    WHERE "acquisitionSource" = 'Clay / Outbound Sequence') AS contacts_clay_labeled,
  (SELECT COUNT(*) FROM "CrmContact") AS contacts_total;

-- Manual COMMIT after verifying contacts_still_null = 0 (or matches
-- known Trigify auto-created rows that intentionally have a different
-- provenance). Do NOT auto-commit — keep this guarded.
-- COMMIT;
