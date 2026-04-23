# Sprint 3.2 — Rapport d'exécution

**Date** : 2026-04-23
**Portée** : Migration `Float` → `Decimal` sur 16 champs monétaires (PostgreSQL `DOUBLE PRECISION` → `DECIMAL(19,4)` + 1 champ en `DECIMAL(19,8)` pour taux FX)
**Objectif** : éliminer les erreurs d'arrondi IEEE 754 sur les calculs monétaires, prérequis conformité VQF.

## Champs migrés (16)

| Modèle | Champ | Type cible | Commentaire |
|---|---|---|---|
| `Company` | `totalRevenue` | `Decimal(19,4)` | Revenu agrégé |
| `Deal` | `dealValue` | `Decimal(19,4)` | Valeur deal (nullable) |
| `Deal` | `weightedValue` | `Decimal(19,4)` | dealValue × winProbability |
| `FinanceEntry` | `amount` | `Decimal(19,4)` | Entrée P&L |
| `FinanceTransaction` | `amount` | `Decimal(19,4)` | Transaction |
| `FinanceTransaction` | `amountEur` | `Decimal(19,4)` | Normalisé EUR |
| `FinanceTransaction` | `exchangeRate` | `Decimal(19,8)` | **8 décimales** pour FX |
| `FinanceBudget` | `amount` | `Decimal(19,4)` | Budget mensuel |
| `BankAccount` | `currentBalance` | `Decimal(19,4)` | Solde bancaire |
| `ConferenceAttendee` | `ticketCost` | `Decimal(19,4)` | Coût billet |
| `ConferenceAttendee` | `hotelCost` | `Decimal(19,4)` | |
| `ConferenceAttendee` | `flightCost` | `Decimal(19,4)` | |
| `ConferenceAttendee` | `taxiCost` | `Decimal(19,4)` | |
| `ConferenceAttendee` | `mealsCost` | `Decimal(19,4)` | |
| `ConferenceAttendee` | `otherCost` | `Decimal(19,4)` | |
| `ComplianceIncident` | `financialImpact` | `Decimal(19,4)` | Impact monétaire SAR/incident |

**Total**: 15 × `Decimal(19,4)` + 1 × `Decimal(19,8)`

## Champs intentionnellement NON migrés

Identifiés en Phase 0, laissés en `Float` pour des raisons sémantiques :

| Type | Champs |
|---|---|
| Probabilités (0-1 ou %) | `Deal.winProbability` |
| Taux / rates (0-100%) | `Outreach.openRate/replyRate/bounceRate/spamRate/inboxPlacement`, `Employee.referralSuccessRate` |
| Durées (heures/jours) | `TrainingCompletion.durationHours`, `Employee.totalDays`, `Outreach.avgResponseTimeHours`, 4× leave balances (`vacationUsed/Pending`, `sickUsed`, `oooUsed`) |
| Scores | `TrainingCompletion.score` |
| **Polymorphes** | `KpiEntry.value` (peut être revenu, count, taux…), `FinanceGoal.target` (EUR, %, mois) |

Les polymorphes sont le choix le plus subtil : un futur sprint pourrait les séparer par type (par ex. `KpiEntryMonetary` distinct de `KpiEntryPercent`), mais tant qu'ils servent de fourre-tout, `Float` reste adapté.

## Décision architecturale — Option B

**Problème** : `Prisma.Decimal` sérialise en `string` par défaut en JSON (`JSON.stringify({amount: new Decimal("100.50")})` → `{"amount":"100.5"}`).

17 reducers frontend identifiés sur 5 pages React utilisent le pattern `(sum, v) => sum + v.amount` (sans `parseFloat`). Avec une string côté client, le `+` devient concaténation : `"100" + "200" = "100200"`. Silencieux, gravement cassant.

**Option B retenue** : `serializeMoney(value: Prisma.Decimal | null | undefined): number | null` convertit via `.toNumber()` à la frontière JSON. Les reducers frontend continuent à fonctionner **sans modification** (types déjà `number | null` dans les interfaces).

**Contrat codifié** : 2 tests explicites dans `src/lib/decimal.test.ts` verrouillent la décision :
```ts
it("serializeMoney returns number (not string) for reducer compatibility", () => {
  expect(typeof serializeMoney(new Prisma.Decimal("100.50"))).toBe("number")
})
it("serializeMoneyString returns string (for future precision use)", () => {
  expect(typeof serializeMoneyString(new Prisma.Decimal("100.50"))).toBe("string")
})
```

`serializeMoneyString()` reste dans le helper pour usage futur (audit exports, compliance reports) où la précision bit-exacte compte. Non consommé actuellement — documenté.

**Précision preserved end-to-end** :
1. **DB storage** : `DECIMAL(19,4)` bit-exact
2. **Prisma `_sum` aggregate** : `NUMERIC` bit-exact (calculé par Postgres)
3. **`.toNumber()` conversion** : IEEE 754, ≤15 sig-figs safe (Oxen cap ≤13 sig-figs à 1B EUR / 4 décimales)
4. **Arithmétique JS finale** : IEEE 754 Float, drift visible seulement sur décimales longues (`0.1 + 0.2 ≠ 0.3` en natif JS)

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `prisma/migrations/20260423073736_convert_monetary_fields_to_decimal/migration.sql` | Migration SQL : 8 `ALTER TABLE`, 16 `ALTER COLUMN`, conversion implicite Postgres (pas de `USING`) |
| `src/lib/decimal.ts` | 8 helpers (`toDecimal`, `serializeMoney`, `serializeMoneyString`, `decimalToNumber`, `sumDecimals`, `multiplyByRate`, `formatMoney`, `isPositive`) + type `DecimalInput` |
| `src/lib/decimal.test.ts` | 34 tests unitaires (IEEE 754 drift prevention, FX conversion précision, reducer compatibility, null/undefined edge cases) |
| `SPRINT_3_2_REPORT.md` | Ce rapport |

## Fichiers modifiés (37)

### Schema + helper partagé

| Fichier | Delta |
|---|---|
| `prisma/schema.prisma` | +15 / -15 (16 field type changes) |
| `src/lib/support-auto.ts` | +5 (import `serializeMoney`, conversion Decimal→number pour `detectPriority`) |

### API routes (35 fichiers)

**Finance (9)** — agrégats, Pattern B systématique :
- `finance/route.ts`, `finance/[id]/route.ts` (FinanceEntry)
- `finance/transactions/route.ts`, `finance/transactions/[id]/route.ts` (helper `serializeTx`)
- `finance/accounts/route.ts`, `finance/accounts/[id]/route.ts`
- `finance/budgets/route.ts`
- `finance/overview/route.ts`, `finance/summary/route.ts`, `finance/reports/route.ts`

**CRM (15)** — reducers + response serialization :
- `crm/deals/route.ts`, `crm/deals/[id]/route.ts`, `crm/deals/[id]/stage/route.ts`
- `crm/companies/route.ts`, `crm/companies/[id]/route.ts`
- `crm/overview/route.ts`, `crm/pipeline/route.ts`, `crm/forecast/route.ts`
- `crm/reports/pipeline/route.ts`, `crm/reports/revenue/route.ts`
- `crm/dashboard/route.ts`, `crm/search/route.ts`, `crm/health/route.ts`
- `crm/ai/health-check-all/route.ts`, `crm/ai/score-all/route.ts`
- `deals/[id]/route.ts` (legacy route, Pattern C appliqué)

**Compliance (2)** :
- `compliance/incidents/route.ts`, `compliance/incidents/[id]/route.ts`

**Conferences (2)** :
- `conferences/[id]/roi/route.ts`
- `conferences/[id]/attendees/[attendeeId]/route.ts` (Pattern C via `safeMoney` wrapper)

**Telegram + AI (5)** :
- `telegram/webhook/route.ts`, `telegram/weekly-digest/route.ts`
- `ai/auto-insights/route.ts`, `ai/digest/route.ts`, `ai/stats/route.ts`

## Fichiers **non-modifiés** (vérifiés)

- `src/lib/prisma.ts` — inchangé (extension `$extends` Sprint 1.3 + slow query hook Sprint 2.4a intacts)
- `src/lib/logger.ts`, `src/lib/sentry.ts`, `src/lib/token-encryption.ts`, `src/lib/validate.ts` — inchangés
- `workers/sync-worker/src/lib/*.ts` — inchangés (sync préservée, test SHA-256 worker-sync passe toujours)
- `next.config.ts` — inchangé (HSTS + CSP + Permissions-Policy Sprint 1.1+1.2 intacts)
- `src/proxy.ts` — inchangé
- `nixpacks.toml`, `railway.json` — inchangés (build command `migrate deploy` Sprint 3.1 intact)
- Pages frontend (`src/app/crm/page.tsx`, `src/app/finance/page.tsx`, etc.) — **aucune modification**, fonctionnelles grâce à Option B

## Patterns appliqués

| Pattern | Description | Exemple |
|---|---|---|
| **A** — Reducers API | `sumDecimals(items.map(i => i.amount))` en précision Decimal, puis `serializeMoney` à la fin | `finance/overview/route.ts:112` |
| **B** — JSON responses | `{...model, amount: serializeMoney(model.amount)}` avant `NextResponse.json` | `finance/accounts/route.ts:28` |
| **C** — parseFloat → toDecimal | `safeMoney(v)` wrapper non-throwing pour user input non-Zod | `conferences/[id]/attendees/[attendeeId]/route.ts:11` |
| **D** — Arithmétique directe | `d.dealValue.toNumber() * prob` ou `Decimal.times()` | `deals/[id]/stage/route.ts:55` |
| **E** — Frontend reducers | **Aucune modification** (Option B → reducers `number + number` intacts) | `src/app/crm/page.tsx:175-176` |

## Validation

| Check | Résultat |
|---|---|
| Erreurs TypeScript post-`prisma generate` | 95 → **0** ✅ |
| `npx tsc --noEmit` (monolith) | ✅ EXIT 0 |
| `npx tsc --noEmit` (workers/sync-worker) | ✅ EXIT 0 |
| `npx vitest run` | ✅ 83/83 (49 baseline + 34 decimal) |
| `npm run build` | ✅ OK |
| `npx prisma validate` | ✅ "schema is valid 🚀" |
| 8 `ALTER TABLE` / 16 `ALTER COLUMN` dans SQL | ✅ (15×19,4 + 1×19,8) |
| 0 `DROP`/`DELETE`/`TRUNCATE`/`USING` | ✅ |
| Frontend reducers vérifiés intacts | ✅ 5 pages React, types déjà `number \| null` |

### Non-régression Sprints 0 → 3.1

| Sprint | Check | Résultat |
|---|---|---|
| 1.1+1.2 | `grep "Strict-Transport-Security" next.config.ts` | ✅ 1 match |
| 1.3 | `grep "enc:v1" src/lib/token-encryption.ts` | ✅ 4 matches |
| 2.3a/b | `grep "validateBody" src/lib/validate.ts` | ✅ 2 matches |
| 2.4a | `grep "pino" src/lib/logger.ts` | ✅ 11 matches |
| 2.4b | `grep "@sentry" src/lib/sentry.ts` | ✅ 17 matches |
| 3.1 | `grep "migrate deploy" nixpacks.toml railway.json` | ✅ 1+1 matches |

## Dette technique identifiée

### DT-1 : Conferences hors Zod scope

Les 13 routes sous `src/app/api/conferences/**` ne sont pas couvertes par un `_schemas.ts` Zod (Sprints 2.3a/b ont couvert Finance + Compliance + CRM Core + Webhooks uniquement).

**Mitigation actuelle** : `safeMoney()` wrapper non-throwing dans `conferences/[id]/attendees/[attendeeId]/route.ts` retourne `Decimal(0)` sur input invalide, préservant la sémantique `parseFloat || 0` qui était là avant.

**Risque** : masquage silencieux d'erreur de saisie — un attaquant/utilisateur envoyant `"not-a-number"` comme `ticketCost` voit sa valeur enregistrée à 0 sans erreur.

**Résolution future** : Sprint 2.3c hypothétique, ajout Zod sur `conferences/*`, `marketing/*`, `intel/*`, `wiki/*`, etc. (toutes les routes encore hors scope).

### DT-2 : Bulk imports `parseFloat`

`src/app/api/finance/bulk/route.ts` (ligne 36) et `src/app/api/finance/transactions/bulk/route.ts` (ligne 25) utilisent `parseFloat()` sur les valeurs CSV.

**Flow actuel** : `parseFloat(csvString) → number → Prisma (conversion Decimal column)`. Fonctionne correctement — Prisma accepte `number` pour colonnes Decimal.

**Précision marginale perdue** : `parseFloat("0.1") === 0.1` en IEEE 754 (≈ `0.1000000000000000055511151231257827...`) → Prisma stocke `0.1000`. La perte est dans le **6e chiffre après la virgule**, soit dans le bruit pour des valeurs monétaires réalistes (centimes ≥ 0.01).

**Résolution future** : sprint "CSV import hardening", remplacer `parseFloat` par `toDecimal` (préserve la précision string → Decimal sans passer par Float).

### DT-3 : Pattern A — soustraction finale en IEEE 754

Les routes d'agrégation comme `finance/overview/route.ts` font :
```ts
const revenue = serializeMoney(...) ?? 0   // number
const expenses = serializeMoney(...) ?? 0  // number
const netProfit = revenue - expenses       // IEEE 754 Float subtraction
```

**Précision préservée** en DB + dans l'agrégat Prisma (`_sum` via PostgreSQL). **Drift IEEE 754 possible** seulement sur la soustraction JS finale — et uniquement si les opérandes ont des décimales longues (ce qui n'est pas le cas à l'échelle Oxen : montants en centimes, toujours ≥ 0.01).

**Cohérent avec Option B** — le trade-off est documenté et accepté Phase 0.

**Résolution future (case-by-case)** : pour un endpoint critique affichant des montants exacts (ex: export comptable CFO, audit regulator), utiliser :
```ts
const revenueD = monthRevenue._sum.amount ?? new Prisma.Decimal(0)
const expensesD = monthExpenses._sum.amount ?? new Prisma.Decimal(0)
const netProfit = serializeMoney(revenueD.minus(expensesD)) ?? 0
```

## Actions DB effectuées / à effectuer

**Étape 2 (cette session)** : migration SQL générée via `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script`. Lecture read-only de la prod, aucune écriture. Fichier écrit dans `prisma/migrations/20260423073736_convert_monetary_fields_to_decimal/migration.sql`.

**Au prochain push (post-commit)** : Railway exécute automatiquement `npx prisma migrate deploy` avant `npm run build`. Logs attendus :
```
1 migration found in prisma/migrations
Applying migration `20260423073736_convert_monetary_fields_to_decimal`
The following migration(s) have been applied:
migrations/
  └─ 20260423073736_convert_monetary_fields_to_decimal/
    └─ migration.sql
All migrations have been successfully applied.
```

## Impact opérationnel au deploy

- **8 `ALTER TABLE`** sur 8 tables (`BankAccount`, `Company`, `ComplianceIncident`, `ConferenceAttendee`, `Deal`, `FinanceBudget`, `FinanceEntry`, `FinanceTransaction`)
- **Volumes** : 8 rows (Company) à 70 rows (ConferenceAttendee) — toutes petites
- **Durée par table** : < 1 seconde (ALTER COLUMN ... SET DATA TYPE sur < 100 rows)
- **Locking** : `AccessExclusiveLock` par table pendant la conversion, requêtes concurrentes brièvement en queue
- **Downtime visible utilisateur** : aucun — la latence temporaire (~quelques ms) est dans le bruit normal

## Rollback possible

À tout moment post-push, si un problème apparaît :

```bash
git revert <commit-sha-sprint-3.2>
git push origin main
# → Railway redéploie avec l'ancien code (Float expected)
# → La DB reste en Decimal (migration pas revert auto)
# → Les routes Float-expecting reliront Decimal (Prisma auto-cast vers number), OK
# Si comportement ambigu : restore backup DB Railway pris avant Étape 4
```

**Note** : le backup Railway DB frais a été pris par Vernon avant Étape 4 (instruction donnée au checkpoint Étapes 3+4 validées).

## Prochaine étape

**Sprint 3.2 clôturé** après validation smoke tests post-deploy :
1. Dashboard `/` charge normalement
2. Page Finance : transactions existantes affichent montants corrects
3. Page CRM Deals : `dealValue` affiché sans NaN
4. Logs Railway : aucune erreur Prisma / crash
5. Écriture d'une nouvelle transaction fonctionne (round-trip)

**Sprint 3.3 (possible)** : VQF compliance audit report export (CSV/PDF avec montants Decimal bit-exact via `serializeMoneyString`). Ou pivot vers un autre sprint backlog selon priorités.

## Ce sprint ne fait PAS

- ❌ Migration des Float polymorphes (`KpiEntry.value`, `FinanceGoal.target`) — out of scope, décision locked Phase 0
- ❌ Conversion Pattern C sur les bulk imports (`finance/bulk`, `finance/transactions/bulk`) — documenté DT-2
- ❌ Extension Zod sur `conferences/*` et autres routes encore hors scope — documenté DT-1
- ❌ Refactoring `fmtCurrency` dans `crm-config.ts` vers helpers decimal.ts — laissé en parallèle pour migration progressive future
- ❌ Commit automatique
- ❌ Modification des pages frontend — aucune nécessaire grâce à Option B

## Refs

- `AUDIT_REPORT_2026-04-21.md` #C5 — monetary fields precision
- `SPRINT_3_1_REPORT.md` — migrate deploy workflow (prérequis)
- `MIGRATIONS.md` — workflow de création de migration
