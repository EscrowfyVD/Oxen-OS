-- closeout #4 — drop unused CrmGroup enum values G7A and G7B (→ G1..G6).
--
-- 0-ROW-SAFE: verified read-only in prod that no "Company".group or
-- "CrmContact".group row carries 'G7A'/'G7B' (every row is 'G1'), so the
-- ::text::"CrmGroup_new" casts below cannot fail. PostgreSQL has no
-- `ALTER TYPE ... DROP VALUE`, hence the standard type-recreation dance.
-- Both columns are nullable with NO default → no DROP/SET DEFAULT needed
-- (NULLs cast through unchanged). The values were already removed from the
-- v2 scoring tier-1 whitelist (seed-scoring-config.ts); this retires the
-- enum values themselves. The frozen v1 ScoringConfig JSONB blob still
-- references them as historical data — unaffected by an enum type change.
--
-- AlterEnum
BEGIN;
CREATE TYPE "CrmGroup_new" AS ENUM ('G1', 'G2', 'G3', 'G4', 'G5', 'G6');
ALTER TABLE "Company" ALTER COLUMN "group" TYPE "CrmGroup_new" USING ("group"::text::"CrmGroup_new");
ALTER TABLE "CrmContact" ALTER COLUMN "group" TYPE "CrmGroup_new" USING ("group"::text::"CrmGroup_new");
ALTER TYPE "CrmGroup" RENAME TO "CrmGroup_old";
ALTER TYPE "CrmGroup_new" RENAME TO "CrmGroup";
DROP TYPE "CrmGroup_old";
COMMIT;
