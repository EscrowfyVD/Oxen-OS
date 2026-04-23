# Sprint 3.1 — Rapport d'exécution

**Date** : 2026-04-23
**Portée** : Migration pipeline Prisma `db push --accept-data-loss` → `migrate deploy`

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `prisma/migrations/0_baseline/migration.sql` | Baseline — 1685 lignes SQL (`CREATE TABLE` × 70, `ALTER TABLE ADD CONSTRAINT` × 55, `CREATE INDEX` × 40) |
| `prisma/migrations/migration_lock.toml` | Marker Prisma (`provider = "postgresql"`) |
| `MIGRATIONS.md` | Guide complet workflow (creation, review, rollback, multi-step patterns) |
| `SPRINT_3_1_REPORT.md` | Ce rapport |

## Fichiers modifiés

| Fichier | Delta |
|---|---|
| `nixpacks.toml` | 1 ligne : `db push --accept-data-loss` → `migrate deploy` |
| `railway.json` | 1 ligne : `db push --accept-data-loss` → `migrate deploy` |
| `ARCHITECTURE.md` | +4 lignes dans section "Migrations" (ref vers `MIGRATIONS.md`) |

## Fichiers **non-modifiés** (vérifiés)

- `prisma/schema.prisma` — **byte-identique** (baseline = photographie de l'existant, zéro changement fonctionnel)
- `src/lib/prisma.ts` — inchangé (extension `$extends` Sprint 1.3 + slow query hook Sprint 2.4a intacts)
- `workers/sync-worker/src/lib/prisma.ts` — inchangé (copie synchronisée)
- `next.config.ts` — inchangé
- Aucune route, aucun helper, aucun worker applicatif modifié

## Phase 0 — Cas B double confirmé

2 fichiers contenaient le build command à modifier :
- `nixpacks.toml` (config Nixpacks)
- `railway.json` (`buildCommand`, prioritaire pour Railway)

Les 2 modifiés pour éviter toute ambiguïté future.

## Actions DB effectuées

**Étape 2** (Vernon, via shell local avec `DATABASE_URL` du `.env`) :
```bash
npx prisma migrate resolve --applied 0_baseline
# → "Migration 0_baseline marked as applied"

npx prisma migrate status
# → "Database schema is up to date!"
```

**État prod post-Étape 2** :
- `_prisma_migrations` table créée (bootstrap implicite par `migrate resolve`)
- 1 entrée : `0_baseline`, `finished_at` = timestamp Étape 2
- Aucune modification sur les 70 tables applicatives

## Validation

| Check | Résultat |
|---|---|
| `prisma migrate status` (pré-push) | ✅ "Database schema is up to date!" |
| `ls prisma/migrations/` | ✅ `0_baseline/` + `migration_lock.toml` |
| `grep "db push" nixpacks.toml railway.json` | ✅ 0 match |
| `grep "accept-data-loss" nixpacks.toml railway.json` | ✅ 0 match |
| Typo check (`migrate-deploy` / `migrateDeploy`) | ✅ 0 match |
| `npx vitest run` | ✅ 49/49 |
| `npx tsc --noEmit` (monolith) | ✅ EXIT 0 |
| `cd workers/sync-worker && npx tsc --noEmit` | ✅ EXIT 0 |
| `npm run build` | ✅ EXIT 0 |
| Non-régression Sprints 0 → 2.4b | ✅ enc:v1, HSTS, seed hors proxy, webhook-auth, Zod, pino, Sentry tous intacts |

## Décisions notables

### Cas B double (nixpacks.toml + railway.json)

Railway priorise `railway.json.buildCommand` sur `nixpacks.toml`. Modifier les 2 évite un comportement ambigu si un jour Railway change cette priorité ou si un dev local utilise `nixpacks` directement (`nixpacks build`).

### `DATABASE_URL` accessible via `.env` local

Le fichier `.env` (gitignored via `.env*` + `!.env.example` Sprint 2.2) contient `DATABASE_URL` pointant vers la DB prod Railway. Cela a permis d'exécuter `prisma migrate resolve --applied` depuis le shell local sans nécessiter Railway CLI. **Dette technique mineure** : le fait que `.env` contienne la DB prod est pratique mais fragile — pour un vrai workflow dev/staging/prod à l'avenir, créer une DB dev distincte sera plus propre.

### Baseline = photographie

Le baseline SQL représente **exactement** l'état de schema.prisma (et donc de la prod, vérifié au diff Phase 0.4 — 1366 lignes cosmétiques, 0 divergence fonctionnelle). Aucun changement applicatif dans ce sprint. Sprint 3.2 (Float → Decimal) sera la première "vraie" migration via le nouveau workflow.

### Pas de staging env

Tests faits directement contre prod (backup DB pris avant Étape 1 par Vernon via Railway dashboard). Protocole :
1. Backup prod
2. Générer baseline localement (aucun impact DB)
3. `migrate resolve --applied` (bootstrap `_prisma_migrations`, zéro SQL applicatif)
4. Bascule build command
5. Premier deploy Railway = test de bout en bout

Acceptable pour cette phase ; staging env à considérer pour Sprint 3.2+ si migrations plus risquées.

## 🚀 Premier test post-push (à valider par Vernon)

Après `git push`, Railway trigger un build qui exécute :
```
npx prisma generate && npx prisma migrate deploy && npm run build
```

**Log attendu** dans Railway dashboard → Deployments → logs :
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "railway", ...

1 migration found in prisma/migrations

No pending migrations to apply.
```

**"No pending migrations to apply"** = la bascule fonctionne : `migrate deploy` voit le `0_baseline` déjà appliqué dans `_prisma_migrations` (via `resolve --applied` Étape 2) et ne tente aucun SQL.

**Si erreur** (`P3005: The database schema is not empty` etc.) : le build échoue proprement, l'ancienne version continue à tourner (Railway ne coupe pas l'ancienne tant que le nouveau build n'est pas sain). Pas de downtime. Investigation possible sans urgence.

## Rollback possible

À tout moment post-push, si un problème apparaît :
```bash
git revert <commit-sha-sprint-3.1>
git push origin main
# → Railway redéploie avec l'ancien build command `db push`
# → La table _prisma_migrations reste en DB, inoffensive
#   (optionnel) DROP TABLE _prisma_migrations; pour nettoyage complet
```

## Prochaine étape

**Sprint 3.2 — Float → Decimal sur 28 montants monétaires** : premier vrai usage du nouveau workflow de migrations. Pattern multi-step documenté dans `MIGRATIONS.md` (add new column + backfill + swap + drop). Prérequis 3.1 maintenant en place.

## Ce sprint ne fait PAS

- ❌ Modification du schema.prisma — le baseline doit être une photographie exacte
- ❌ Application manuelle du SQL baseline sur la prod (on a utilisé `migrate resolve`, pas `psql`)
- ❌ Migration de données (Float → Decimal etc.) — Sprint 3.2
- ❌ Modification de l'application (routes, workers, helpers)
- ❌ Staging environment setup — out of scope
- ❌ Source maps, alerting Railway, etc. — out of scope
- ❌ Commit automatique
