-- Sprint Trigify Phase 2A — schema support for Trigify webhook rewrite.
--
-- Two intended schema concerns covered by this migration:
--
--   1. Index on CrmContact.linkedinUrl — Trigify "Get Post Likes LinkedIn"
--      action does not return liker emails, so the webhook matches likers
--      by LinkedIn URL first. Index supports a `findFirst({ linkedinUrl:
--      insensitive })` lookup on every signal ingest.
--
--   2. New lifecycleStage value "intent_sourced" for contacts auto-created
--      by the Trigify webhook. Intentionally NO DDL here — CrmContact.
--      lifecycleStage is `String? @default("new_lead")` (free-form text,
--      not a Prisma enum), so adding a new accepted value is purely an
--      application-level convention and requires no migration. Listed in
--      the migration name for changelog discoverability only.

-- CreateIndex
CREATE INDEX "CrmContact_linkedinUrl_idx" ON "CrmContact"("linkedinUrl");
