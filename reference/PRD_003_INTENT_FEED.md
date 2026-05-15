# PRD-003 — Intent Feed UI

**Version** : v1.1 — pré-spec (recon findings integrated)  
**Date** : 2026-05-15 (vendredi)  
**Auteur** : Vernon Dessy + Claude (post-Trigify Phase 2A + recon)  
**Status** : 📋 Ready for review → Sprint code (~8h focus)  
**Audience** : Vernon (self-reference), PM futur, Andy/Paul (BD users), Johnny Le (si pair-programming)

---

## Executive Summary

Sprint **Intent Feed UI** = dashboard BD pour consommer les signaux d'intent capturés par Trigify + Clay + autres sources. Sortie attendue : page `/crm/intent-feed` dans Oxen-OS où Andy & Paul scannent daily les hot signals, filtrent par sources/types/groupes, et déclenchent actions (créer task, send Telegram broadcast BDs, view contact, mark actioned).

**Pourquoi maintenant** : Trigify Phase 2A est live mais les signaux restent en DB invisibles aux BD. Sans UI consommation, le pipeline data IN tourne dans le vide. Intent Feed = première feature **non bloquée par Phase 3 Scoring** qui débloque la valeur business des signaux captés.

**Estimation effort** : ~8h focus en 1 journée (validé par recon, 8 batches).

**Préreq côté Vernon** :
- Sprint Trigify Phase 2A déployé ✅ (livré aujourd'hui)
- Workflow Trigify "Linkedin oxen" Enabled ✅
- Data en DB pour testing (Clay 1586 Companies + 597 Contacts + Trigify début ingestion)

**Préreq côté Andy** (non-bloquant) :
- Validation visuelle V1 dashboard (5 min review au démarrage du sprint)
- Quick feedback sur filtres/actions prioritaires

**🚨 Risque bloquant identifié par recon (R2)** :
Les contacts auto-créés Trigify Phase 2A avec `lifecycleStage: "intent_sourced"` ne sont pas listés dans LIFECYCLE_STAGES de `crm-config.ts`. Donc invisibles dans tous les filtres UI lifecycle existants. **Fix obligatoire** intégré comme **B1** du sprint Intent Feed.

---

## 1. Context & Objectives

### 1.1 Le problème actuel

Pipeline data IN actuel :
- Trigify → /api/webhooks/trigify → IntentSignal table
- Clay → /api/webhooks/clay-* → CrmContact + IntentSignal
- Manual → CRM UI → CrmContact

**Problème** : BD (Andy, Paul) n'ont aucune UI pour consommer ces signaux quotidiennement. Pas d'écran "qu'est-ce qui rentre aujourd'hui".

Sans Intent Feed :
- Andy doit query la DB ou fouiller les Telegram alerts éparpillés
- Paul Louis n'a aucune visibilité sur l'engagement competitor
- Vernon doit faire des SQL queries pour valider le pipeline
- Les signaux Trigify s'accumulent en DB sans value extraction

### 1.2 Place dans la roadmap 14 features Andy

```
✅ Feature #1 — Trigify (Phase 2A livré 2026-05-15)
✅ Feature #2 — Clay enrichment (Sprint S0.5 + S1)
🟢 Feature #3 — Intent Feed UI (CE SPRINT)         ← première feature UI consume
🔴 Feature #4 — Apify + n8n scraping (V2)
🔴 Feature #5 — Intel Page per-contact (V2)
🔴 Feature #6-8 — Scoring Engine (Phase 3, bloqué Andy)
🔴 Feature #9-14 — Sequences orchestration (Phase 3+)
```

→ Intent Feed est la **3e feature livrée** sur 14, et **la 1ère feature UI** consommant les signaux.

### 1.3 Distinction Sentinel (AI personnel Vernon) vs Intent Feed (UI BD)

⚠️ **Important** : Vernon a un agent AI personnel appelé **Sentinel** (séparé d'Oxen-OS) qui fait :
- 7AM morning brief Telegram
- 9PM recap
- Real-time alerts VIP contacts (Natalija, Arthur Vauchez)
- Lifestyle context

**Intent Feed** est DIFFÉRENT :
- UI dans Oxen-OS (page `/crm/intent-feed`)
- Pour BD business (Andy, Paul, Vernon en tant que CEO)
- Consume signaux business du CRM
- Pas de connexion Sentinel V1

**V2 backlog** : connecter Sentinel AI à Intent Feed pour envoyer Vernon une synthèse perso quotidienne des top signaux business via Telegram morning brief (pas implémenté V1, mais API conçue pour le supporter).

### 1.4 Objectifs V1

1. **Visibilité BD** — Andy & Paul ouvrent `/crm/intent-feed` chaque matin pour scanner ce qui s'est passé
2. **Tri par valeur** — Signaux les plus impactants en haut (proxy score : points × decay × recency)
3. **Filtres rapides** — Source, signal type, group, date range, hot-only
4. **Quick actions** — Créer task, send Telegram broadcast, view contact, mark actioned
5. **No-blocker** — Fonctionne sans Phase 3 Scoring (tri manuel par BD)
6. **Fix R2 transverse** — Les contacts `intent_sourced` deviennent enfin filterables dans toute l'app

### 1.5 Non-objectifs V1 (deferred V2)

- ❌ Priority Score automatique (= Phase 3, bloqué Andy)
- ❌ Tier transitions (T1/T2/T3) auto (= Phase 3)
- ❌ Sequence Lemlist auto-trigger (= Phase 3)
- ❌ Real-time updates (WebSocket / polling) → V2
- ❌ AI summarization daily (= Sentinel-style brief) → V2
- ❌ Mobile-optimized → V2 (web desktop V1)
- ❌ Export CSV signaux → V2
- ❌ Bulk actions multi-signaux → V2
- ❌ Sidebar entry top-level (V1 = accessed depuis /crm hub)
- ❌ Component tests RTL (V1 = API tests seulement)
- ❌ Task.signalId FK schema (V1 = description string link)
- ❌ Active filter badges chip UI (V1 = select dropdowns only)
- ❌ Optimistic mark-actioned (V1 = loading state + refresh)
- ❌ Relative time display ("2h ago") (V1 = simple date format)
- ❌ Index DB additionnels (V1 = use existing indexes)
- ❌ CrmContact.dealOwnerEmployeeId FK migration (= V2 prerequisite for "my signals" filter)
- ❌ Send Telegram recipient selector (V1 = broadcast aux BDs via CRM_BD_EMAILS)
- ❌ "My signals" filter V1 (besoin dealOwnerEmployeeId FK = V2)
- ❌ Persona / Jurisdiction filters (V2)

---

## 2. User Personas & Flows

### 2.1 Personas

**Andy Dessy (Sales Manager / BD#1)** : daily scan matin, filtre par competitor engagement, action = create task + send Telegram broadcast.

**Paul Louis (Deputy CEO / BD#2)** : daily scan focus G1 HNWI Fiduciary + G2 Family Office, delegate via task assignment.

**Vernon Dessy (CEO)** : weekly review, vue stratégique des trends, decisions executive.

### 2.2 User flow Andy matin

1. Ouvre `/crm` → click "Intent Feed" depuis CRM hub
2. Page charge: 30 signaux des dernières 24h, triés par proxy score DESC
3. Top signal: "Maria Schmidt liked Mercury post" — 6pts
4. Click "View Contact" → vérifie infos CRM Maria Schmidt
5. Retour Intent Feed, click "Create Task" → modal pre-fill
6. Sauvegarde → toast "Task created"
7. Click "Mark Actioned" → signal disparaît du filter Unactioned
8. Repeat pour next 5-10 hot signals
9. Daily routine done en 15 min

### 2.3 User flow Vernon weekly

1. Ouvre Intent Feed
2. Filter: all sources, last 7 days, group G1 + G2
3. Analyse trends temporels + distribution sources
4. Decisions executive (adjust competitors list, ICP rules, etc.)

---

## 3. Architecture (post-recon)

### 3.1 Stack technique

```
Frontend:
  - Next.js 16.1.6 App Router (existant)
  - React Server Components (initial render)
  - Tailwind CSS (Diamond Platinum design)
  - Lucide icons
  - shadcn/ui components — recon validate: Dialog, Select, Badge, Button, Skeleton

Backend:
  - Next.js API routes (pattern existant /api/webhooks/* à reuse)
  - Prisma 5.22 (queries existing tables)
  - PostgreSQL Railway

Tables utilisées:
  - IntentSignal (FK CrmContact + SignalTypeRegistry)
  - CrmContact (with relations Company)
  - SignalTypeRegistry (codes, decay rules, labels)
  - Task (reuse pour Create Task action)
```

### 3.2 Routes structure

```
/crm/intent-feed                           ← Main page (default: today's signals)
/crm/intent-feed?source=trigify&days=7     ← URL params for shareable filters

API:
  GET  /api/intent-feed                    ← Paginated signals fetch
  GET  /api/signal-types                   ← Filter dropdown options
  POST /api/intent-feed/[id]/action        ← Mark actioned
  POST /api/intent-feed/send-telegram      ← Broadcast Telegram aux BDs

Existing routes reused:
  POST /api/tasks                          ← Create task (Sprint S0/S1)
  GET  /api/crm/contacts/[id]              ← Contact detail
```

### 3.3 Data flow

```
Page load (RSC)
  ↓
Server Component: fetch initial 30 signals via prisma.intentSignal.findMany
  ↓
Render <IntentFeedFilters /> + <SignalCard />[]
  ↓
Filter change (client component)
  ↓
router.push with new search params
  ↓
RSC re-renders with new data
  ↓
Action click (Create Task / Mark Actioned / Send Telegram)
  ↓
Modal opens or direct POST
  ↓
POST /api/intent-feed/[id]/action OR /api/intent-feed/send-telegram
  ↓
DB update + toast feedback
  ↓
UI loading state until refresh
```

### 3.4 Sorting strategy V1

Proxy score = `points × recencyBoost` :
- Last 24h signals : recencyBoost 1.5
- Last 7d signals : recencyBoost 1.0
- Older : recencyBoost 0.7

Computed server-side post-fetch, sorted in-memory.

**V2** : remplacer par vrai Priority Score (Phase 3 Andy).

### 3.5 Mark Actioned storage V1

V1 utilise `IntentSignal.metadata` JSONB field (existing, no migration needed) :
```json
metadata: {
  "actioned_at": "2026-05-15T14:32:00.000Z",
  "actioned_by": "vd@oxen.finance"
}
```

Filter status via Prisma JSON path :
```typescript
metadata: { path: ["actioned_at"], equals: Prisma.JsonNull }  // unactioned
```

**V2** : si performance bottleneck, ajouter `IntentSignal.actionedAt: DateTime?` field strict (migration).

---

## 4. V1 Scope — Détaillé

### 4.1 Page layout

```
┌─────────────────────────────────────────────────────────────────┐
│ CRM > Intent Feed                                                │
├─────────────────────────────────────────────────────────────────┤
│ [Sources: All ▼]  [Types: All ▼]  [Date: Last 7d ▼]              │
│ [Group: All ▼]    [Hot only: ☐]   [Status: Unactioned ▼]         │
│                                                                   │
│ Showing 28 signals · Sort: Proxy Score DESC                      │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔥 HOT  [Trigify · 14 May 14:32 · 6pts]                      │ │
│ │                                                               │ │
│ │ Maria Schmidt — CFO at GoldenBridge Fiduciary                │ │
│ │ Liked Mercury post: "Why founders are switching..."          │ │
│ │ G1 · UAE · Persona: DM · Pain Tier: P1                       │ │
│ │                                                               │ │
│ │ [View Contact]  [Create Task]  [Send Telegram]  [Mark Done]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ...                                                              │
│ [Load More]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Filters V1

| Filter | Options | Default |
|---|---|---|
| Source | All / Trigify / Clay / Manual | All |
| Signal Type | All / Multi-select (from /api/signal-types) | All |
| Date Range | Today / Last 24h / Last 7d / Last 30d | Last 7d |
| Group | All / G1 / G2 / ... / G7B | All |
| Hot only (toggle) | On / Off (proxy score > threshold) | Off |
| Status | All / Unactioned / Actioned | Unactioned |

**Filters EXCLUS V1** (V2) : Persona, Jurisdiction, "My signals".

### 4.3 Sort options V1

- Proxy Score DESC (default)
- Date DESC
- Date ASC

**V2** : Points DESC, Group, Tier.

### 4.4 Signal card content

Header :
- Hot badge (🔥 si proxyScore > 7.0)
- Source badge (Trigify / Clay / Manual)
- Date format simple ("14 May 14:32") — V1 pas relative time
- Points badge (X pts)

Body :
- Person name (large, link to /crm/contacts/[id]) — Title at Company
- Signal detail
- Tags : Group · Jurisdiction · Persona · Pain Tier

Actions (4 buttons) :
- View Contact → Link to /crm/contacts/[id]
- Create Task → Open <CreateTaskFromSignalModal />
- Send Telegram → Open <SendTelegramModal /> (broadcast aux BDs)
- Mark Actioned → POST + loading state + router.refresh()

### 4.5 Create Task modal

Reuse existing Task model + POST /api/tasks endpoint.

V1 link signal → task : via `description` string concatenation (pas de FK).
Format note : `Linked signal: <signal_id> · Source: trigify · Detail: ...`

**V2** : add `Task.signalId String?` FK pour vrai linking + retrieval bidirectionnel.

### 4.6 Send Telegram modal

**V1 broadcast model** : envoie le message à tous les BDs (CRM_BD_EMAILS env).

- Recipients display (read-only) : "Andy, Paul, Vernon (from CRM_BD_EMAILS)"
- Message textarea (pre-filled, editable)
- "Send to all BDs" button
- Endpoint : POST /api/intent-feed/send-telegram { signal_id, custom_message? }
- Logic : Promise.allSettled sur notifyEmployee() per BD
- Toast : "Telegram sent to 3 BDs (3 succeeded, 0 failed)"

**V2** : recipient selector, template library.

### 4.7 Mark Actioned

V1 : loading button state → POST → toast → router.refresh().

DB update via `jsonb_set` sur metadata field :
```sql
UPDATE "IntentSignal" 
SET metadata = jsonb_set(
  jsonb_set(COALESCE(metadata, '{}'::jsonb), '{actioned_at}', to_jsonb(NOW())),
  '{actioned_by}', to_jsonb(current_user_email)
)
WHERE id = $1
```

**V2** : Optimistic UI (signal moves to "Actioned" filter without reload).

---

## 5. Backend API design

### 5.1 GET /api/intent-feed

**Query params** :
- source (single or comma-separated)
- signal_type (single or comma-separated)
- date_from / date_to (ISO date)
- group (single or comma-separated)
- hot_only (true/false)
- status (unactioned / actioned / all, default unactioned)
- sort (proxy_score_desc / date_desc / date_asc, default proxy_score_desc)
- limit (1-100, default 30)
- offset (default 0)

**Response** :
```json
{
  "signals": [{
    "id": "cmp...",
    "signalType": "trigify_competitor_engagement",
    "signalLabel": "Engagement with competitor content",
    "source": "trigify",
    "title": "Liked Mercury post",
    "detail": "Liked competitor post about banking alternatives",
    "points": 6,
    "decayedPoints": 5.2,
    "proxyScore": 7.8,
    "isHot": true,
    "createdAt": "2026-05-15T14:32:00.000Z",
    "actionedAt": null,
    "actionedBy": null,
    "metadata": { "competitor_name": "Mercury", "post_url": "..." },
    "contact": {
      "id": "cmp...",
      "name": "Maria Schmidt",
      "jobTitle": "CFO",
      "persona": "DM",
      "group": "G1",
      "painTier": "P1",
      "lifecycleStage": "intent_sourced",
      "linkedinUrl": "...",
      "company": {
        "id": "cmp...",
        "name": "GoldenBridge Fiduciary",
        "jurisdiction": "UAE"
      }
    }
  }],
  "pagination": {
    "total": 247,
    "limit": 30,
    "offset": 0,
    "hasMore": true
  },
  "filters_applied": { ... }
}
```

### 5.2 GET /api/signal-types

Returns active SignalTypeRegistry entries.

```json
{
  "signal_types": [
    { 
      "code": "trigify_competitor_engagement", 
      "label": "Engagement with competitor content",
      "category": "INTENT",
      "defaultPoints": 6
    }
  ]
}
```

### 5.3 POST /api/intent-feed/[id]/action

Body : `{ "type": "mark_actioned" }`

Response :
```json
{
  "ok": true,
  "action_type": "mark_actioned",
  "signal_id": "cmp...",
  "actioned_at": "2026-05-15T14:35:00.000Z",
  "actioned_by": "vd@oxen.finance"
}
```

### 5.4 POST /api/intent-feed/send-telegram

Body : `{ "signal_id": "cmp...", "custom_message": "..." (optional) }`

Logic :
1. Fetch signal + contact + company
2. Build message (default template if no custom)
3. Read CRM_BD_EMAILS env
4. Promise.allSettled sur notifyEmployee()

Response :
```json
{
  "ok": true,
  "signal_id": "cmp...",
  "sent_to": ["ad@oxen.finance", "pg@oxen.finance", "vd@oxen.finance"],
  "succeeded": 3,
  "failed": 0
}
```

### 5.5 Performance considerations

- Initial render : RSC fetch 30 signals (~50ms query Prisma avec joins) — existing indexes suffisent
- Pagination : 30 per page, "Load More" button (V1 no infinite scroll)
- Sort proxy_score_desc : computed server-side post-fetch, sorted in-memory
- Index DB existing :
  - `IntentSignal_contactId_signalTypeId_createdAt_idx` ✅
  - `IntentSignal_companyId_signalTypeId_createdAt_idx` ✅
  - `CrmContact_linkedinUrl_idx` ✅ (Sprint Trigify Phase 2A)
- **V2** : may add `IntentSignal_createdAt_idx` standalone if scaling issues

---

## 6. Sprint Plan — 8 batches (~8h focus)

### 6.1 Architecture cible

```
src/app/crm/intent-feed/page.tsx               ← Page main (RSC)
src/app/crm/intent-feed/_components/
  ├── IntentFeedFilters.tsx                    ← Filter bar (client)
  ├── SignalCard.tsx                           ← Single signal display (server)
  ├── SignalCardActions.tsx                    ← Quick action buttons (client)
  ├── CreateTaskFromSignalModal.tsx            ← Task creation modal
  ├── SendTelegramModal.tsx                    ← Telegram broadcast modal
  └── LoadMoreButton.tsx                       ← Pagination control
src/app/api/intent-feed/route.ts               ← GET signals endpoint
src/app/api/intent-feed/[id]/action/route.ts   ← POST mark actioned
src/app/api/intent-feed/send-telegram/route.ts ← POST Telegram broadcast
src/app/api/signal-types/route.ts              ← GET filter dropdown options
src/lib/intent-feed/
  ├── query-builder.ts                         ← Build Prisma where from filters
  ├── proxy-score.ts                           ← Compute proxyScore for sorting
  ├── format-signal.ts                         ← Format signal for UI
  ├── format-date.ts                           ← Simple date format (V1)
  └── telegram-template.ts                     ← Default Telegram message template
```

### 6.2 Batch breakdown

| Batch | Effort | Description |
|---|---|---|
| **B1 — R2 Fix + helpers** | 30min | crm-config: add `intent_sourced` to LIFECYCLE_STAGES + format-date helper |
| **B2 — GET /api/intent-feed** | 1h | Route + Zod schema + tests (5-6 tests) |
| **B3 — GET /api/signal-types** | 30min | Filter dropdown options endpoint |
| **B4 — Page + filters** | 2h | Page RSC fork contacts/page.tsx, filters URL sync |
| **B5 — Signal card** | 1h | <SignalCard> inline component |
| **B6 — Create Task modal** | 1h | Modal + POST mark actioned + reuse POST /api/tasks |
| **B7 — Send Telegram modal** | 1h | Modal + POST broadcast route |
| **B8 — Polish + commit** | 30min | Hub link + manual QA + commit local |

**Total : ~8h focus en 1 journée**

### 6.3 Détails batches : voir prompt §8 ci-dessous

---

## 7. Decisions taken & pending

### Decisions taken (recon validated)

| Décision | Choix | Rationale |
|---|---|---|
| Naming | "Intent Feed" | Avoid confusion with Sentinel AI perso |
| Path URL | `/crm/intent-feed` | Sub-page CRM hub (V1 no sidebar entry) |
| Sorting V1 | Proxy score | No Phase 3 Scoring yet |
| Mark Actioned storage | `metadata.actioned_at` JSONB | No migration needed V1 |
| Send Telegram | Broadcast aux BDs (CRM_BD_EMAILS) | V1 simple, V2 selector |
| Filters V1 | 6 (source/type/date/group/hot/status) | Skip persona/jurisdiction/my-signals V1 |
| Date format | Simple "14 May 14:32" | V2 relative time |
| Mark actioned UI | Loading state + refresh | V2 optimistic |
| Task linking | Description string | V2 `Task.signalId` FK |
| Tests V1 | API only | V2 component tests RTL |
| Sidebar entry | NO V1 (link from /crm hub) | V2 if frequent usage |
| Hot signal threshold | proxyScore > 7.0 | Configurable later |

### Decisions pending (non-bloquantes)

**D1 — Andy validation visuelle V1** : show beta after sprint, iterate based on feedback. Non-bloquant.

**D2 — Hot signal threshold** : V1 = 7.0. Ajuster V2 selon stats.

---

## 8. Sprint Plan — Prompt Claude Code (ready-to-paste)

Une fois ce PRD reviewé, copy ce prompt dans Claude Code pour lancer le sprint :

```
Sprint Intent Feed UI (8 batches, ~8h focus).

CONTEXTE :
Trigify Phase 2A est live en prod (livré 2026-05-15). Les signaux 
Trigify + Clay sont ingestés en DB mais aucune UI pour BD (Andy, Paul) 
consommer ces signaux daily. Intent Feed = première feature UI consume 
des signaux. Recon faite, scope V1 ajusté.

OBJECTIF V1 :
Page /crm/intent-feed dans Oxen-OS où BD scannent daily les hot signals, 
filtrent par sources/types/groupes/date/hot, et déclenchent quick actions 
(View Contact / Create Task / Send Telegram broadcast / Mark Actioned).

FIX TRANSVERSE OBLIGATOIRE (R2) :
Les contacts auto-créés Trigify Phase 2A avec lifecycleStage="intent_sourced" 
ne sont pas dans LIFECYCLE_STAGES de src/lib/crm-config.ts (ou équivalent) 
→ invisibles dans filters UI lifecycle. Fix obligatoire en B1.

DÉCISIONS STRUCTURELLES VALIDÉES (PRD-003 v1.1):
- Path URL: /crm/intent-feed (sub-page CRM, no sidebar entry V1)
- Sorting V1: proxy score (points × decay × recency) en attendant Phase 3
- Mark Actioned storage: metadata.actioned_at JSONB (no DB migration V1)
- Send Telegram: broadcast aux BDs (CRM_BD_EMAILS env, no recipient selector)
- Filters V1: 6 selects (source/type/date/group/hot-only/status)
- SKIP V1: persona filter, jurisdiction filter, "my signals" filter, 
  relative time, optimistic UI, Task.signalId FK, sidebar entry, 
  component tests
- V1 tests: API routes only (pattern clay-enrichment)
- Distinction Sentinel AI (perso Vernon) vs Intent Feed (UI BD) — 
  pas de cross-pollination V1
- Hot signal threshold: proxyScore > 7.0
- Mode B strict (commit local + review avant push)

PRÉ-REQUIS LECTURE :
- reference/PRD_003_INTENT_FEED.md si présent (this doc)
- src/lib/crm-config.ts (pour R2 fix B1 — LIFECYCLE_STAGES)
- src/app/crm/contacts/page.tsx (pattern fork pour Intent Feed page B4)
- src/app/api/webhooks/trigify/route.ts (pattern API route récent)
- src/lib/telegram.ts (notifyEmployee helper pour B7)
- prisma/schema.prisma (IntentSignal + CrmContact + SignalTypeRegistry + Task)
- Composants UI existants src/components/ui/
- src/app/crm/page.tsx (hub pour B8 link)

Procède :

═══════════════════════════════════════════════════════════════════
BATCH 1 — R2 Fix + helpers (~30min)
═══════════════════════════════════════════════════════════════════

1. Identifier le fichier contenant LIFECYCLE_STAGES const 
   (probablement src/lib/crm-config.ts) via grep "LIFECYCLE_STAGES"

2. Add "intent_sourced" to LIFECYCLE_STAGES const array, position 
   après "new_lead":

   export const LIFECYCLE_STAGES = [
     "new_lead",
     "intent_sourced",  // NEW — added by Sprint Intent Feed (post-Trigify Phase 2A)
     // ... existing values
   ] as const

3. Verify usages: grep "LIFECYCLE_STAGES" dans le repo, check 
   que tous les usages benefit du fix (filter dropdowns, validation, 
   labels affichage).

4. Create src/lib/intent-feed/format-date.ts:
   - formatSignalDate(date: Date): string
   - Returns "14 May 14:32" format via Intl.DateTimeFormat
   - 2 unit tests dans format-date.test.ts

═══════════════════════════════════════════════════════════════════
BATCH 2 — GET /api/intent-feed (~1h)
═══════════════════════════════════════════════════════════════════

1. Create src/lib/intent-feed/proxy-score.ts:
   - HOT_SIGNAL_THRESHOLD export const = 7.0
   - computeProxyScore(signal): points × recencyBoost
     * recencyBoost: 1.5 (<24h), 1.0 (<7d), 0.7 (older)
   - isHot(proxyScore): true if > HOT_SIGNAL_THRESHOLD

2. Create src/lib/intent-feed/query-builder.ts:
   - buildIntentFeedWhere(filters): Prisma.IntentSignalWhereInput
   - Support: source, signal_type, date_from, date_to, group 
     (joins contact), status (metadata.actioned_at JSON path)

3. Create src/lib/intent-feed/format-signal.ts:
   - formatSignal(rawSignal with includes): IntentFeedSignal type
   - Compute proxyScore, isHot
   - Format contact + company nested
   - Extract actionedAt / actionedBy from metadata

4. Create src/app/api/intent-feed/route.ts (GET):
   - Zod schema for query params (filtersSchema)
   - Parse via searchParams.entries()
   - Build where via buildIntentFeedWhere()
   - prisma.intentSignal.findMany with includes 
     (contact + company + signalTypeRef)
   - Sort: in-memory by proxyScore if requested, else Prisma orderBy
   - Filter hot_only: in-memory post-fetch
   - Pagination via limit/offset
   - Return: { signals, pagination, filters_applied }

5. Tests src/app/api/intent-feed/route.test.ts (5-6 tests):
   - Empty filters → signals returned
   - Source filter (single + multiple)
   - Date range filter
   - Status unactioned vs actioned
   - Sort proxy_score_desc vs date_desc
   - Pagination hasMore

═══════════════════════════════════════════════════════════════════
BATCH 3 — GET /api/signal-types (~30min)
═══════════════════════════════════════════════════════════════════

1. Create src/app/api/signal-types/route.ts (GET):
   - Fetch active SignalTypeRegistry rows (isActive: true)
   - Return { signal_types: [{ code, label, category, defaultPoints }] }
   - Sort by code ASC

2. Tests (2 tests):
   - Returns only active types
   - Sorted alphabetically

═══════════════════════════════════════════════════════════════════
BATCH 4 — Page + filters (~2h)
═══════════════════════════════════════════════════════════════════

1. Create src/app/crm/intent-feed/page.tsx (RSC):
   - Read searchParams
   - Server-side fetch via internal fetch to /api/intent-feed
   - Header: breadcrumb CRM > Intent Feed + title + total count
   - <IntentFeedFilters />
   - signals.map(<SignalCard />)
   - <LoadMoreButton /> if hasMore
   - Empty state if 0 signals

2. Create src/app/crm/intent-feed/_components/IntentFeedFilters.tsx (client):
   - 6 selects (Source / SignalType / Date / Group / HotOnly toggle / Status)
   - SignalType dropdown fetches /api/signal-types on mount
   - URL params sync via useRouter + useSearchParams
   - On change: router.push(`/crm/intent-feed?${params}`)
   - Loading state during transition (useTransition)
   - "Clear filters" button if any filter set

3. Create src/app/crm/intent-feed/_components/LoadMoreButton.tsx (client):
   - Click → router.push with offset incremented
   - Disabled if !hasMore

4. Layout responsive desktop-first (max-w-5xl container)
   - Diamond Platinum theme (use existing classes from contacts/page.tsx)
   - Fork structure from contacts/page.tsx for consistency

═══════════════════════════════════════════════════════════════════
BATCH 5 — Signal card (~1h)
═══════════════════════════════════════════════════════════════════

Create src/app/crm/intent-feed/_components/SignalCard.tsx (server component):

1. Header:
   - HOT badge if signal.isHot
   - Source badge (colored variant per source)
   - Date formatted via formatSignalDate
   - Points badge

2. Person + Company:
   - Name as Link to /crm/contacts/[id]
   - Title + " at " + company.name (si présents)

3. Detail:
   - signal.detail or fallback signal.title

4. Tags (badges):
   - Group, Jurisdiction (if company.jurisdiction), 
     Persona, PainTier (si présents)

5. <SignalCardActions signal={signal} /> at bottom

═══════════════════════════════════════════════════════════════════
BATCH 6 — Create Task modal + Mark Actioned (~1h)
═══════════════════════════════════════════════════════════════════

1. Create src/app/crm/intent-feed/_components/SignalCardActions.tsx (client):
   - 4 buttons: View Contact (Link), Create Task (open modal), 
     Send Telegram (open modal), Mark Actioned (POST)
   - Track local state isActioning + isActioned
   - Mark Actioned: POST → toast → router.refresh()

2. Create src/app/crm/intent-feed/_components/CreateTaskFromSignalModal.tsx:
   - Reuse <Dialog> from @/components/ui
   - Pre-populated: title (e.g. "Follow up [name] - [signal source]"), 
     description (linked signal info string)
   - Form fields: due_date, assignee (dropdown employees), priority
   - On submit: POST /api/tasks (existing endpoint)
   - On success: close modal + toast "Task created"

3. Create src/app/api/intent-feed/[id]/action/route.ts (POST):
   - Auth check via getCurrentUser (or equivalent existing pattern)
   - Body: { type: "mark_actioned" }
   - Update IntentSignal.metadata via jsonb_set
   - Return { ok, action_type, signal_id, actioned_at, actioned_by }

4. Tests src/app/api/intent-feed/[id]/action/route.test.ts (3 tests):
   - mark_actioned: 200 + metadata updated
   - 404 if signal not found
   - 401 if not authenticated

═══════════════════════════════════════════════════════════════════
BATCH 7 — Send Telegram modal (~1h)
═══════════════════════════════════════════════════════════════════

1. Create src/lib/intent-feed/telegram-template.ts:
   - buildHotSignalMessage(signal): string with HTML formatting
   - Use escHtml from existing telegram.ts
   - Format: "🚨 Hot signal — [name]\n[group/jurisdiction]\n[detail]\n..."

2. Create src/app/crm/intent-feed/_components/SendTelegramModal.tsx:
   - Recipients display (read-only): "Andy, Paul, Vernon (from CRM_BD_EMAILS)"
   - Message textarea (pre-filled, editable)
   - "Send to all BDs" button
   - POST /api/intent-feed/send-telegram
   - On success: close + toast "Telegram sent to X BDs"

3. Create src/app/api/intent-feed/send-telegram/route.ts (POST):
   - Auth check
   - Body: { signal_id, custom_message? }
   - Fetch signal with contact + company includes
   - Build message (default template if no custom)
   - Read CRM_BD_EMAILS env, loop notifyEmployee with Promise.allSettled
   - Return { ok, sent_to, succeeded, failed }

4. Tests src/app/api/intent-feed/send-telegram/route.test.ts (3 tests):
   - 200 with default template
   - 200 with custom message
   - 404 if signal not found

═══════════════════════════════════════════════════════════════════
BATCH 8 — Polish + commit (~30min)
═══════════════════════════════════════════════════════════════════

1. Update src/app/crm/page.tsx hub:
   - Add new card/link "Intent Feed" pointing to /crm/intent-feed
   - Brief description "Daily signal consumption for BD"
   - Use existing hub card pattern (review existing cards layout)

2. Manual QA preview:
   - Open /crm/intent-feed → page loads with signals
   - Apply each filter → list updates
   - Click "Create Task" → modal opens with pre-fill → save → toast
   - Click "Mark Actioned" → signal updates → refresh shows actioned
   - Click "Send Telegram" → modal opens with message → send → toast
   - Verify R2 fix: contacts intent_sourced visible in /crm/contacts filter

3. Final checks:
   - npx tsc --noEmit (0 errors)
   - npx eslint . (0 new warnings)
   - npm test (X/X passing, 0 regression)
   - npm run build (exit 0)

4. Commit local:
   "feat(intent-feed): UI dashboard for BD signal consumption (V1)
   
   Page /crm/intent-feed displays IntentSignals from Trigify, Clay, and 
   manual sources, with filters (source, type, date, group, hot-only, 
   status) and quick actions (view contact, create task, send Telegram 
   broadcast, mark actioned). Sort by proxy score (points × decay × 
   recency) until Phase 3 Scoring Engine delivers real Priority Score.
   
   Includes R2 fix: adds 'intent_sourced' to LIFECYCLE_STAGES so Trigify 
   Phase 2A auto-created contacts are filterable in CRM UIs.
   
   Batches:
   - B1 R2 fix + helpers
   - B2-3 backend APIs (intent-feed + signal-types)
   - B4 page + filters with URL sync
   - B5 signal card inline
   - B6 Create Task modal + Mark Actioned
   - B7 Send Telegram broadcast modal
   - B8 CRM hub link + manual QA
   
   Refs: PRD-003 Intent Feed Pre-Spec v1.1, Brief Andy roadmap #3"

5. STOP avant push, me montrer:
   - Diff complet
   - Output tests + build + lint
   - Confirmation commit local

Procède.
```

---

## 9. Out of scope V1 — backlog futurs sprints

### Sprint Intent Feed V2 (~1 jour, plus tard)
- Sidebar entry top-level
- Component tests RTL (vitest + @testing-library/react)
- `Task.signalId` FK schema migration
- Active filter badges chip UI ("X to remove")
- Optimistic mark-actioned (no full refresh)
- Relative time display ("2h ago")
- Index DB additionnels si volume scaling
- `CrmContact.dealOwnerEmployeeId` FK migration
- "My signals" filter (post-FK migration)
- Persona / Jurisdiction filters
- Send Telegram recipient selector
- Saved filter presets ("My morning view")
- Export CSV signaux filtered

### Sprint Sentinel × Intent Feed Connection (V2-V3)
- API key auth flexible pour external agents
- Sentinel AI (perso Vernon) read /api/intent-feed
- Endpoint `/api/intent-feed/brief?for=vernon` (top N + AI summarization)
- Vernon morning Telegram brief includes business signals synthesis

### Sprint Phase 3 Scoring Integration (post-Andy decisions)
- Replace proxy score by real Priority Score
- Add Tier badges (T1/T2/T3/Monitoring)
- Filter by Tier
- Sort by Tier + Priority Score
- Auto sequence Lemlist trigger on tier transition

### Sprint Intel Page (feature #5, ~2-3 jours)
- Per-contact view: all signals timeline + engagement history
- Link from Intent Feed signal card → Intel Page contact

---

## 10. Risks & mitigations

### Risk R1 — Volume signals élevé saturating la page V1
- **Severity** : Medium
- **Probability** : Low (Trigify volume estimé 50-200 signals/day max)
- **Mitigation** : Pagination 30 per page + filter hot-only + status unactioned
- **Trigger V2 escalation** : si > 500 unactioned signals stable pendant 2 semaines

### Risk R2 — intent_sourced orphelin ✅ ADDRESSED B1
- **Severity** : High (filters UI lifecycle broken pour Trigify contacts)
- **Status** : Fixed as B1 of this sprint

### Risk R3 — Tests UI components skipped V1
- **Severity** : Low
- **Probability** : Medium (manual QA might miss edge cases)
- **Mitigation** : Manual QA en B8 + API tests robustes V1 + monitoring prod logs

### Risk R4 — Send Telegram fails silently
- **Severity** : Medium
- **Probability** : Low (notifyEmployee battle-tested)
- **Mitigation** : Promise.allSettled + summary { succeeded, failed } in response

### Risk R5 — Mark Actioned race condition (2 BDs click same signal)
- **Severity** : Low
- **Probability** : Low (small team, async clicks rare)
- **Mitigation** : Last-write-wins acceptable V1, audit trail via metadata.actioned_by

---

## 11. References

### Documents repo (existants)
- `reference/PRD_001_MAPPING.md` v3.7 — Group routing G1-G7B
- `reference/PRD_002_TRIGIFY_PRESPEC.md` v1.2 — Trigify Phase 2A (livré)
- `reference/OXEN_OS_ROADMAP_OVERVIEW.md` — Master roadmap 14 features
- `reference/JOURNAL_2026_05_07.md` — 7 sprints livrés
- `reference/JOURNAL_2026_05_15.md` — Trigify Phase 2A livré

### Code patterns à réutiliser (identifiés par recon)
- `src/app/crm/contacts/page.tsx` — fork structure pour Intent Feed page
- `src/app/api/webhooks/trigify/route.ts` — API route pattern récent
- `src/app/api/webhooks/clay-enrichment/route.test.ts` — Test pattern
- `src/lib/telegram.ts` — notifyEmployee helper
- `src/components/ui/*` — shadcn components (Select, Dialog, Badge, Button)
- `src/lib/crm-config.ts` — LIFECYCLE_STAGES (R2 fix B1)

### Design system
- Diamond Platinum + Rose Gold #C08B88
- Bellfair (titres) + DM Sans (corps)
- Void #060709 background, card #0F1118
- Dark-first

---

## Changelog

- **v1.0** (2026-05-15 morning) — initial pre-spec post-Trigify Phase 2A. 6 batches plan, no recon.
- **v1.1** (2026-05-15 afternoon) — integration recon findings:
  - 8 batches détaillés (vs 6 v1.0)
  - R2 fix `intent_sourced` orphelin intégré B1 (risque critique identifié)
  - Scope V1 ajusté: skip persona/jurisdiction/"my signals" filters
  - Send Telegram = broadcast aux BDs (CRM_BD_EMAILS) au lieu de recipient selector
  - Mark Actioned storage = metadata.actioned_at JSONB (no migration V1)
  - Path final `/crm/intent-feed` (sub-page CRM hub, no sidebar entry V1)
  - Tests V1 = API only (no component tests RTL)
  - Section 10 Risks ajoutée (R1-R5)
  - Section "Decisions taken" enrichie (12 entries)
  - Total sprint estimate maintenu ~8h focus
