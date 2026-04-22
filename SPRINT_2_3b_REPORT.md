# Sprint 2.3b — Rapport d'exécution

**Date** : 2026-04-22
**Portée** : Webhooks (4 externes + inbound-lead) + CRM Core CRUD (15 routes)

## Fichiers créés

| Fichier | LOC | Rôle |
|---|---:|---|
| `src/app/api/webhooks/_schemas.ts` | 77 | 4 schemas webhooks externes |
| `src/app/api/crm/_schemas.ts` | 336 | 21 schemas CRM (CRUD + inbound-lead) |
| `SPRINT_2_3b_REPORT.md` | — | Ce rapport |

## Fichiers modifiés

- **20 routes** : 5 webhooks + 15 CRM Core CRUD
- Aucun helper partagé modifié (réutilisation de `src/lib/validate.ts` Sprint 2.3a)
- Aucun test ajouté (couverture `publicErrors: false` déjà présente dans `validate.test.ts` Sprint 2.3a)

## Webhooks (5 routes validées)

| Fichier | Secret check | HMAC | Body Zod | `publicErrors` | Notes |
|---|---|---|---|---|---|
| `webhooks/clay/route.ts` | ✅ `requireWebhookSecret` | N/A | ✅ strict (5 fields) | `false` | score bornés 0-1000 |
| `webhooks/lemlist/route.ts` | ✅ HMAC SHA-256 (custom) | ✅ existant | ✅ **inline `safeParse`** | `false` (équivalent) | Body consommé via `req.text()` pour HMAC → `validateBody` impossible |
| `webhooks/trigify/route.ts` | ✅ `requireWebhookSecret` | N/A | ✅ strict (7 fields) | `false` | |
| `webhooks/n8n/route.ts` | ✅ `requireWebhookSecret` | N/A | ✅ strict sur `action` + `contactEmail`, `data: z.any()` | `false` | Payload data varie par workflow → permissif sur `data` |
| `crm/webhooks/inbound-lead/route.ts` | ✅ `requireWebhookSecret` (upgraded from custom check) | N/A | ✅ strict (9 fields) | `false` | Source externe (form contact `oxen.finance`) |

## CRM Core CRUD (15 routes validées sur 16, 1 skip)

| Fichier | Méthodes | Body | Query | Notes |
|---|---|---|---|---|
| `crm/contacts/route.ts` | GET, POST | `createContactSchema` | `listContactsQuery` | 25+ champs (vertical, geoZone, lifecycle, etc.) |
| `crm/contacts/[id]/route.ts` | GET, PATCH, DELETE | `updateContactSchema` | — | PATCH utilise `.partial()` + champs analytics |
| `crm/contacts/[id]/activities/route.ts` | GET, POST | `createActivitySchema` | `listActivitiesQuery` | activityType enum (15 valeurs) |
| `crm/contacts/search/route.ts` | GET | — | `searchContactsQuery` | q max 200, limit max 50 |
| `crm/contacts/check-duplicates/route.ts` | POST | `checkDuplicatesSchema` | — | array emails cap à 5000 |
| `crm/contacts/import/route.ts` | POST | `importContactsSchema` | — | array contacts cap à 10000, enveloppe validée |
| `crm/contacts/export/route.ts` | GET | — | `exportContactsQuery` | filtres identiques à liste |
| `crm/companies/route.ts` | GET, POST | `createCompanySchema` | `listCompaniesQuery` | `employeeCount: z.coerce.number()` |
| `crm/companies/[id]/route.ts` | GET, PATCH | `updateCompanySchema` | — | |
| `crm/deals/route.ts` | GET, POST | `createDealSchema` | `listDealsQuery` | dealStage enum (9 stages), `dealValue: z.coerce.number()` |
| `crm/deals/[id]/route.ts` | GET, PATCH | `updateDealSchema` | — | recalcul weightedValue préservé |
| `crm/deals/[id]/stage/route.ts` | PATCH | `updateDealStageSchema` | — | transition stage + lostReason/Notes |
| `crm/tasks/route.ts` | GET, POST | `createTaskSchema` | `listTasksQuery` | taskType enum (11), taskPriority enum (4) |
| `crm/tasks/[id]/route.ts` | PATCH | `updateTaskSchema` | — | status enum avec autoTimestamp `completedAt` |
| `crm/views/route.ts` | GET, POST | `createViewSchema` | — | `filters: z.any()` (JSON Prisma) |
| `crm/views/[id]/route.ts` | DELETE | — | — | ⏭️ **skip** (pas de body, DELETE only) |

## Total Zod coverage après 2.3a + 2.3b

| Module | Routes validées | Schemas |
|---|---:|---:|
| Finance (Sprint 2.3a) | 15 | 21 |
| Compliance (Sprint 2.3a) | 14 | 18 |
| CRM Core CRUD (Sprint 2.3b) | 15 | 20 |
| Inbound-lead webhook (Sprint 2.3b) | 1 | 1 |
| Webhooks externes (Sprint 2.3b) | 4 | 4 |
| **TOTAL** | **49** | **64 schemas** |

## Ordre des défenses — confirmé pour les 5 webhooks

```
Clay/Trigify/N8N/Inbound-lead  : requireWebhookSecret() → validateBody(publicErrors:false) → logique
Lemlist                         : HMAC SHA-256 (raw body) → safeParse inline → logique
```

Pour tous : la validation Zod ajoute une **3e couche** après auth secret/HMAC. Si un émetteur légitime change sa structure, Zod rejette en 400 avant que la logique métier ne crash.

**Note upgrade** : `inbound-lead` utilisait un check custom (`secret !== process.env.X`) sans `timingSafeEqual`. Remplacé par `requireWebhookSecret` pour alignement avec Clay/Trigify/N8N/Telegram (uniformisation Sprint 0 étendue).

## Décisions notables

### Lemlist utilise `safeParse` inline

Raison : le body est consommé via `req.text()` pour la vérification HMAC SHA-256 — `validateBody(req, schema)` appellerait `req.json()` ce qui échouerait (stream déjà lu). Donc :

```ts
const rawBody = await request.text()
// HMAC vérif
const parsedBody = JSON.parse(rawBody)  // avec try/catch → 400 sur JSON malformé
const parsed = lemlistWebhookSchema.safeParse(parsedBody)
if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
const body = parsed.data
```

### N8N schema — discriminated union per action

Après review : la route N8N accède à des sous-champs de `data` (`data?.signalType`, `data?.firstName`, etc.), donc `z.any()` laissait passer des valeurs typées incorrectement jusqu'à Prisma (qui rejette au DB layer — défensif mais pas propre).

Passage à un `z.discriminatedUnion("action", [...])` avec 3 variants :
- `create_signal` → `data: {signalType?, title?, detail?, score?, expiresAt?}`
- `update_contact` → `data: {firstName?, lastName?, company?, vertical?, lifecycleStage?, source?, country?, outreachStatus?, leadSource?, clientType?, dealOwner?, introducerId?}` (12 clés whitelistées matchant le `allowed` array de la route)
- `create_interaction` → `data: {type?, content?}`

Chaque sous-champ typé (string.max(N), number bornés, isoDate). Type safety end-to-end.

**Note TS** : la route fait `for (const key of allowed) { data?.[key] }` qui casse le narrowing TS après discriminated union (indexation générique sur shape précise). Cast minimal `data as Record<string, unknown>` dans la boucle pour préserver le pattern existant sans refactor.

### `dealStage` — 10 valeurs (ajout de "qualified")

L'enum initial avait les 9 stages canoniques de `CLAUDE.md`. Mais `contacts/import/route.ts` (ACTIVE_PIPELINE_STAGES) et `deals/route.ts` (creation depuis contact.lifecycleStage) permettent à un Deal d'entrer en `"qualified"` stage. Ajout de `"qualified"` à l'enum pour éviter les 400 sur des imports CSV légitimes.

### `z.coerce.number()` pour les champs numériques client-variables

Le client envoie parfois les nombres en string (`"100"` vs `100`). Le code original faisait `parseFloat(body.dealValue)` pour gérer ça. Avec Zod, `z.coerce.number()` fait la conversion en amont :

- `CrmContact` pas impacté (pas de champ numérique coerced)
- `Company.employeeCount` : `z.coerce.number().int().min(0).optional()`
- `Deal.dealValue` : `z.coerce.number().finite().nullish()`

Les `parseFloat(body.X)` ont été retirés côté route (redondants après coerce).

### JSON fields Prisma : `z.any()` + cast au site d'appel

Champs identifiés :
- `Activity.metadata` → `metadata: z.any().optional()` (createActivitySchema)
- `Company.socialProfiles` → `socialProfiles: z.any().optional()` (create/update)
- `SmartView.filters` → `filters: z.any()` (createViewSchema)

Aucun import Prisma dans les schemas Zod. Même approche que Sprint 2.3a pour `ScreeningRecord.matchDetails`.

### Zod strip (default)

Même comportement que Sprint 2.3a : unknown fields silencieusement retirés. Pour les webhooks, c'est particulièrement utile — Clay/Lemlist peuvent ajouter des champs que notre code ignore, on ne veut pas rejeter 400.

## Non-régression Sprints 0 → 2.3a

| Check | Résultat |
|---|---|
| 4 webhooks (Clay, Trigify, N8N, Telegram) utilisent `requireWebhookSecret` | ✅ 4/4 |
| HSTS dans `next.config.ts` | ✅ |
| Seed hors whitelist `src/proxy.ts` | ✅ |
| `enc:v1` dans token-encryption | ✅ 4 occurrences |
| 29 routes Finance+Compliance (Sprint 2.3a) intactes | ✅ (validateBody présent) |

## Validation

| Check | Résultat |
|---|---|
| `npx tsc --noEmit` (monolith) | ✅ exit 0 |
| `cd workers/sync-worker && npx tsc --noEmit` | ✅ exit 0 |
| `npx vitest run` | ✅ 29/29 (3 fichiers inchangés : encryption, worker-sync, validate) |
| `npm run build` | ✅ exit 0 |
| Cross-check imports Prisma dans `_schemas.ts` | ✅ aucun |

## Ce sprint ne fait PAS

- ❌ CRM AI flows (9 routes) — à traiter au Sprint 2.3c si pertinent
- ❌ CRM Outreach sub-module (12 routes) — à traiter au Sprint 2.3c si pertinent
- ❌ CRM Reports/Analytics (10 routes) — à traiter au Sprint 2.3c si pertinent
- ❌ CRM Playbook/Audit/automation (5 routes) — à traiter au Sprint 2.3c si pertinent
- ❌ Validation des path params dynamiques (`[id]` hors scope décidé)
- ❌ Migration Float → Decimal (Sprint 3)
- ❌ Refactor de la logique métier (validation en amont strictement)

## Recommandation pour la suite

**Sprint 2.4 (logging structuré pino + Sentry)** recommandé en priorité. Raisons :
1. Visibilité opérationnelle post-hardening = bénéfice immédiat en prod
2. 49 routes maintenant validées couvrent les plus critiques (Finance, Compliance, CRM Core, Webhooks = data clients + money + régulatoire + entry points externes)
3. Les 36 routes CRM restantes (AI, Outreach, Reports) peuvent attendre sans risque majeur — AI a rate-limiting côté Claude, Outreach est un sub-module indépendant, Reports sont majoritairement GET
4. Le pattern Zod est documenté et capitalisable — le Sprint 2.3c (si fait) sera mécanique (1-2h) quand le besoin se fera sentir

Si Vernon préfère finir l'axe validation avant le logging : **Sprint 2.3c** = AI + Outreach + Reports + Playbook/Audit/automation = ~36 routes, estimation 2-3h. Patterns identiques à 2.3a+2.3b.
