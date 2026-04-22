# Sprint 2.3a — Rapport d'exécution

**Date** : 2026-04-22
**Portée** : Zod validation — modules Finance + Compliance

## Fichiers créés

| Fichier | LOC | Rôle |
|---|---:|---|
| `src/lib/validate.ts` | 130 | Helper `validateBody()` + `validateSearchParams()` |
| `src/lib/validate.test.ts` | 120 | 10 tests unitaires |
| `src/app/api/finance/_schemas.ts` | 207 | 21 schemas Zod (Finance) |
| `src/app/api/compliance/_schemas.ts` | 214 | 18 schemas Zod (Compliance) |
| `SPRINT_2_3a_REPORT.md` | — | Ce rapport |

## Fichiers modifiés

- `package.json` — `zod ^3.23.8` ajouté aux `dependencies` (résolu en 3.25.76)
- `package-lock.json` — auto
- **29 routes API** (voir tableaux ci-dessous)

## Dépendances

- **Zod v4 était présent en transitive** (via next-auth) mais pas dans `package.json`. Ajout explicite de `zod@^3.23.8` conformément au prompt. Résolution npm : `3.25.76` (dernière 3.x stable). Les deux versions coexistent sans conflit (hoisting npm).

## Routes couvertes — Finance

**15 routes validées / 16 (1 skip = seed sans input)** — 21 schemas

| Fichier | Méthodes | Body | Query | Status | Note |
|---|---|---|---|---|---|
| `finance/route.ts` | GET, POST | `createFinanceEntrySchema` | `listFinanceEntriesQuery` | ✅ | |
| `finance/[id]/route.ts` | PATCH, DELETE | `updateFinanceEntrySchema` | — | ✅ | DELETE sans body |
| `finance/accounts/route.ts` | GET, POST | `createBankAccountSchema` | `listBankAccountsQuery` | ✅ | |
| `finance/accounts/[id]/route.ts` | PATCH, DELETE | `updateBankAccountSchema` | — | ✅ | |
| `finance/transactions/route.ts` | GET, POST | `createFinanceTransactionSchema` | `listFinanceTransactionsQuery` | ✅ | pagination (page, limit) coerced |
| `finance/transactions/[id]/route.ts` | GET, PATCH, DELETE | `updateFinanceTransactionSchema` | — | ✅ | |
| `finance/budgets/route.ts` | GET, POST | `upsertBudgetsSchema` | `budgetsQuery` | ✅ | month YYYY-MM regex |
| `finance/budget/route.ts` | GET, POST | `replaceBudgetsSchema` | `budgetQuery` | ✅ | legacy variant |
| `finance/goals/route.ts` | GET, POST | `createFinanceGoalSchema` | `listGoalsQuery` | ✅ | |
| `finance/bulk/route.ts` | POST | `bulkFinanceEntriesEnvelope` | — | ✅ | envelope validé, rows restent Record<string,string> |
| `finance/transactions/bulk/route.ts` | POST | `bulkTransactionsEnvelope` | — | ✅ | max 10000 entries |
| `finance/transactions/export/route.ts` | GET | — | `exportTransactionsQuery` | ✅ | |
| `finance/summary/route.ts` | GET | — | `summaryQuery` | ✅ | |
| `finance/overview/route.ts` | GET | — | `overviewQuery` | ✅ | |
| `finance/reports/route.ts` | GET | — | `reportsQuery` | ✅ | enum reportType (pnl/cashflow/entity_comparison) |
| `finance/seed/route.ts` | POST | — | — | ⏭️ | seed sans input body |

## Routes couvertes — Compliance

**14 routes validées / 16 (2 skip = overview GET sans input, seed POST sans input)** — 18 schemas

| Fichier | Méthodes | Body | Query | Status | Note |
|---|---|---|---|---|---|
| `compliance/policies/route.ts` | GET, POST | `createPolicySchema` | `listPoliciesQuery` | ✅ | status enum (6 valeurs) |
| `compliance/policies/[id]/route.ts` | GET, PATCH, DELETE | `updatePolicySchema` | — | ✅ | |
| `compliance/policies/[id]/versions/route.ts` | GET, POST | `createPolicyVersionSchema` | — | ✅ | content max 100k chars |
| `compliance/risks/route.ts` | GET, POST | `createRiskSchema` | `listRisksQuery` | ✅ | likelihood/impact bornés 1-5 |
| `compliance/risks/[id]/route.ts` | GET, PATCH, DELETE | `updateRiskSchema` | — | ✅ | |
| `compliance/incidents/route.ts` | GET, POST | `createIncidentSchema` | `listIncidentsQuery` | ✅ | type enum inclut `sar` |
| `compliance/incidents/[id]/route.ts` | GET, PATCH, DELETE | `updateIncidentSchema` | — | ✅ | `reportedBy` omitted from update |
| `compliance/licenses/route.ts` | GET, POST | `createLicenseSchema` | `listLicensesQuery` | ✅ | documentUrl validé URL |
| `compliance/licenses/[id]/route.ts` | GET, PATCH, DELETE | `updateLicenseSchema` | — | ✅ | |
| `compliance/training/route.ts` | GET, POST | `createTrainingSchema` | `listTrainingsQuery` | ✅ | frequency enum (4 valeurs) |
| `compliance/training/[id]/route.ts` | GET, PATCH, DELETE | `updateTrainingSchema` | — | ✅ | |
| `compliance/training/[id]/completions/route.ts` | GET, POST | `upsertTrainingCompletionSchema` | — | ✅ | score bornés 0-100 |
| `compliance/screening/route.ts` | GET, POST | `createScreeningSchema` | `listScreeningsQuery` | ✅ | enums stricts (type, subject, result) |
| `compliance/screening/[id]/route.ts` | PATCH, DELETE | `updateScreeningSchema` | — | ✅ | |
| `compliance/overview/route.ts` | GET | — | — | ⏭️ | aggregate counts, aucun input |
| `compliance/seed/route.ts` | POST | — | — | ⏭️ | seed hardcodé, aucun input |

## Total couverture Sprint 2.3a

- **29 routes** validées (15 Finance + 14 Compliance) sur 32 totales (3 skip documentés)
- **39 schemas Zod** créés (21 Finance + 18 Compliance)
- **Helper `validateBody()` / `validateSearchParams()`** testés unitairement (10/10 verts)

## Routes skippées et raisons

- `finance/seed/route.ts` — POST sans body, seed hardcodé
- `compliance/overview/route.ts` — GET sans input (returns aggregate counts)
- `compliance/seed/route.ts` — POST sans body, seed hardcodé

## Décisions

### Pattern ValidationResult — discriminé par clés disjointes

Le prompt proposait `{ data: T; error?: never } | { data?: never; error: NextResponse }`. Cette forme bloque le narrowing TypeScript via `"error" in v` parce que les deux variants ont la clé `error` (même avec `?: never`). J'ai simplifié à `{ data: T } | { error: NextResponse }` — clés disjointes, narrowing TS fonctionne proprement avec `if ("error" in v) return v.error; const { data } = v`.

### Zod default strip (unknown fields)

Zod 3/4 **strip** les clés inconnues par défaut (vérifié via test). Un client qui envoie `{amount, date, rogue_field}` aura `rogue_field` silencieusement retiré. **Décision** : garder ce comportement. Moins cassant pour les clients (app web, scripts, tests), zero-coût en prod. À reconsidérer si un incident de type "champ inventé qui passe" survient — passage en `.strict()` trivialement activable schema par schema.

### Montants en `z.number()` — aligné DB Float

Tous les montants (`amount`, `target`, `financialImpact`, `currentBalance`) restent en `z.number().finite()` avec une borne de réalisme `< 1e12`. Aligné sur le schéma DB actuel (`Float`). Sprint 3 passera à `Decimal` et les schemas Zod migreront vers `z.string().regex(/^-?\d+(\.\d+)?$/)` ou une lib dédiée (ex: `decimal.js` via custom `z.instanceof(Decimal)`).

### Dates — ISO 8601 datetime OU "YYYY-MM-DD"

`isoDate` accepte les deux formats parce que les routes reçoivent les deux en pratique (`new Date(dateFrom)` marche avec l'un comme l'autre). Regex permissive mais non-ambiguë.

### Enums pour les statuts / types régulatoires

Tous les champs à valeurs fermées sont typés `z.enum([...])` :
- `policyStatus` — 6 valeurs (draft, pending_review, approved, active, archived, expired)
- `incidentType` — 6 valeurs (sar, breach, complaint, near_miss, audit_finding, regulatory_inquiry)
- `incidentSeverity` — 4 valeurs (critical/high/medium/low)
- `riskStatus` — 5 valeurs (open, mitigating, accepted, closed, monitoring)
- `licenseStatus` — 5 valeurs
- `screeningType` / `screeningSubject` / `screeningResult` — enums stricts
- etc.

Ça durcit l'input en amont (le schema DB est juste `String?` en Prisma).

### `matchDetails` (Json field) — cast object

Le champ `ScreeningRecord.matchDetails` est `Json?` en Prisma. Zod `z.any()` ne se projette pas proprement dans `Prisma.InputJsonValue` (TS rejette). Cast minimal au point d'usage dans la route : `matchDetails as object`. Le schema Zod reste pur (pas d'import Prisma).

### Validation manuelle remplacée par Zod

Les checks existants du style `if (!title || !category) return 400` ont été retirés là où Zod les remplace. Les checks d'auth (`session`, `requirePageAccess`), de ressource existante (`if (!existing) return 404`), et de logique métier (recalcul riskScore, incrémentation code POL-001…) sont **préservés intacts**.

## Effort réel vs estimation

- **Estimation prompt** : "sous-sprint Finance + Compliance, mesurer après"
- **Effort observé** :
  - Lecture inventaire : 32 routes → ~10 min
  - Helper + tests : ~10 min
  - Schemas Finance (21) : ~15 min
  - Application Finance (15 routes) : ~20 min
  - Schemas Compliance (18) : ~15 min
  - Application Compliance (14 routes) : ~20 min
  - Debug tsc (discriminator + matchDetails) : ~10 min
  - Rapport + non-régression : ~10 min
  - **Total** : ~1h50
- **Complexité observée** : moyenne — patterns très répétitifs (CRUD + filtres), 2 pièges TS (discriminator, Prisma Json). Aucun piège métier.

## Recommandation pour la suite Sprint 2.3

Vu l'effort et la répétitivité :

- ✅ **Enchaîner 2.3b (CRM + webhooks) maintenant — recommandé**. Mêmes patterns, même helper, schemas similaires. Estimation 1h30-2h. Vague utile car le CRM touche 30+ routes.
- ⚠️ Sprint 2.4 (logging pino + Sentry) reste plus urgent en termes de valeur opérationnelle (visibilité prod). À arbitrer selon priorité : si Vernon veut fermer l'axe "validation" d'abord, enchaîner 2.3b. Si visibilité prod plus urgent, 2.4 avant 2.3b.

Ma suggestion : **2.3b next**, puis 2.4. Le momentum sur le pattern Zod est frais, passer à autre chose reviendrait à devoir réapprendre le contexte.

### Points à mentionner dans 2.3b (lessons learned)

- Choisir `{ data: T } | { error: NextResponse }` (clés disjointes) plutôt que `?: never` — narrowing TS propre.
- Json fields Prisma → cast minimal `as object` au site d'appel.
- Pattern d'application : validation INSIDE try/catch (compliance) ou OUTSIDE (finance) — les deux marchent, cohérent avec le style existant du fichier.

## Non-régression Sprints 0 → 2.2

- ✅ 4 webhooks (Clay, Trigify, N8N, Telegram) utilisent `requireWebhookSecret`
- ✅ HSTS `Strict-Transport-Security` dans `next.config.ts`
- ✅ Seed hors whitelist `src/proxy.ts`
- ✅ 4 occurrences `enc:v1` dans `src/lib/token-encryption.ts`

## Validation

| Check | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `cd workers/sync-worker && npx tsc --noEmit` | ✅ exit 0 |
| `npx vitest run` | ✅ 29/29 (3 fichiers : encryption, worker-sync, validate) |
| `npm run build` | ✅ exit 0 |
| Cross-check zod imports côté Zod schemas | ✅ aucun `import { Prisma } from "@prisma/client"` dans `_schemas.ts` |

## Ce sprint ne fait PAS

- ❌ Pas de validation sur les routes hors Finance/Compliance
- ❌ Pas de validation des path params (`[id]` — hors scope décidé)
- ❌ Pas de migration `Float → Decimal` (Sprint 3)
- ❌ Pas de refactor de la gestion d'erreur existante (401, 403, 500 inchangés)
- ❌ Pas de suppression de try/catch, auth, role check
- ❌ Pas de touche aux workers
- ❌ Pas de commit
