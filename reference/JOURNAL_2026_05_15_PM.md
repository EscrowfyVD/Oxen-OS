cat > reference/JOURNAL_2026_05_15_PM.md << 'EOF'
# Journal — 2026-05-15 (PM session)

## DB cleanup post-Andy "obsolete contacts"

Andy a confirmé que les 597 CrmContacts importés Clay sont obsolètes pré-Cycle 1.

**Action prise** : soft-exclude (Option C) au lieu de TRUNCATE.

```sql
UPDATE "CrmContact"
SET 
  "excludedFrom" = ARRAY['outreach', 'scoring'],
  "excludedReason" = 'Marked obsolete by Andy 2026-05-15 — pre-Cycle 1 cleanup'
WHERE id NOT IN (
  SELECT id FROM "CrmContact" ORDER BY RANDOM() LIMIT 10
);
```

**Résultat** :
- 587 contacts marked excluded
- 10 contacts kept for Phase 3 dev testing
- Sample 10 testing : 100% DM, 100% G1, 100% T1, 10 different companies, UAE/Cyprus/Malta mix

**Rationale Option C vs TRUNCATE** :
- Data préservée (réversible)
- Sprint 3b/3c need ICP data réelle pour tests
- Scoring engine (Sprint 3c) respectera excludedFrom (PRD-004 §6)
- Intent Feed filterera out via excludedFrom

**Reverse cleanup si besoin** :
```sql
UPDATE "CrmContact"
SET "excludedFrom" = '{}', "excludedReason" = NULL
WHERE 'outreach' = ANY("excludedFrom")
  AND "excludedReason" LIKE '%Andy 2026-05-15%';
```

## Status Sprint 3a Phase A
- ✅ Schema deployed (migration 20260516000000)
- ✅ ScoringConfig v1 seeded + active
- ✅ Hotfix R0 acquisitionSource backfilled
- ⏸️ B3 backfill categories (await Andy mapping Slack)

## Tests/Build state
- Tests: 376/376 passing
- TypeScript: 0 errors
- Build: exit 0

## Next steps (pending)
- B3 : awaiting Andy mapping Cat A-I
- Sprint 3b : compute engine + seed test signals
- Sprint 3c : priority levels + pain tier inference
