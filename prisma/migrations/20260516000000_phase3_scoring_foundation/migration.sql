-- Phase 3 Scoring Engine — Sprint 3a Foundation
--
-- Refs:
--   - PRD-004 §2.1 (reference/PRD_004_PHASE3_SCORING.md)
--   - Recon Sprint 3a Decisions D1-D10 (recon report 2026-05-15)
--   - Andy "Oxen OS Priority Scoring Engine v2" reference doc (May 2026)
--
-- Scope (Phase A — B1+B2+B4+B5, B3 deferred pending Andy mapping):
--
--   1. Extend CrmContact with combined scoring fields (intentScore,
--      priorityScore, priorityLevel, painTierOverride, excludedFrom,
--      excludedReason, signalCount). Widen existing icpScore Int → Float
--      to allow sub-integer arithmetic in the engine. Rename
--      icpScoredAt → lastScoredAt to reflect the broader semantics
--      (the timestamp now covers full ICP+Intent+Priority recompute,
--      not just the ICP sub-score).
--
--   2. Extend IntentSignal with intentCategory (A-I per Andy doc) +
--      signalLevel ("contact" | "account"). Named intentCategory (not
--      `category`) to avoid colliding with the existing
--      SignalTypeRegistry.category enum (INTENT|MARKET scope —
--      orthogonal semantics).
--
--   3. Extend SignalTypeRegistry with the same intentCategory +
--      signalLevel pair, plus triggerType ("immediate"|"rapid"|
--      "passive") consumed by the BD-alert policy.
--
--   4. Create ScoringConfig (versioned JSONB config storage, exactly
--      one isActive=true at a time).
--
--   5. Create ScoreHistory (audit snapshot per scoring run, per
--      account; polymorphic accountId with no Prisma @relation —
--      app-level discriminator per Decision D8).
--
--   6. Add 3 indexes for the scoring engine query patterns:
--        - IntentSignal(contactId, intentCategory, createdAt)
--        - IntentSignal(companyId, intentCategory, createdAt)
--        - CrmContact(priorityLevel, priorityScore)
--
-- Data safety:
--   - icpScore widening Int → Float: 597 existing rows are all 0
--     (check-counts.ts confirmed 2026-05-15) → cast is lossless.
--   - icpScoredAt → lastScoredAt: 0 non-null values; using RENAME
--     COLUMN (not DROP+ADD as Prisma's auto-diff would) so the
--     migration is self-documenting AND preserves any future legacy
--     values across environments.
--   - All new columns are nullable or NOT NULL with explicit DEFAULT,
--     so the implicit backfill for 597 contacts is instant.
--
-- Reversibility:
--   - ALTER COLUMN icpScore DOUBLE PRECISION → INTEGER would round, but
--     since current values are 0, it's reversible without loss.
--   - RENAME COLUMN is trivially reversible (rename back).
--   - DROP TABLE + DROP COLUMN reversibility = re-apply schema only.

-- ─── CrmContact: rename icpScoredAt → lastScoredAt ──────────────────
ALTER TABLE "CrmContact" RENAME COLUMN "icpScoredAt" TO "lastScoredAt";

-- ─── CrmContact: widen icpScore Int → Float + new scoring fields ────
ALTER TABLE "CrmContact"
  ALTER COLUMN "icpScore" SET DATA TYPE DOUBLE PRECISION,
  ALTER COLUMN "icpScore" SET DEFAULT 0,
  ADD COLUMN "intentScore" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "priorityScore" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "priorityLevel" TEXT DEFAULT 'Monitor',
  ADD COLUMN "painTierOverride" TEXT,
  ADD COLUMN "excludedFrom" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "excludedReason" TEXT,
  ADD COLUMN "signalCount" INTEGER NOT NULL DEFAULT 0;

-- ─── IntentSignal: intentCategory + signalLevel ─────────────────────
ALTER TABLE "IntentSignal"
  ADD COLUMN "intentCategory" TEXT,
  ADD COLUMN "signalLevel" TEXT DEFAULT 'contact';

-- ─── SignalTypeRegistry: intentCategory + signalLevel + triggerType ─
ALTER TABLE "SignalTypeRegistry"
  ADD COLUMN "intentCategory" TEXT,
  ADD COLUMN "signalLevel" TEXT NOT NULL DEFAULT 'contact',
  ADD COLUMN "triggerType" TEXT;

-- ─── New table: ScoringConfig ───────────────────────────────────────
CREATE TABLE "ScoringConfig" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScoringConfig_version_key" ON "ScoringConfig"("version");
CREATE INDEX "ScoringConfig_isActive_idx" ON "ScoringConfig"("isActive");

-- ─── New table: ScoreHistory ────────────────────────────────────────
CREATE TABLE "ScoreHistory" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "icpScore" DOUBLE PRECISION NOT NULL,
    "intentScore" DOUBLE PRECISION NOT NULL,
    "priorityScore" DOUBLE PRECISION NOT NULL,
    "priorityLevel" TEXT NOT NULL,
    "signalCount" INTEGER NOT NULL,
    "painTier" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScoreHistory_accountId_computedAt_idx" ON "ScoreHistory"("accountId", "computedAt");
CREATE INDEX "ScoreHistory_priorityLevel_idx" ON "ScoreHistory"("priorityLevel");
CREATE INDEX "ScoreHistory_configVersion_idx" ON "ScoreHistory"("configVersion");

-- ─── Phase 3 query-optimization indexes ─────────────────────────────
CREATE INDEX "CrmContact_priorityLevel_priorityScore_idx" ON "CrmContact"("priorityLevel", "priorityScore");
CREATE INDEX "IntentSignal_contactId_intentCategory_createdAt_idx" ON "IntentSignal"("contactId", "intentCategory", "createdAt");
CREATE INDEX "IntentSignal_companyId_intentCategory_createdAt_idx" ON "IntentSignal"("companyId", "intentCategory", "createdAt");
