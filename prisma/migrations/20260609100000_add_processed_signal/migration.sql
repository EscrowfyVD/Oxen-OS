-- Apify PR3a — add the ProcessedSignal dedup / audit ledger.
--
-- Purely ADDITIVE: a new empty table + a UNIQUE index on sourceUrl (the dedup
-- key) + a processedAt index. 0-ROW-SAFE: no existing table touched, no rewrite,
-- no lock. The Apify pipeline (PR3b wiring) inserts one row per unique scraped
-- item URL and skips items already present. This is NOT a signal store —
-- enriched signals go to IntentSignal via ingestSignal (PR3b).

-- CreateTable
CREATE TABLE "ProcessedSignal" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceActor" TEXT,
    "signalCategory" TEXT,
    "accountId" TEXT,
    "rawPayload" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedSignal_sourceUrl_key" ON "ProcessedSignal"("sourceUrl");

-- CreateIndex
CREATE INDEX "ProcessedSignal_processedAt_idx" ON "ProcessedSignal"("processedAt");
