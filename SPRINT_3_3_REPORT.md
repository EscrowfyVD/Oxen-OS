# Sprint 3.3 — Rapport d'exécution

**Date** : 2026-04-23
**Portée** : Ajout de **39 indexes B-tree** sur 16 modèles cœur (Deal, CrmContact, Activity, Finance, etc.) pour préparer la montée en charge. Indexes additifs uniquement — zéro modification de données, zéro breaking change.

## Contexte

Sprint 2.4a a introduit le slow-query logging (pino, threshold 500ms). Après plusieurs semaines d'opération : **zéro slow query** loggée (`railway logs | grep "slow query"` → 0 résultat). Sprint 3.3 est donc **préventif** :

- Indexes plus faciles à ajouter maintenant (tables < 100 rows) qu'à l'échelle future (100k+ rows, où `CREATE INDEX` verrouille la table)
- Prérequis implicite pour Sprints 3.4/5 (pagination, N+1)
- Chaque index est justifié par une query observée dans le code (pas d'index "au cas où")

## Indexes ajoutés (39 total)

### Deal — 8 indexes (priorité 1, 64 queries observées)

| Index | Justification |
|---|---|
| `[contactId]` | FK lookup : ROI route (`conferences/[id]/roi`), followups, stage transitions |
| `[companyId]` | FK lookup : company aggregations on `closed_won` dans `deals/[id]/stage` |
| `[stage]` | Pipeline Kanban — filter le plus fréquent (`stage = X`, `in`, `notIn`) |
| `[dealOwner]` | Dashboard filter "my deals" |
| `[stage, dealOwner]` | Composite : pipeline par owner (telegram webhook, dashboard) + leftmost prefix sur `[stage]` |
| `[closedAt]` | Weekly/monthly won-lost stats (telegram weekly-digest) |
| `[expectedCloseDate]` | Forecast route : `expectedCloseDate BETWEEN X AND Y` |
| `[aiDealHealth]` | At-risk dashboard (crm/overview, crm/dashboard) |

### CrmContact — 2 indexes (priorité 2, 50 queries)

| Index | Justification |
|---|---|
| `[companyId]` | FK : company detail pages + per-company aggregations |
| `[lifecycleStage]` | Dashboard filter `lifecycleStage = "customer"` (crm/overview, crm/health) |

### Activity — 4 indexes

| Index | Justification |
|---|---|
| `[contactId]` | FK : contact timeline (findMany + count, ubiquitaire) |
| `[dealId]` | FK : deal timeline + followups lookup |
| `[createdAt]` | `orderBy createdAt desc` sur TOUTES les queries Activity |
| `[type, createdAt]` | Composite : type filter (meetings, emails) + chronological (dashboard counters) |

### CrmTask — 4 indexes

| Index | Justification |
|---|---|
| `[contactId]` | FK : contact tasks listing |
| `[dealId]` | FK : deal tasks listing |
| `[status]` | Dashboard pending/completed filter |
| `[dueDate]` | Range queries : today/upcoming/overdue tasks |

### FinanceTransaction — 3 indexes

| Index | Justification |
|---|---|
| `[date]` | Range queries (overview, reports, summary) |
| `[type]` | revenue/expense split |
| `[entity]` | Multi-entity filter (oxen / escrowfy / galaktika / lapki) |

### FinanceEntry — 3 indexes

| Index | Justification |
|---|---|
| `[date]` | Range queries |
| `[type]` | revenue/expense/budget filter |
| `[entity]` | Multi-entity filter |

### Email — 2 indexes

| Index | Justification |
|---|---|
| `[contactId]` | FK : contact email timeline (orderBy date desc) |
| `[direction, date]` | Composite : outbound/inbound stats par période (weekly-digest) |

### AIInsight — 2 indexes

| Index | Justification |
|---|---|
| `[dismissed]` | Filter ubiquitaire `dismissed: false` (tous les routes ai/*) |
| `[contactId]` | FK : contact detail page insights |

### AIFollowUp — 2 indexes

| Index | Justification |
|---|---|
| `[contactId]` | FK : contact detail + dashboard pending followups |
| `[dealId]` | FK : deal followups (souvent composé avec `status = "pending"`) |

### ComplianceIncident — 2 indexes

| Index | Justification |
|---|---|
| `[status]` | Dashboard filter (open/investigating/reported/resolved) |
| `[type]` | Filter par type d'incident (sar/breach/complaint) |

### Autres models (8 indexes restants)

| Model | Index | Justification |
|---|---|---|
| `Session` | `[expires]` | NextAuth session cleanup `DELETE WHERE expires < NOW()` |
| `Task` | `[column]` | Kanban filter (`column: { not: "done" }` ubiquitaire) |
| `CalendarEvent` | `[startTime]` | Range queries (dashboards, digest, upcoming) — ubiquitaire |
| `BankAccount` | `[entity, isActive]` | Composite : liste comptes actifs par entité |
| `AuditLog` | `[entityType, entityId]` | Composite : history lookup par entité |
| `PlaybookStep` | `[dealId]` | FK : playbook init + step listing |
| `ConferenceAttendee` | `[conferenceId]` | FK : attendees d'une conférence (ROI route) |

### Récap par model

| Model | Indexes ajoutés | Queries observées |
|---|---|---|
| Deal | 8 | 64 |
| Activity | 4 | 7 |
| CrmTask | 4 | 7 |
| CrmContact | 2 | 50 |
| FinanceTransaction | 3 | 15 |
| FinanceEntry | 3 | 13 |
| AIInsight | 2 | 6 |
| AIFollowUp | 2 | — |
| Email | 2 | 5 |
| ComplianceIncident | 2 | 5 |
| CalendarEvent | 1 | 16 |
| Task (HR) | 1 | 12 |
| BankAccount | 1 | 4 |
| AuditLog | 1 | 2 |
| PlaybookStep | 1 | — |
| ConferenceAttendee | 1 | — |
| Session | 1 | — |
| **Total** | **39** | **149+** |

## Indexes volontairement NON proposés

Pour transparence et protection contre les "pourquoi vous n'avez pas indexé X ?" futurs :

| Field | Raison |
|---|---|
| `CrmContact.firstName / lastName` | Filtrés en `contains, mode: insensitive` → ILIKE, B-tree index inefficace (GIN nécessaire, hors scope) |
| `CrmContact.createdAt` | Pas de `where`, seulement `orderBy` occasionnel — bénéfice marginal |
| `Task.assignee` | Filtré en `contains, mode: insensitive` (fuzzy email match) — pas indexable B-tree |
| `Deal.stageChangedAt` | Peu d'occurrences distinctes, partiellement couvert par `[stage]` |
| `FinanceTransaction.contactId` | Relation ContactFinance rare, peu filtrée seule |
| `FinanceTransaction.status / paymentSource` | Peu d'occurrences comme filtre principal, sélectivité faible |
| `ComplianceIncident.entityId` (FK) | Pas observé comme filtre seul (toujours include, rarement where) |
| `Company.*` | Tous filtres via `contains` ILIKE ou via `domain` déjà `@unique` |
| `ConferenceAttendee.employeeId` (FK) | Pas observé comme filtre principal |
| Partial indexes (`WHERE dismissed = false`) | Hors scope (overengineering à l'échelle Oxen) |
| GIN indexes (full-text search, array `contains`) | Hors scope (spec prompt) |

## Coût write estimé

Chaque `INSERT` / `UPDATE` / `DELETE` sur une table avec N indexes coûte ~N × 50-200μs supplémentaires.

| Échelle | Writes / jour | Overhead par write | Impact total |
|---|---|---|---|
| Actuelle (<1000 rows / table) | ~10-100 | ~0.5ms (7 idx Deal × ~80μs) | **< 1% CPU** |
| Future (100k rows / table) | ~1000-10000 | ~1-2ms | **~1-2% CPU, acceptable** |

**Les reads gagnent 10-1000× sur les queries filtrées** — trade-off largement favorable.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `prisma/migrations/20260423100331_add_performance_indexes/migration.sql` | 117 lignes, 39 `CREATE INDEX` |
| `SPRINT_3_3_REPORT.md` | Ce rapport |

## Fichiers modifiés

| Fichier | Delta |
|---|---|
| `prisma/schema.prisma` | +102 lignes (39 `@@index` + commentaires explicatifs, zéro ligne supprimée) |

## Fichiers **non-modifiés** (vérifiés)

- `src/lib/*` — aucun fichier touché (indexes sont purement DB-side)
- Aucune API route modifiée
- Aucune page frontend modifiée
- `nixpacks.toml`, `railway.json`, `next.config.ts`, `src/proxy.ts` — inchangés
- Workers (ai-worker, sync-worker) — inchangés

## Validation

| Check | Résultat |
|---|---|
| `npx prisma validate` | ✅ "schema is valid 🚀" |
| `npx prisma generate` | ✅ OK |
| `npx tsc --noEmit` (monolith) | ✅ EXIT 0 |
| `npx tsc --noEmit` (sync-worker) | ✅ EXIT 0 |
| `npx vitest run` | ✅ **83/83 exactement** (zéro impact comportemental attendu) |
| `npm run build` | ✅ OK |
| 39 `CREATE INDEX` dans SQL | ✅ |
| 0 `DROP` / `ALTER TABLE` / `DELETE` / `TRUNCATE` | ✅ |

### Non-régression Sprints 0 → 3.2

| Sprint | Check | Résultat |
|---|---|---|
| 1.3 | `grep "enc:v1" src/lib/token-encryption.ts` | ✅ 4 matches |
| 3.1 | `grep "migrate deploy" nixpacks.toml railway.json` | ✅ 1+1 matches |
| 2.4a | `grep "pino" src/lib/logger.ts` | ✅ 11 matches |
| 2.3a | `grep "validateBody" src/lib/validate.ts` | ✅ 2 matches |
| 3.2 | `grep "Decimal" prisma/schema.prisma` | ✅ 16 matches |
| 3.3 | `grep "@@index" prisma/schema.prisma` | ✅ 51 (12 existants + 39 nouveaux) |

## Décisions notables

### `Deal.aiDealHealth` gardé malgré 2 call-sites

Les 2 call-sites sont sur des pages dashboard fréquemment chargées (`crm/overview`, `crm/dashboard`). `aiDealHealth: { in: ["at_risk", "needs_attention"] }` est très sélectif (3 valeurs possibles) → l'index filtre drastiquement. À l'échelle future (5000 deals), cette query devient lente sans index.

### `Email.[direction, date]` composite (pas 2 simples)

Le code fait `WHERE direction = 'outbound' AND date >= X`. Le composite `[direction, date]` sert cette query + la query `WHERE direction = 'outbound'` seule (leftmost prefix principle). 2 simples indexes forceraient PostgreSQL à faire un bitmap AND merge plus coûteux.

### Session.expires ajouté au-delà de Phase 0

NextAuth fait un cleanup périodique `DELETE WHERE expires < NOW()`. Sans index, full table scan. Avec index, scan minimal. Safe fintech hygiene — ajouté sur suggestion Vernon post-Phase 0.

### Pas de partial indexes

À l'échelle Oxen, un `@@index([column], where: { column: { not: "done" } })` est over-engineering. PostgreSQL utilise l'index plein même sur `!=`/`NOT IN` si la sélectivité est raisonnable. À reconsidérer dans 6-12 mois si des slow queries apparaissent sur ces patterns.

### Pas de GIN indexes

Hors scope explicite du prompt Sprint 3.3. Les queries `contains, mode: insensitive` (search contacts, companies) ne bénéficieront pas de ces B-tree indexes. Un GIN `pg_trgm` index serait l'outil adapté, à faire dans un sprint dédié search quality.

## Actions Railway post-push

Au prochain push, Railway exécute `npx prisma generate && npx prisma migrate deploy && npm run build`. Logs attendus :

```
1 migration found in prisma/migrations
Applying migration `20260423100331_add_performance_indexes`
The following migration(s) have been applied:
migrations/
  └─ 20260423100331_add_performance_indexes/
    └─ migration.sql
All migrations have been successfully applied.
```

### Impact opérationnel

- **39 `CREATE INDEX`** sur 16 tables
- **Durée par index** : < 100ms sur tables < 100 rows (B-tree creation sur petits volumes)
- **Durée totale** : quelques secondes
- **Locking** : `ShareLock` temporaire par table (lectures OK, writes bloqués brièvement)
- **Downtime visible utilisateur** : aucun

## Smoke tests post-deploy recommandés

1. Dashboard CRM → chargement normal, filtres par stage rapides
2. Pipeline Kanban → déplacement deals entre stages OK
3. Forecast → chargement normal (plus rapide qu'avant, mais invisible à cette échelle)
4. Finance Overview → chargement normal
5. Railway logs runtime → aucune erreur Prisma / Postgres

## Rollback possible

À tout moment post-push, si un problème apparaît :

```bash
git revert <commit-sha-sprint-3.3>
git push origin main
```

Railway redéploie sans les nouveaux indexes. Mais les indexes restent en DB (migration non-automatiquement revert). **Aucun impact négatif** : les indexes inutilisés par le nouveau code restent inoffensifs. Optionnellement :

```sql
DROP INDEX IF EXISTS "Deal_stage_dealOwner_idx";
-- ... (pour chaque index)
```

ou simple backup restore pré-Sprint 3.3.

## Prochaine étape

**Sprint 3.4 possible — Pagination + N+1 fixes** :
- `findMany` sans limite identifiés par audit
- Patterns N+1 dans boucles (ex: `for deal in deals { await prisma.contact.find(...) }`)

Alternativement, monitoring :
- Abaisser le slow query threshold (500ms → 100ms ?) pour capturer des cas sub-seuil
- Ajouter tracking des indexes utilisés via `pg_stat_user_indexes` (compte les reads par index pour identifier les candidats à drop)

## Ce sprint ne fait PAS

- ❌ Pagination sur `findMany` sans limite — Sprint 3.3b ou 3.4
- ❌ Fix des N+1 identifiés dans l'audit — Sprint 3.4
- ❌ Ré-analyse du slow query threshold — sprint d'op hygiene plus tard
- ❌ Full-text search (GIN) — à faire à la demande, sprint search quality dédié
- ❌ Partial indexes — overengineering pour l'échelle Oxen actuelle
- ❌ Suppression d'indexes existants — additif uniquement
- ❌ Modification des types de colonnes — Sprint 3.2 (Float → Decimal) déjà fait
- ❌ Commit automatique

## Refs

- `AUDIT_REPORT_2026-04-21.md` #M2 (slow queries potentielles), #M9 (FK non indexés)
- `SPRINT_3_1_REPORT.md` — pipeline `migrate deploy` (prérequis)
- `SPRINT_3_2_REPORT.md` — migration Float → Decimal (sprint précédent)
- `MIGRATIONS.md` — workflow de création de migration
