# Prisma Migrations Workflow

Guide for creating and shipping database schema changes on Oxen OS.

## TL;DR

- **Never** modify `prisma/schema.prisma` and push directly — Railway will fail.
- **Always** create a versioned migration locally, commit it, then push.
- Railway auto-applies pending migrations at build time via `prisma migrate deploy`.
- Historical migrations live in `prisma/migrations/` and are reviewable in PRs.

---

## Creating a new migration

### 1. Modify `prisma/schema.prisma`

Add, modify, or remove models, fields, enums, indexes — as usual.

### 2. Generate the migration locally

```bash
npx prisma migrate dev --name short_descriptive_name
```

Examples:
- `add_deal_priority_field`
- `drop_legacy_customer_table`
- `convert_amount_to_decimal`
- `add_index_on_email_lookup`

Prisma will:
1. Create a folder `prisma/migrations/<timestamp>_<name>/migration.sql`
2. Apply it to your local dev database
3. Regenerate `@prisma/client` TypeScript types

If Prisma needs to reset your local dev DB (e.g. breaking change), it will prompt you. Answer **yes** — only touches your local DB, never prod.

### 3. Review the generated SQL

**Critical step.** Open the `migration.sql` file and read it carefully. Confirm the SQL matches your intent. Look for:

- Unexpected `DROP COLUMN` / `DROP TABLE` — Prisma generates these when you remove a field without backfill logic.
- Data-loss operations that need a 3-step migration pattern instead (see below).
- Missing indexes that should be added alongside the change.

### 4. Commit

```bash
git add prisma/migrations/ prisma/schema.prisma
git diff --cached
git commit -m "chore(db): <description>"
git push origin main
```

### 5. Railway deploys

On push to `main`, Railway runs the build command:

```
npx prisma generate && npx prisma migrate deploy && npm run build
```

`migrate deploy`:
- Reads `prisma/migrations/` from the repo.
- Checks the `_prisma_migrations` table in the DB for what's already applied.
- Runs only the pending ones, in order.

**On success**: Railway proceeds to `npm run build` and deploys the new version.
**On failure**: Railway build fails, the old version keeps running. No downtime. Fix locally, re-push.

---

## Migration patterns by risk

### Low-risk — non-destructive

- Adding a nullable field
- Adding a new model
- Adding an index
- Adding an enum value

Single migration. Safe to ship directly.

### Medium-risk — requires data consideration

- Adding a non-nullable field to an existing table → needs a default value or a backfill step.
- Renaming a field → Prisma treats this as `DROP` + `CREATE`, losing data. Use a 2-step migration or the `@map()` directive.
- Changing a field type (e.g. `Int` → `BigInt`) → may be lossy depending on existing values.

### High-risk — use multi-step migration

For sensitive changes (e.g. Sprint 3.2 `Float` → `Decimal` for monetary fields):

**Step 1** — Add new column (non-destructive):
```prisma
model FinanceEntry {
  amount       Float
  amountDecimal Decimal?  @db.Decimal(20, 6) // new
}
```
Migration A: `ADD COLUMN amountDecimal`

**Step 2** — Backfill in application code or via a one-shot script:
```ts
// scripts/backfill-amount-decimal.ts
for (const entry of await prisma.financeEntry.findMany()) {
  await prisma.financeEntry.update({
    where: { id: entry.id },
    data: { amountDecimal: new Decimal(entry.amount) },
  })
}
```

**Step 3** — Swap: make the new column the source of truth, drop the old one. Can span 2 migrations:
- Migration B: rename `amount` → `amountLegacy`, rename `amountDecimal` → `amount`
- Migration C (later, after validation): `DROP COLUMN amountLegacy`

This approach makes each migration reversible via a DB backup restore, and zero-downtime.

---

## Rollback

Prisma does **not** auto-generate down migrations. To roll back:

1. **Restore the Railway DB backup** taken before the problematic deploy (Railway dashboard → service postgres → Backups).
2. **Revert the Git commit** of the migration:
   ```bash
   git revert <sha-of-migration-commit>
   git push origin main
   ```
3. Railway will redeploy without the reverted migration; the DB is already at the correct state (pre-migration via restore).
4. Create a new "fix" migration locally that corrects the schema going forward.

For **minor rollbacks** (no data-loss concern), you can also write a manual reverting migration:
```bash
npx prisma migrate dev --name revert_xxxx_yyyy
```
and handcraft the SQL to undo the previous one.

---

## Operational rules — never break

- ❌ **Never** run `prisma db push` or `prisma db push --accept-data-loss` against the prod database (legacy practice before Sprint 3.1).
- ❌ **Never** edit a migration file that has already been committed. It's part of the applied history. Create a new migration to correct it.
- ❌ **Never** delete a migration file that has already been applied in prod. `_prisma_migrations` table tracks it by name; deletion causes drift.
- ❌ **Never** reorder migrations. They run in lexicographic filename order.
- ❌ **Never** push a migration without reviewing the generated SQL.

---

## Special cases

### Adding a new model that references an existing one

Straightforward `migrate dev` flow. The generated SQL will include the `CREATE TABLE` + the FK `ADD CONSTRAINT`.

### Adding an index to a hot query path

Prisma-generated indexes:
```prisma
model CrmContact {
  email String
  @@index([email])
}
```
→ migration SQL: `CREATE INDEX "CrmContact_email_idx" ON "CrmContact"("email");`

Safe to apply on live tables (PostgreSQL creates indexes with minimal locking in modern versions, but test on a similar-sized dev DB first for very large tables).

### Changing a Prisma relation

Prisma relation changes can produce complex SQL (DROP/ADD constraints, shuffle FK columns). **Always read the generated SQL** before committing. If it looks risky, handcraft the migration manually:

```bash
npx prisma migrate dev --create-only --name safer_relation_change
# Then edit prisma/migrations/<timestamp>_safer_relation_change/migration.sql
# Then apply manually:
npx prisma migrate dev
```

---

## Where the baseline comes from

Sprint 3.1 created `prisma/migrations/0_baseline/migration.sql` to represent the state of the prod DB at the moment of adoption of `migrate deploy`. That migration was **marked as applied** via `prisma migrate resolve --applied 0_baseline` without executing the SQL — the tables already existed.

Future migrations will be added alongside it in `prisma/migrations/`. `migrate deploy` will only run the new ones.

**Do not modify or delete `0_baseline/`**. It's the reference point for everything that follows.
