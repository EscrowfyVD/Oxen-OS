-- AIRA F2 PR3a — add Meeting.briefRefreshedAt (1h-before brief refresh marker).
--
-- Purely ADDITIVE: one nullable timestamp column on the existing Meeting table.
-- 0-ROW-SAFE: nullable, NO default, NO backfill, no rewrite/lock of existing
-- rows. The PR3b refresh cron uses it to refresh each meeting EXACTLY ONCE
-- ~1h before start: query WHERE briefRefreshedAt IS NULL (+ startTime window),
-- then set briefRefreshedAt = now() after regenerating the brief.

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "briefRefreshedAt" TIMESTAMP(3);
