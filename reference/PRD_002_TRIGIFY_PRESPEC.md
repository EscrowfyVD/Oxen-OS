# PRD-002 — Trigify Integration Phase 2A

**Version** : v1.1 — pré-spec (with Trigify Listening doc findings)  
**Date** : 2026-05-14 (Thu)  
**Auteur** : Vernon Dessy + Claude (audit pré-sprint)  
**Status** : 📋 Ready for review → Sprint code (~6-8h focus, Option β)  
**Audience** : Vernon (self-reference), PM futur, Andy (transparency), Johnny Le (si pair-programming)

---

## Executive Summary

Sprint **Trigify Phase 2A** = première vraie feature data IN de signaux LinkedIn en temps réel dans Oxen OS. Sortie attendue : pipeline `Trigify Listening → Workflow → HTTP push → Oxen-OS /api/webhooks/trigify → IntentSignal persisted → BD Telegram alert`.

**Estimation effort** : 6-8h focus en 1 journée (Option β du roadmap).

**Préreq côté Vernon** :
- Plan Trigify validé (Essential $149/mo recommandé, free trial expire 2026-05-21)
- 9 profiles ajoutés en Listening Profile Monitoring
- 1 workflow configuré (Webhook Trigger → HTTP Request node)
- 1 sample event reçu côté Oxen-OS pour valider le payload réel

**Préreq côté Andy** (3 questions business — non bloquant) :
- Liste finale des 6 competitors
- BD assignment pour alerts (broadcast vs random vs mapping)
- Sequence interruption Phase 1 ou Phase 3

---

## 1. Context & Objectives

### 1.1 Why Trigify

Citation du brief Andy (Trigify_Brief.docx §1.1) :

> "Our outbound strategy is built on a core principle: timing beats copywriting. Contacting someone the day they show a buying signal is 5-10x more effective than contacting them cold on a random Tuesday."

Sans Trigify : Andy & Paul envoient des sequences sur des cadences fixes, sans data temps réel sur ce que font les prospects.

Avec Trigify : real-time LinkedIn signals (engagement competitor pages, OXEN posts, role changes) flow into Oxen OS CRM, update Intent Score, trigger immediate BD action.

### 1.2 Place dans la roadmap 14 features Andy

```
🟢 Sprint Trigify Phase 2A     = feature #1 du roadmap "Signal Sources"
🟡 Sprint Apify + n8n          = feature #2 (suite logique, ~1 semaine)
🟡 Sprint Intel Page            = feature #5 (consume signals Trigify+Apify)
🔴 Sentinel Feed (#4)           = UI dashboard "hot signals" (sprint dédié plus tard)
🔴 Scoring Engine (#3 Phase 3)  = bloqué Andy push réel, scope plus tard
```

→ **Trigify est le déclencheur** du data flow signaux. Sans lui, le scoring engine et Sentinel Feed n'ont rien à scorer/afficher.

### 1.3 Cycle 1 timeline

Andy a planifié un "Cycle 1" d'outbound pour démarrer le push Lemlist réel. Trigify doit être **opérationnel avant Cycle 1** pour collecter les premiers signaux dès le démarrage. Timeline cible : Trigify live d'ici fin mai 2026.

### 1.4 Free trial Trigify expire 2026-05-21 (jeudi prochain)

Décision plan à prendre **avant le 21 mai**. Options :
- **Essential $149/mo** — recommandé brief Andy pour Cycle 1
- **Growth $270/mo** — si volume signal élevé
- **Scale $549/mo** — si plusieurs Cycles parallèles

→ **Recommandation** : Essential pour démarrer, upgrade après Cycle 1 selon volume observé.

### 1.5 ⚠️ Credit-based pricing (NEW v1.1)

**Discovery** : Trigify charge **1 credit per post returned** par search run (source : help.trigify.io filtering doc).

**Implication** :
- Max Results = 50 posts/run × 9 sources × Daily run = **13,500 credits/mois max possible**
- En réalité, beaucoup moins (Profile Monitoring ne génère pas 50 posts/jour par profil — plutôt 1-10)
- Estimation V1 réaliste : **2-5K credits/mois**

**Action préalable au choix plan (D1)** :
- Vérifier dans `Manage Plan` Trigify combien de credits inclut chaque tier (Essential / Growth / Scale)
- Comparer au budget V1 estimé (2-5K credits/mois)
- Décider si Essential suffit ou si Growth nécessaire pour buffer

**Mitigation V1 si budget serré** :
- Réduire Max Results : 50 → 25 par run
- Réduire fréquence : Daily → 2x/semaine
- Privilégier les sources high-value (Mercury + Wise + OXEN page) avant les autres


---

## 2. Architecture Trigify (research findings)

### 2.1 Modèle mental — 3 couches

```
┌─────────────────────────────────────────────────────────────────────┐
│ BUILD — AI Conversational Assistant (Jarvis)                        │
│   Interface chat "Monitor your audience"                             │
│   Crée Listening + Workflows automatiquement à partir d'un prompt   │
│   Skip pour setup pro — config directe préférée                     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ LISTENING — "Le moteur de recherche" (continuous data source)        │
│                                                                       │
│   Profile Monitoring (notre choix V1)                                │
│     ├── Business Network company/profile URLs                        │
│     ├── X profiles                                                   │
│     ├── YouTube channels                                             │
│     ├── Substack publications                                        │
│     └── Podcast shows                                                │
│                                                                       │
│   Keyword Searches (V2 plus tard)                                    │
│     ├── Boolean queries (AND/OR/NOT, max 6 keywords)                 │
│     └── Topics across platforms                                      │
│                                                                       │
│   Output : posts apparaissent dans dashboard Trigify                 │
│   ⚠️ Listening seul ne fait RIEN — il faut un Workflow connecté     │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ WORKFLOWS — "L'assembly line" (automation)                          │
│                                                                       │
│   Triggers disponibles :                                              │
│     ├── New Post Trigger      ← notre choix V1                       │
│     ├── Signal Created Trigger                                       │
│     ├── Scheduled Trigger     (cron-style)                          │
│     ├── Multi Post Trigger    (multi-source)                        │
│     └── Webhook Trigger       (HTTP inbound, mauvais sens)          │
│                                                                       │
│   Action nodes :                                                      │
│     ├── Filter (AI Agent) — sentiment, keywords, ICP fit            │
│     ├── Enrich (email, phone) — via 18 data providers               │
│     ├── HTTP Request node     ← notre choix V1 (push vers Oxen-OS)  │
│     ├── Native integrations : HubSpot, Clay, Smartlead, Lemlist,    │
│     │   Instantly, HeyReach, La Growth Machine, Breakcold           │
│     └── Slack notifications                                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ HTTP POST
                  https://os.oxen.finance/api/webhooks/trigify
                                  │
                                  ▼
                       Oxen-OS receives + processes
```

### 2.2 Mode push vs Mode pull

Trigify supporte **2 modes** :

**Mode A — Push event-driven** (notre choix) :
- Workflow inclut un HTTP Request node → POST vers ton endpoint
- Trigger sur New Post de Listening
- Temps réel, pas de polling

**Mode B — Pull API GET** (skip V1) :
- `GET /api/sdr/<UniqueSDRCode>/leads -H "x-api-key: <key>"`
- Polling externe (cron job) pour récupérer les leads
- Plus simple à implémenter mais moins réactif

→ **Décision Mode A** pour V1. Compatible avec l'archi du webhook `/api/webhooks/trigify` déjà en place côté Oxen-OS.

### 2.3 Variables Trigify disponibles dans HTTP Request node

D'après help.trigify.io/articles/9504542-http-request :

```
{{firstName}}     - Prénom de la personne
{{lastName}}      - Nom de famille
{{email}}         - Email (si enriched côté Trigify)
{{text}}          - Contenu du post engagé
{{postUrl}}       - URL du post
{{sentiment}}     - Sentiment (positive/negative/neutral)
```

⚠️ **Variables incertaines** (à confirmer au moment du setup) :
- `{{title}}` — job title de la personne
- `{{companyName}}` — company de la personne
- `{{companyUrl}}` — LinkedIn company URL
- `{{profileUrl}}` — LinkedIn profile URL
- `{{timestamp}}` — date du signal
- `{{sourceProfile}}` — quel profil monitoré a généré le signal (= competitor name)

→ **Action validation** : au moment de configurer le HTTP Request node, tester avec **tous les fields possibles** et observer ce qui arrive côté Oxen-OS.

### 2.4 Time Frame mechanics — overlap coverage (NEW v1.1)

**Source** : help.trigify.io filtering doc.

> "The time frame is the lookback period, not how often the search runs. For example, a search running Daily with a Last week time frame will check the last 7 days of posts every day. This overlapping coverage ensures no posts slip through between runs."

**Implications pour Oxen-OS** :

| Time Frame | Behavior | Duplicates risk |
|---|---|---|
| Last 24 hours | Each daily run rescans last 24h | LOW (1 day overlap max) |
| Last week (default) | Each daily run rescans 7 days | **HIGH (6 days overlap)** |
| Last month | Each daily run rescans 30 days | **VERY HIGH (29 days overlap)** |
| All time | Each run rescans everything | **EXTREME** |

→ **Conséquence critique** : avec Time Frame "Last week" (recommandé Trigify default), **chaque post engagé sera envoyé à notre webhook 7 jours de suite**.

**Sans déduplication côté Oxen-OS** :
- 1 post engagé = 7 IntentSignals créés en 7 jours
- Score artificiellement gonflé × 7
- DB pollution + alerting Telegram répété × 7

→ **Action critique Sprint Code** : ajouter logique idempotence (voir Batch 2.5 §6.3.5).

### 2.5 Job Title Filter — 6 max per search (NEW v1.1)

**Source** : help.trigify.io filtering doc.

> "Add up to 6 job titles per search"

**Implication brief Andy §5.4** : le brief liste **15+ job titles cibles** :
- CFO, COO, CEO, Managing Director, General Manager (5)
- Head of Finance, Finance Director, Treasury Manager (3)
- Compliance Officer, Head of Compliance, Chief Compliance Officer (3)
- Managing Partner, Senior Partner, Founding Partner (3)
- Head of Client Services, Client Relationship Director (2)

→ **16 titles** but **max 6 per search**.

**Décision V1 — prioritization** :

3 stratégies possibles :

**A. Multi-searches** (créer 3 saved searches avec 6 titles chacune) :
- Search 1 "Decision Makers Finance" : CFO, COO, CEO, Managing Director, Finance Director, Treasury Manager
- Search 2 "Decision Makers Compliance" : Compliance Officer, Head of Compliance, Chief Compliance Officer, Managing Partner, Senior Partner, Founding Partner
- Search 3 "Operational" : General Manager, Head of Finance, Head of Client Services, Client Relationship Director, (2 slots libres)

→ **Coût 3x credits** mais full coverage.

**B. Top 6 prioritized** (1 search, focus high-value titles) :
- CFO, CEO, Managing Director, Compliance Officer, Head of Finance, Managing Partner

→ Coût 1x credits, manque 10 titles mais hit les profils les plus valuables (Decision-Makers + Compliance).

**C. No filter V1** (capture tout, filter côté Oxen-OS scoring) :
- Skip Job Title Filter dans Trigify
- Tous les engagements sont captured
- Filter côté Oxen-OS : `Contact.persona === "DM" || "OP"` (Sprint S0.5 segmentation)

→ Coût 5-10x credits (volume élevé), mais simpler config, all data captured.

**Recommandation V1** : **Stratégie B** (Top 6 prioritized).
- Démarrage budget-controlled
- Hit les profils les plus valuables (alignement PRD-001 G1-T1 DM persona)
- Évolution V2 : étendre à stratégie A après stats Cycle 1



---

## 3. V1 Scope Decision

### 3.1 Scope INCLUS V1

```
✅ Profile Monitoring on Business Network (LinkedIn) — 9 sources
   ├── 6 competitor pages (engagement on their posts)
   │   - Mercury
   │   - Relay Financial
   │   - Wise Business
   │   - Payoneer
   │   - Airwallex
   │   - BVNK
   │
   ├── 1 OXEN company page
   │   (engagement on Oxen content = direct buying signal)
   │
   └── 2 BD profiles
       - Andy Dessy LinkedIn
       - Paul Louis (Paul Garreau) LinkedIn
       (engagement on their personal posts = personal connection)

✅ 1 Workflow "Linkedin oxen" (déjà draft chez toi)
   Trigger: New Post
   Action: HTTP Request POST vers /api/webhooks/trigify
   
✅ Webhook Oxen-OS refactored:
   - Mapping signal_type → SignalTypeRegistry canonical codes (7 entries)
   - LinkedIn URL matching prioritaire (avec fallback email + name+company)
   - Auto-create contact si no match (marqué "intent-sourced")
   - Telegram alert BDs sur immediate triggers
   - Tests + doc
```

### 3.2 Scope EXCLU V1 (out of scope sprint cette journée)

```
❌ Listening Keyword Searches
   = V2, après que Profile Monitoring marche
   
❌ Dashboard "hot signals" UI
   = Sentinel Feed feature #4 du roadmap, sprint dédié ~2-3 jours
   
❌ Sequence interruption flag (pause Lemlist)
   = nouveau field DB CrmContact.sequencePaused + sync Lemlist update
   = sprint dédié ~3-4h, dépend décision Andy (Phase 1 vs Phase 3)
   
❌ Priority Score auto-recalculation
   = bloqué Phase 3 Scoring (besoin ICP scoring rules Andy)
   = pas avant Cycle 1 réel
   
❌ Tier threshold transitions auto
   = bloqué Phase 3
   
❌ AI Filter node (sentiment, ICP fit) côté Trigify Workflow
   = V2, optimisation après V1 fonctionnel
```

### 3.3 Pourquoi ce scope V1

Le scope minimum pour avoir **un pipeline data IN fonctionnel** :
- Trigify push les signals
- Oxen-OS reçoit, persist en IntentSignal avec bon scoring
- BDs alerted sur hot signals critiques
- Le data est dispo pour Sentinel Feed (#4) et Scoring (#3) plus tard

→ **MVP Trigify = data ingestion validated, pas encore d'UI consumption.**

---

## 4. Code Oxen-OS — État actuel (audit findings)

Audit pré-sprint effectué 2026-05-14 matin via Claude Code. Rapport détaillé inclus dans la conversation principale (peut être référencé séparément si besoin).

### 4.1 `/api/webhooks/trigify/route.ts` — EXISTE déjà (Sprint S1)

**Fichier** : 100 lignes, 3505 bytes.

**Structure actuelle** :
```typescript
// Authentication
requireWebhookSecret(request, { envVarName: "TRIGIFY_WEBHOOK_SECRET" })
// → 401 si absent

// Validation
validateBody(request, trigifyWebhookSchema, { publicErrors: false })
// → 400 silencieux

// Logique
1. Match contact via email seul (findFirst case-insensitive)
2. Si absent → crée un CrmContact minimal:
   - firstName/lastName parsé depuis name/email
   - acquisitionSource: "Other"
   - acquisitionSourceDetail: "Trigify"
   - lifecycleStage: "new_lead"
   - createdBy: "webhook:trigify"
3. Upsert SignalTypeRegistry par code "trigify_intent_signal"
   (placeholder, 15pt / 90j LINEAR / INTENT)
4. prisma.intentSignal.create:
   - expiresAt = now + 90j
   - points = score ?? 15
   - signalType = signal_type || "job_change"
5. Recalcule relationshipScore = somme points actifs, capé à 100

// Response
Toujours { ok: true } 200 (même si email absent ou erreur catch)
```

**Schéma Zod actuel** (`_schemas.ts:58-66`) :
```typescript
trigifyWebhookSchema = z.object({
  email: z.string().optional(),
  signal_type: z.string().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
  score: z.number().min(0).max(1000).optional(),
  name: z.string().optional(),
  company: z.string().optional(),
})
```

→ **Très basique**. Manque tous les fields du brief (LinkedIn URLs, signal_date, competitor_name, etc.).

**À refactorer en Sprint Phase 2A** :
- Élargir Zod schema avec les 11 fields du brief
- Remplacer match email seul par LinkedIn URL prioritaire + fallback
- Remplacer placeholder `trigify_intent_signal` par codes canonical Trigify
- Ajouter Telegram alert pour immediate triggers
- Ajouter logging structuré

### 4.2 SignalTypeRegistry — 7 entries seedées

**Script** : `scripts/db/seed-signal-types.ts` (idempotent, update: {} pour préserver tweaks opérateurs)

**4 CANONICAL_SEEDS** :

| code | category | defaultPoints | decayDays | decayCurve |
|---|---|---|---|---|
| `clay_business_loss` | INTENT | 10 | 90 | LINEAR |
| `clay_director_change` | INTENT | 20 | 60 | LINEAR |
| `linkedin_post_funding` | INTENT | 30 | 30 | EXPONENTIAL |
| `market_country_regulation_change` | MARKET | 50 | 180 | STEP |

**3 PLACEHOLDER_SEEDS** :

| code | category | defaultPoints | decayDays | decayCurve |
|---|---|---|---|---|
| `clay_legacy_intent` | INTENT | 10 | 90 | LINEAR |
| `trigify_intent_signal` | INTENT | 15 | 90 | LINEAR |
| `n8n_external_signal` | INTENT | 10 | 90 | LINEAR |

→ **Pour Trigify** : seul `trigify_intent_signal` placeholder existe. **À étendre** avec 7 codes per-signal-type (voir §5.1 mapping).

### 4.3 Prisma `CrmContact` — fields LinkedIn

**Présent** :
- `linkedinUrl String?` (`schema.prisma:375`) — nullable, **pas unique**, **pas d'index**

**Absent** :
- `linkedinId`, `linkedinSlug`, `linkedinProfileId` → pas de canonical ID
- Index sur `linkedinUrl` (à ajouter Sprint Phase 2A B1)

**Indexes actuels** Contact : `companyId`, `lifecycleStage`, `group`, `painTier`, `persona`.

→ **Action B1** : add index `CrmContact_linkedinUrl_idx` pour matching performance.

### 4.4 `signal-ingestion.ts` lib (Sprint S1 batch 4)

**Signature** :
```typescript
export async function ingestSignal(
  payload: SignalIngestionPayload,
): Promise<IngestSignalResult>
```

**Cas `scope='contact'`** : matche par `payload.contactId` (findUnique) **uniquement**. Aucun support `linkedinUrl`, aucun support `email`.

→ **Pour Trigify** : ce helper **ne peut pas être utilisé tel quel** car Trigify n'envoie pas `contactId`. Soit on étend le helper pour supporter `{ linkedinUrl, email, nameCompany }`, soit on garde la logique inline dans le webhook (recommandé V1).

### 4.5 `telegram.ts` lib

**Exports** :
```typescript
sendTelegramMessage(chatId, text, parseMode?)        // low-level
sendTelegramNotification(employeeId, message)        // by Employee.id
sendTelegramNotificationByEmail(email, message)      // by Employee.email
notifyEmployee(employeeIdOrEmail, message)           // universal
formatBriefForTelegram(brief)                        // meeting-specific
escHtml(text)                                        // HTML escape
setWebhook(url, secretToken)                         // setup
```

→ **Pour Trigify Telegram alerts** : utiliser `notifyEmployee(emailOrId, message)` en bouclant sur `CRM_BD_EMAILS` env var (broadcast aux BDs).

### 4.6 Company assignment — PAS de `dealOwnerId` ni `assignedBdId`

`Company` model n'a **aucun field d'ownership BD**.

**Patterns disponibles** :
- `CrmContact.dealOwner String?` — nom display ("Andy", "Paul Louis", "Vernon"), pas FK
- `Deal.dealOwner String` — idem, indexed
- `assignRandomBD()` dans `clay-enrichment.ts:52-72` — lit `CRM_BD_EMAILS` env, retourne `Employee.id` random

→ **Décision V1 Trigify alerts** : 2 options possibles
1. **Broadcast** à tous les BDs actifs (boucle sur CRM_BD_EMAILS)
2. **assignRandomBD()** si un seul destinataire suffit

**Recommandation** : broadcast V1 (tous les BDs voient l'alert). Phase ultérieure : si volume signal élevé → routing par `assignedBdId` field à créer.

→ **Question pending Andy** (voir §7).

### 4.7 Pattern test webhook clay-enrichment

**Référence** : `src/app/api/webhooks/clay-enrichment/route.test.ts`

**Pattern à reproduire pour Trigify** :
```typescript
vi.mock("@/lib/prisma", () => ({
  prisma: {
    company:            { findUnique, create, update },
    crmContact:         { findFirst, findUnique, create, update },
    employee:           { findUnique, findMany },
    signalTypeRegistry: { findUnique },
    intentSignal:       { create },
    marketSignal:       { create },
  },
}))

function makeReq(body, opts) {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (opts.secret !== null) headers.set("x-webhook-secret", SECRET)
  return new Request("http://localhost/api/webhooks/trigify", {
    method: "POST", headers, body: JSON.stringify(body),
  })
}

beforeAll(() => { process.env.TRIGIFY_WEBHOOK_SECRET = SECRET; ... })
afterAll(() => { /* restore */ })
beforeEach(() => { vi.clearAllMocks(); /* default mocks */ })
```

Tests numérotés `[1]`, `[2]`... avec sections par concern :
- `─── Auth ───`
- `─── Zod validation ───`
- `─── scope=contact (LinkedIn URL match) ───`
- `─── scope=contact (email fallback) ───`
- `─── scope=contact (auto-create) ───`
- `─── Telegram alerts (immediate triggers) ───`
- `─── Signal type mapping ───`

### 4.8 `TRIGIFY_WEBHOOK_SECRET` — déjà câblé

- `.env.example:137` : `TRIGIFY_WEBHOOK_SECRET=""` (vide, marqué REQUIRED)
- Côté Railway prod : déjà set
- Côté local `.env` (nouveau Mac post-switch) : présent (récupéré depuis Railway le 14 mai)
- Une seule référence code : `route.ts:9`

→ **Pas de changement env vars** dans Sprint Phase 2A. Tout est en place.

---

## 5. Setup Trigify side (Vernon to do BEFORE sprint code)

### 5.1 Step 1 — Choose plan

**Décision pending** : Essential / Growth / Scale / wait trial.

**Action** :
1. Trigify → `Manage Plan` → choose Essential ($149/mo)
2. Add credit card
3. Confirm

**Timeline** : avant 2026-05-21 (free trial expires).

**Risk si pas fait** : workflows désactivés à l'expiration, **pipeline data IN cassé**.

### 5.2 Step 2 — Profile Monitoring setup (Listening)

**Navigation** : sidebar Trigify → Listening → Profile Monitoring (ou direct via Build wizard).

**9 profiles à ajouter** :

#### Groupe "Competitors" (6 sources)

| Competitor | LinkedIn URL |
|---|---|
| Mercury | `https://www.linkedin.com/company/mercury-bank/` |
| Relay Financial | `https://www.linkedin.com/company/relayfi/` |
| Wise Business | `https://www.linkedin.com/company/wiseaccount/` |
| Payoneer | `https://www.linkedin.com/company/payoneer/` |
| Airwallex | `https://www.linkedin.com/company/airwallex/` |
| BVNK | `https://www.linkedin.com/company/bfrancpay/` |

→ **Question pending Andy** : confirme cette liste de 6 ou ajuste.

#### Groupe "OXEN" (3 sources)

| Source | LinkedIn URL |
|---|---|
| OXEN company page | À confirmer (probablement `https://www.linkedin.com/company/oxen-finance/` ou similar) |
| Andy Dessy profile | À récupérer LinkedIn URL Andy |
| Paul Louis profile | À récupérer LinkedIn URL Paul Garreau |

**Action préalable** : récupérer les 3 URLs LinkedIn de Andy/Paul/OXEN page.

**Sync time** : Trigify scan toutes les X heures (config dans l'UI). Recommandation : **2 fois par jour** (matin + soir) pour balance fraîcheur vs credit usage.

**Important** : Trigify collecte engagement data des **7 derniers jours** au moment du setup (source : help.trigify.io). Donc une fois ajoutés, on récupère rétroactivement la semaine passée.

### 5.2.5 Step 2.5 — Search configuration filters (NEW v1.1)

**Source** : help.trigify.io filtering doc.

Pour chaque saved search Profile Monitoring (les 9 sources), configurer les filtres pour optimiser credits + quality.

#### Time Frame

**Recommandation V1** : **"Last 24 hours"** (pas "Last week" default).

**Rationale** :
- Daily run avec Last 24h = 1 jour overlap max = duplicates risk LOW
- Last week (default) = 6 jours overlap = duplicates risk HIGH (voir §2.4)
- Pour Profile Monitoring, on cherche engagements **récents** (timing beats copywriting brief Andy)

**V2 evolution** : si volume signal trop faible, étendre à "Last week" avec dedup côté Oxen-OS (§6.3.5).

#### Job Title Filter — Top 6 prioritized (Stratégie B, §2.5)

**6 titles V1** :
1. CFO
2. CEO
3. Managing Director
4. Compliance Officer
5. Head of Finance
6. Managing Partner

**Rationale** :
- Align brief Andy §5.4 + PRD-001 G1-T1 DM persona prioritization
- Coût 1x credits (vs 3x si multi-searches)
- High signal-to-noise ratio (decision-makers only)

#### Content Type

**Recommandation V1** : leave empty (capture all content types).

#### Sort By

**Recommandation V1** : `Date Posted` (default — most recent first).

#### Max Number of Results

**Recommandation V1** : **25** (vs 50 default).

**Rationale** :
- 9 sources × 25 max × Daily = 6,750 credits/mois max théorique
- En pratique, Profile Monitoring sur 9 pages → ~50-200 engagements/jour total
- 25 max suffit pour capturer engagements significatifs sans gaspiller credits

**V2 evolution** : monitor credit usage 1 semaine, ajuster :
- Si Max Results saturé chaque run → upgrade à 50
- Si Max Results jamais saturé → baisse à 15 pour save credits

#### Recap V1 search config

| Param | V1 value | Rationale |
|---|---|---|
| Time Frame | Last 24 hours | Minimize duplicates overlap |
| Job Title Filter | Top 6 (Stratégie B) | Decision-makers focus |
| Content Type | (empty) | Capture all types |
| Sort By | Date Posted | Default OK |
| Max Results | 25 | Budget-controlled, ajustable V2 |
| Sync Frequency | Daily | Balance fraîcheur/credits |

→ Estimation total : **5,000-8,000 credits/mois** (besoin de confirmer credits inclus Essential plan).

### 5.3 Step 3 — Workflow "Linkedin oxen" configuration

**État actuel** : Workflow draft existant, sans trigger configuré.

**Configuration cible** :


```
Workflow: "Linkedin oxen"
Status: Disabled (draft) → Enabled (after testing)

┌─────────────────────────────────────────────────┐
│ TRIGGER: New Post Trigger                       │
│   Source: Profile Monitoring (the 9 profiles)   │
│   Trigger when: new like/comment detected       │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│ (optional V1) FILTER: AI Agent                  │
│   Filter by:                                    │
│     - Seniority ≥ Manager                       │
│     - Geo: UAE / Cyprus / Malta / EU            │
│     - ICP fit (fiduciary / CSP / accountant)    │
│   → V1 SKIP, ajouter V2 après stats Cycle 1     │
└─────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│ ACTION: HTTP Request node                       │
│                                                 │
│   Method: POST                                  │
│   URL: https://os.oxen.finance/api/webhooks/trigify │
│                                                 │
│   Headers:                                      │
│     Content-Type: application/json              │
│     x-webhook-secret: <TRIGIFY_WEBHOOK_SECRET>  │
│                                                 │
│   Body JSON: voir §5.4 ci-dessous              │
└─────────────────────────────────────────────────┘
```

### 5.4 Step 4 — HTTP Request body mapping (the critical part)

**Format strict brief Andy (11 fields)** :

```json
{
  "signal_type": "competitor_engagement",
  "signal_source": "trigify",
  "signal_date": "{{timestamp}}",
  "person_name": "{{firstName}} {{lastName}}",
  "person_linkedin_url": "{{profileUrl}}",
  "person_title": "{{title}}",
  "company_name": "{{companyName}}",
  "company_linkedin_url": "{{companyUrl}}",
  "signal_detail": "{{text}}",
  "competitor_name": "{{sourceProfile}}",
  "intent_score_points": 6
}
```

**⚠️ Variables Trigify à vérifier au setup** : 
- Confirmées : `{{firstName}}`, `{{lastName}}`, `{{email}}`, `{{text}}`, `{{postUrl}}`, `{{sentiment}}`
- Probables mais à valider : `{{title}}`, `{{companyName}}`, `{{companyUrl}}`, `{{profileUrl}}`, `{{timestamp}}`, `{{sourceProfile}}`

**Stratégie** : tester avec **toutes les variables** + observer ce qui arrive côté Oxen-OS. Si un field manque, le code Zod côté Oxen le rendra `optional()`.

### 5.5 Step 5 — Test workflow end-to-end (avant le sprint code)

**Procédure** :
1. Workflow → Publish (Enabled)
2. Attendre 1-2 jours qu'un signal réel arrive (engagement sur un competitor post)
3. Observer le log POST côté Oxen-OS prod via Railway logs ou Sentry
4. **Si payload incomplet** : ajuster le body JSON Trigify (Step 3)
5. **Si payload OK** : sprint code peut démarrer en confiance

**Alternative rapide** : utiliser webhook.site comme cible test, voir le payload exact, puis switcher vers Oxen-OS production.

---

## 6. Sprint Code Oxen-OS — 6 batches (~6-8h focus)

### 6.1 Architecture cible

```
POST /api/webhooks/trigify
  │
  ▼
1. Auth requireWebhookSecret(TRIGIFY_WEBHOOK_SECRET)
  │
  ▼
2. Validate Zod schema (11 fields, all optional pour graceful degradation)
  │
  ▼
3. Match signal_type → SignalTypeRegistry canonical code
   (mapping: see §6.3 batch 1)
  │
  ▼
4. Match Contact:
   a. LinkedIn URL strict match (person_linkedin_url)
   b. Fallback: email match (case-insensitive)
   c. Fallback: name + company match (fuzzy)
   d. Fallback: auto-create "intent-sourced" contact
  │
  ▼
5. Match Company (via contact.companyId or company_name):
   - If match: link signal to companyId
   - If no match: create stub Company tagged "intent-sourced"
  │
  ▼
6. Create IntentSignal:
   - contactId
   - companyId (denormalized for account-level scoring)
   - signalTypeCode (canonical)
   - signalDate (from payload or now())
   - intentScorePoints (from registry default OR payload override)
   - expiresAt = signalDate + decayDays (from registry)
   - sourceData JSON (full payload archived)
  │
  ▼
7. Recalculate contact.relationshipScore (existing logic Sprint S1)
  │
  ▼
8. Trigger Telegram alerts if immediate trigger:
   - signal_type IN ('profile_visit', 'oxen_engagement_comment')
   - Broadcast to CRM_BD_EMAILS via notifyEmployee()
  │
  ▼
9. Response { ok: true, signal_id, contact_id, action_taken }
```

### 6.2 Batch breakdown

| Batch | Effort | Description |
|---|---|---|
| **B1 — Schema + Seed** | 1h | Migration: index linkedinUrl. Update seed-signal-types.ts with 7 Trigify entries. |
| **B2 — Matching upgrade** | 1h30 | Refactor route.ts matching: LinkedIn URL → email → name+company → auto-create |
| **B2.5 — Idempotence (NEW v1.1)** | 45min | Dedup logic: composite unique key check, skip if signal already exists |
| **B3 — Signal type mapping** | 1h | Map payload signal_type → SignalTypeRegistry canonical codes |
| **B4 — Telegram alerts** | 1h30 | Immediate triggers detection + broadcast aux BDs |
| **B5 — Tests** | 2h | Pattern clay-enrichment, 12-15 tests new (incl. dedup tests) |
| **B6 — Doc + commit** | 30min | PRD update + commit message structuré |

**Total : ~8h focus en 1 journée** (v1.0 disait 7-8h, v1.1 ajoute ~45min pour idempotence + tests).

### 6.3 Batch 1 — Schema + Seed (1h)

**Migration Prisma** :
```prisma
model CrmContact {
  // ... existing fields
  linkedinUrl String?
  
  @@index([linkedinUrl])  // ← NEW
  // ... other indexes
}
```

**Migration command** :
```bash
npx prisma migrate dev --name add_linkedin_url_index
```

**Update `scripts/db/seed-signal-types.ts`** — ajouter 7 entries Trigify canonical :

```typescript
const TRIGIFY_SEEDS: SignalTypeSeed[] = [
  {
    code: "trigify_oxen_engagement_comment",
    label: "OXEN content engagement — comment",
    category: "INTENT",
    defaultPoints: 10,
    decayDays: 30,
    decayCurve: "EXPONENTIAL",
    isActive: true,
  },
  {
    code: "trigify_oxen_engagement_like",
    label: "OXEN content engagement — like",
    category: "INTENT",
    defaultPoints: 5,
    decayDays: 30,
    decayCurve: "EXPONENTIAL",
    isActive: true,
  },
  {
    code: "trigify_profile_visit",
    label: "Profile visit post-email",
    category: "INTENT",
    defaultPoints: 10,
    decayDays: 7,
    decayCurve: "STEP",
    isActive: true,
  },
  {
    code: "trigify_competitor_engagement",
    label: "Engagement with competitor content",
    category: "INTENT",
    defaultPoints: 6,
    decayDays: 60,
    decayCurve: "LINEAR",
    isActive: true,
  },
  {
    code: "trigify_follow_competitor",
    label: "Follow competitor page",
    category: "INTENT",
    defaultPoints: 3,
    decayDays: 90,
    decayCurve: "LINEAR",
    isActive: true,
  },
  {
    code: "trigify_role_change",
    label: "Role change — relevant title",
    category: "INTENT",
    defaultPoints: 6,
    decayDays: 90,
    decayCurve: "LINEAR",
    isActive: true,
  },
  {
    code: "trigify_bio_change",
    label: "Bio change — relevant keywords",
    category: "INTENT",
    defaultPoints: 3,
    decayDays: 90,
    decayCurve: "LINEAR",
    isActive: true,
  },
]
```

**Note placeholder** : `trigify_intent_signal` (placeholder Sprint S1) doit rester en DB pour ne pas casser les anciens signals déjà persistés. Marquer `isActive: false` pour le déprécier nouveaux usages.

**Tests B1** : 2-3 tests sur seed script idempotence + new entries presence.

### 6.4 Batch 2 — Matching upgrade (1h30)

**Refactor** `src/app/api/webhooks/trigify/route.ts`.

**Logique matching (new)** :

```typescript
async function matchContact(payload: TrigifyPayload): Promise<{
  contact: CrmContact
  matchMethod: "linkedin_url" | "email" | "name_company" | "auto_created"
}> {
  // 1. Strict LinkedIn URL match (priority)
  if (payload.person_linkedin_url) {
    const contact = await prisma.crmContact.findFirst({
      where: { 
        linkedinUrl: { 
          equals: payload.person_linkedin_url, 
          mode: "insensitive" 
        } 
      },
    })
    if (contact) return { contact, matchMethod: "linkedin_url" }
  }
  
  // 2. Email fallback (case-insensitive)
  if (payload.email) {
    const contact = await prisma.crmContact.findFirst({
      where: { email: { equals: payload.email, mode: "insensitive" } },
    })
    if (contact) return { contact, matchMethod: "email" }
  }
  
  // 3. Name + company fuzzy fallback
  if (payload.person_name && payload.company_name) {
    const contact = await prisma.crmContact.findFirst({
      where: {
        AND: [
          { name: { contains: payload.person_name, mode: "insensitive" } },
          { company: { name: { contains: payload.company_name, mode: "insensitive" } } },
        ],
      },
      include: { company: true },
    })
    if (contact) return { contact, matchMethod: "name_company" }
  }
  
  // 4. Auto-create (last resort)
  const [firstName, ...lastNameParts] = (payload.person_name || "").split(" ")
  const lastName = lastNameParts.join(" ")
  
  // Match or create Company first
  let companyId: string | undefined
  if (payload.company_name) {
    const company = await prisma.company.upsert({
      where: { name: payload.company_name },
      create: {
        name: payload.company_name,
        linkedinUrl: payload.company_linkedin_url,
        acquisitionSource: "Other",
        acquisitionSourceDetail: "Trigify (auto-created)",
      },
      update: {},
    })
    companyId = company.id
  }
  
  const contact = await prisma.crmContact.create({
    data: {
      firstName: firstName || "Unknown",
      lastName: lastName || "(auto-created)",
      name: payload.person_name,
      linkedinUrl: payload.person_linkedin_url,
      email: payload.email,
      jobTitle: payload.person_title,
      companyId,
      acquisitionSource: "Other",
      acquisitionSourceDetail: "Trigify",
      lifecycleStage: "intent_sourced",  // NEW stage for Trigify-discovered contacts
      createdBy: "webhook:trigify",
    },
  })
  
  return { contact, matchMethod: "auto_created" }
}
```

**Note `lifecycleStage: "intent_sourced"`** : nouveau lifecycle stage à ajouter si pas déjà présent. Permet distinguer les contacts Trigify-discovered vs Clay-enriched vs manual.

### 6.4.5 Batch 2.5 — Idempotence / Deduplication (NEW v1.1, ~45min)

**Contexte** : Trigify Time Frame mechanics (§2.4) implique que **les mêmes posts engagés sont rescannés N jours de suite** selon la config Time Frame. Sans dedup, on créerait N IntentSignals pour le même event = score artificiellement gonflé + alerts Telegram répétées + DB pollution.

**Stratégie** : composite unique check avant `intentSignal.create`.

#### Option A — Application-level dedup (recommandé V1)

Avant `prisma.intentSignal.create`, check si signal identique existe déjà :

```typescript
async function findExistingSignal(
  contactId: string,
  signalTypeCode: string,
  signalDate: Date,
  signalDetail?: string,
): Promise<IntentSignal | null> {
  // Window de matching: même contact + même signal_type + même jour
  // (granularité 24h, pas la seconde — sinon retry HTTP peut créer 
  //  duplicates sur le même run)
  const dayStart = new Date(signalDate)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
  
  return prisma.intentSignal.findFirst({
    where: {
      contactId,
      signalTypeCode,
      signalDate: { gte: dayStart, lt: dayEnd },
      // Optional: match also signal_detail if provided (more strict)
      ...(signalDetail ? { sourceData: { path: ["signal_detail"], equals: signalDetail } } : {}),
    },
  })
}
```

**Logic dans le webhook** :

```typescript
// After matching contact + mapping signal type
const existingSignal = await findExistingSignal(
  contact.id,
  signalTypeCode,
  signalDate,
  payload.signal_detail,
)

if (existingSignal) {
  console.log("[trigify] duplicate detected, skipping", {
    contactId: contact.id,
    signalTypeCode,
    existingSignalId: existingSignal.id,
  })
  
  return Response.json({
    ok: true,
    action: "duplicate_skipped",
    contact_id: contact.id,
    signal_id: existingSignal.id,
  })
}

// Otherwise, proceed with intentSignal.create + alerts
```

**Critères de matching unicité** :
- ✅ `contactId` — même personne
- ✅ `signalTypeCode` — même type de signal
- ✅ `signalDate` window 24h — même jour
- ✅ `signal_detail` (optionnel, strict) — même contenu de post

**Granularité jour-level (24h)** plutôt que seconde :
- Si Trigify rescanne un post à 09:05 puis 09:10 le même jour → 1 seul IntentSignal créé
- Si même post détecté demain à 09:05 → matching dayStart différent → potentiellement créé (mais on aura `signal_detail` identique pour le bloquer si fourni)

#### Option B — DB-level constraint (V2)

```prisma
model IntentSignal {
  // ... existing fields
  
  @@unique([contactId, signalTypeCode, signalDate, sourceDataHash])
}
```

→ Plus robuste mais nécessite stable hash de signal_detail. Skip V1.

#### Côté alerts Telegram

**Bonus** : même si `findExistingSignal` retourne match, **ne PAS alerter à nouveau** sur Telegram. Le check dedup doit se faire **avant** `maybeAlertBDs()`.

#### Tests B2.5

3 tests new dans `route.test.ts` :
1. Création signal pour contact + signalType + day = OK premier appel
2. Re-envoi identique 5 min plus tard = `action: "duplicate_skipped"`, pas de re-create
3. Re-envoi identique le lendemain = nouveau signal créé (window 24h passée)

#### Acceptance criteria

- [ ] Webhook retourne `200 { action: "duplicate_skipped" }` sur duplicate
- [ ] Pas de nouveau IntentSignal créé sur duplicate
- [ ] Pas d'alert Telegram envoyée sur duplicate
- [ ] Log structuré indique le duplicate detection
- [ ] 3 tests new dans test suite

### 6.5 Batch 3 — Signal type mapping (1h)

**Mapping payload.signal_type → SignalTypeRegistry code** :

```typescript
const SIGNAL_TYPE_MAPPING: Record<string, string> = {

  // Brief Andy signal types → Oxen canonical codes
  "oxen_engagement_comment":  "trigify_oxen_engagement_comment",
  "oxen_engagement_like":     "trigify_oxen_engagement_like",
  "profile_visit":            "trigify_profile_visit",
  "competitor_engagement":    "trigify_competitor_engagement",
  "page_follow":              "trigify_follow_competitor",
  "role_change":              "trigify_role_change",
  "bio_change":               "trigify_bio_change",
  
  // Fallback for unknown/legacy values
  "default":                  "trigify_intent_signal",  // legacy placeholder
}

function mapSignalTypeToCode(signal_type?: string): string {
  if (!signal_type) return SIGNAL_TYPE_MAPPING.default
  return SIGNAL_TYPE_MAPPING[signal_type] ?? SIGNAL_TYPE_MAPPING.default
}
```

**Edge cases** :
- `signal_type === undefined` → use default `trigify_intent_signal` placeholder
- `signal_type === "unknown_new_type"` → log warning + use default
- `signal_type === "competitor_engagement"` → canonical mapping

### 6.6 Batch 4 — Telegram alerts (1h30)

**Immediate triggers detection** (from brief Andy §4.1) :

```typescript
const IMMEDIATE_ALERT_SIGNAL_TYPES = [
  "trigify_profile_visit",
  "trigify_oxen_engagement_comment",
]

async function maybeAlertBDs(
  signalCode: string,
  contact: CrmContact & { company?: Company | null },
  payload: TrigifyPayload,
) {
  if (!IMMEDIATE_ALERT_SIGNAL_TYPES.includes(signalCode)) {
    return  // passive enrichment, no alert
  }
  
  const bdEmails = (process.env.CRM_BD_EMAILS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
  
  if (bdEmails.length === 0) {
    console.warn("[trigify] CRM_BD_EMAILS empty, skipping alerts")
    return
  }
  
  const personName = escHtml(payload.person_name || "Unknown")
  const companyName = escHtml(payload.company_name || contact.company?.name || "Unknown company")
  const signalDetail = escHtml(payload.signal_detail || payload.signal_type || "engagement")
  const competitor = payload.competitor_name ? ` <i>(via ${escHtml(payload.competitor_name)})</i>` : ""
  const linkedinUrl = payload.person_linkedin_url || ""
  
  const message = `
🚨 <b>Hot signal — ${personName}</b>${competitor}

<b>Company</b>: ${companyName}
<b>Action</b>: ${signalDetail}
<b>Type</b>: ${signalCode}
<b>LinkedIn</b>: ${linkedinUrl}

Recommandation: contact within 2h.
  `.trim()
  
  await Promise.all(
    bdEmails.map(email => 
      notifyEmployee(email, message).catch(err => 
        console.error(`[trigify] alert failed for ${email}:`, err)
      )
    )
  )
}
```

**Note** : `Promise.all` avec `.catch` pour ne pas bloquer le webhook si Telegram fail. Le webhook doit toujours retourner 200 pour ne pas que Trigify retry indéfiniment.

### 6.7 Batch 5 — Tests (1h30)

**Fichier** : `src/app/api/webhooks/trigify/route.test.ts` (NEW)

**Structure** :
```typescript
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company:            { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
    crmContact:         { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    employee:           { findUnique: vi.fn(), findMany: vi.fn() },
    signalTypeRegistry: { findUnique: vi.fn() },
    intentSignal:       { create: vi.fn() },
  },
}))

vi.mock("@/lib/telegram", () => ({
  notifyEmployee: vi.fn().mockResolvedValue(true),
  escHtml: vi.fn(s => s),
}))

const SECRET = "test-trigify-secret"

function makeReq(body, opts = {}) {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (opts.secret !== null) headers.set("x-webhook-secret", opts.secret || SECRET)
  return new Request("http://localhost/api/webhooks/trigify", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

beforeAll(() => {
  process.env.TRIGIFY_WEBHOOK_SECRET = SECRET
  process.env.CRM_BD_EMAILS = "ad@oxen.finance,pg@oxen.finance,vd@oxen.finance"
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/webhooks/trigify", () => {
  // ─── Auth ───
  describe("[1] Authentication", () => {
    it("returns 401 if no secret header", async () => { /* ... */ })
    it("returns 401 if wrong secret", async () => { /* ... */ })
    it("accepts request with valid secret", async () => { /* ... */ })
  })
  
  // ─── Zod validation ───
  describe("[2] Zod validation", () => {
    it("accepts empty body (all fields optional)", async () => { /* ... */ })
    it("accepts full payload (11 fields)", async () => { /* ... */ })
    it("rejects malformed JSON", async () => { /* ... */ })
  })
  
  // ─── Contact matching ───
  describe("[3] Contact matching — LinkedIn URL strict", () => {
    it("matches existing contact by linkedinUrl", async () => { /* ... */ })
    it("is case-insensitive", async () => { /* ... */ })
  })
  
  describe("[4] Contact matching — email fallback", () => {
    it("falls back to email if no linkedinUrl match", async () => { /* ... */ })
  })
  
  describe("[5] Contact matching — name+company fallback", () => {
    it("falls back to name+company if no linkedin nor email", async () => { /* ... */ })
  })
  
  describe("[6] Contact matching — auto-create", () => {
    it("auto-creates contact + company stub if no match", async () => { /* ... */ })
    it("sets lifecycleStage to 'intent_sourced'", async () => { /* ... */ })
    it("sets acquisitionSource to 'Other / Trigify'", async () => { /* ... */ })
  })
  
  // ─── Signal type mapping ───
  describe("[7] Signal type mapping", () => {
    it("maps known signal_type to canonical code", async () => { /* ... */ })
    it("uses default placeholder for unknown signal_type", async () => { /* ... */ })
    it("uses default for undefined signal_type", async () => { /* ... */ })
  })
  
  // ─── Telegram alerts ───
  describe("[8] Telegram alerts — immediate triggers", () => {
    it("alerts all BDs on profile_visit signal", async () => { /* ... */ })
    it("alerts all BDs on oxen_engagement_comment signal", async () => { /* ... */ })
    it("does NOT alert on competitor_engagement (passive)", async () => { /* ... */ })
    it("returns 200 even if Telegram fails", async () => { /* ... */ })
  })
  
  // ─── IntentSignal creation ───
  describe("[9] IntentSignal persistence", () => {
    it("creates IntentSignal with correct fields", async () => { /* ... */ })
    it("sets expiresAt based on decayDays", async () => { /* ... */ })
    it("uses intent_score_points from payload if provided", async () => { /* ... */ })
    it("falls back to registry defaultPoints otherwise", async () => { /* ... */ })
  })
})
```

**Total estimé** : 10-12 tests. Anti-régression critique sur match priority + Telegram alert logic.

### 6.8 Batch 6 — Doc + commit (30 min)

**Commit message** :
```
feat(trigify): full integration Phase 2A — webhook + matching + alerts

Replace placeholder Sprint S1 trigify webhook with production-ready 
implementation. Maps payload signal_type → 7 canonical SignalTypeRegistry 
codes, LinkedIn URL-prioritized contact matching with email/name fallback 
and auto-create, immediate Telegram alerts to BDs on hot signals 
(profile_visit + oxen_engagement_comment).

Batches:
- B1 schema: linkedinUrl index + 7 SignalTypeRegistry Trigify entries
- B2 matching: LinkedIn URL → email → name+company → auto-create flow
- B3 signal type mapping: payload signal_type → canonical codes
- B4 Telegram alerts: broadcast immediate triggers to CRM_BD_EMAILS
- B5 tests: 10-12 tests pattern clay-enrichment
- B6 doc: PRD-002 + journal update

Refs: PRD-002 Trigify Pre-Spec, Brief Trigify Andy (uploads)
```

**Doc updates** :
- `reference/PRD_002_TRIGIFY_PRESPEC.md` → marquer Sprint Phase 2A livré + add changelog
- `reference/PRD_001_MAPPING.md` → mention Trigify integration (Sprint Phase 2A) dans Phase 2 sources
- `reference/OXEN_OS_ROADMAP_OVERVIEW.md` → marquer feature #1 Trigify ✅ FAIT
- `JOURNAL_<date>.md` → ajouter la session

---

## 7. Decisions pending (business / Andy)

### D1 — Plan Trigify
**Question** : Essential $149/mo vs Growth $270/mo vs Scale $549/mo ?  
**Owner** : Vernon (financial decision)  
**Deadline** : 2026-05-21 (free trial expires)  
**Recommandation** : Essential pour démarrer Cycle 1, upgrade après stats.

**D1.2 — Credit budget verification (NEW v1.1)** :

Avant de valider le plan, action préalable :

1. Aller sur Trigify → `Manage Plan` (sidebar)
2. Noter combien de **credits/mois** inclut chaque tier (Essential / Growth / Scale)
3. Comparer au budget V1 estimé :
   - 9 sources × 25 max results × Daily run = 6,750 credits/mois max théorique
   - Réalisme : ~3,000-5,000 credits/mois (Profile Monitoring volume modéré)
4. Décider :
   - Si Essential inclut **≥ 5,000 credits/mois** → Essential OK
   - Si Essential inclut **< 5,000 credits/mois** → upgrade Growth
   - Si Growth inclut < 8,000 credits/mois → Scale (peu probable)

**Mitigation si budget Essential trop juste** :
- Réduire Max Results : 25 → 15
- Réduire sources : 9 → 5 (drop OXEN page V1 + 2 BD profiles, garder 6 competitors prioritaires)
- Switcher Daily → 2x/semaine

### D2 — Liste finale des competitors
**Question** : Les 6 du brief (Mercury, Relay, Wise, Payoneer, Airwallex, BVNK) sont-ils définitifs ?  
**Owner** : Andy  
**Deadline** : avant config Listening Step 5.2  
**Recommandation** : commencer avec les 6, ajuster trimestriellement.

### D3 — BD assignment for alerts
**Question** : Telegram alerts on hot signals → broadcast à tous BDs OR assign par BD owner ?  
**Options** :
- A — Broadcast à tous (V1 simple)
- B — Random BD via `assignRandomBD()` (existing helper)
- C — Mapping Company → BD owner (= new field `Company.assignedBdId`, sprint dédié)

**Owner** : Andy  
**Recommandation V1** : A (broadcast), V2 selon volume.

### D4 — Sequence interruption
**Question** : Pause Lemlist sequence on hot signal — Phase 1 (Trigify) ou Phase 3 (Scoring) ?  
**Options** :
- A — Phase 1 : new field `CrmContact.sequencePaused: bool` + sync Lemlist update (3-4h sprint dédié)
- B — Phase 3 : implementer avec Scoring engine global (cohérence architecturale)

**Owner** : Andy  
**Recommandation** : B (Phase 3). V1 = juste alerts Telegram, BD pause manuellement Lemlist si nécessaire.

### D5 — Payload mapping strict
**Question** : 11 fields brief Andy strict, ou subset minimal ?  
**Options** :
- A — Strict 11 fields (best forward-compat)
- B — Minimal subset (email + signal_type + person_linkedin_url)
- C — Custom (selon variables Trigify réelles disponibles)

**Owner** : Vernon (technical decision)  
**Recommandation** : A (strict 11 fields). Side effect : si Trigify ne fournit pas une variable, le Zod schema l'a `optional()` et le matching/scoring fallback gracieusement.

---

## 8. Sprint Plan — Prompt Claude Code (ready-to-paste)

Une fois Trigify side setup terminé (§5) et 1 sample event reçu côté Oxen-OS, copier ce prompt dans Claude Code pour lancer le sprint.

```
Sprint Trigify Phase 2A (6 batches défensifs, ~7-8h focus).

Contexte : Trigify Listening + Workflow setup terminé côté Vernon. 
Sample events reçus sur /api/webhooks/trigify confirmant le format 
payload. Webhook existant (Sprint S1) est un placeholder simple — 
à remplacer par version production-ready.

Décisions structurelles validées (PRD-002):
- 7 SignalTypeRegistry Trigify entries canoniques (trigify_*)
- Matching: LinkedIn URL strict → email → name+company → auto-create
- Telegram alerts: broadcast à tous CRM_BD_EMAILS sur immediate triggers
- Lifecycle stage "intent_sourced" pour contacts auto-créés Trigify
- Skip Company.assignedBdId (V2, broadcast V1)
- Skip sequence interruption (Phase 3)
- Mode B strict (commit local + review avant push)

Procède :

BATCH 1 — Schema + Seed (~1h)

1. Migration Prisma:
   - Add @@index([linkedinUrl]) on CrmContact model
   - Si lifecycleStage est un enum Prisma, add "intent_sourced" value
     (sinon si String? libre, no-op)
   - Run npx prisma migrate dev --name 
     add_trigify_linkedin_index_and_intent_sourced_stage

2. Update scripts/db/seed-signal-types.ts:
   - Add TRIGIFY_SEEDS array avec 7 entries:
     * trigify_oxen_engagement_comment (10pt, 30j EXPONENTIAL)
     * trigify_oxen_engagement_like (5pt, 30j EXPONENTIAL)
     * trigify_profile_visit (10pt, 7j STEP)
     * trigify_competitor_engagement (6pt, 60j LINEAR)
     * trigify_follow_competitor (3pt, 90j LINEAR)
     * trigify_role_change (6pt, 90j LINEAR)
     * trigify_bio_change (3pt, 90j LINEAR)
   - Garder PLACEHOLDER_SEEDS.trigify_intent_signal MAIS marquer 
     isActive: false (deprecation, ne pas supprimer pour préserver 
     signals legacy déjà en DB)

3. Run seed: npx tsx scripts/db/seed-signal-types.ts
4. Tests: 2-3 tests new sur seed script (idempotence + presence)

BATCH 2 — Matching upgrade (~1h30)

Refactor src/app/api/webhooks/trigify/route.ts:

1. Update Zod schema (src/app/api/crm/_schemas.ts ou colocate):
   trigifyWebhookSchema = z.object({
     signal_type: z.string().optional(),
     signal_source: z.string().optional(),
     signal_date: z.string().datetime().optional(),
     person_name: z.string().optional(),
     person_linkedin_url: z.string().url().optional(),
     person_title: z.string().optional(),
     company_name: z.string().optional(),
     company_linkedin_url: z.string().url().optional(),
     signal_detail: z.string().optional(),
     competitor_name: z.string().optional(),
     intent_score_points: z.number().int().min(0).max(1000).optional(),
   })

2. Extraire matchContact() function (peut vivre dans route.ts ou 
   lib/trigify-matching.ts):
   
   async function matchContact(payload) -> { 
     contact, 
     matchMethod: "linkedin_url" | "email" | "name_company" | "auto_created" 
   }
   
   Ordre de matching:
   a. person_linkedin_url → CrmContact.findFirst { linkedinUrl: insensitive }
   b. email fallback → findFirst { email: insensitive }  
      ⚠️ Note: Trigify payload n'a pas "email" field strict — peut être 
      dans signal_detail ou ailleurs. À adapter selon ce qui arrive 
      réellement. Si pas d'email, skip cette étape.
   c. name + company fuzzy → findFirst { name contains, company.name contains }
   d. Auto-create:
      - upsert Company (par name)
      - create CrmContact avec:
        * firstName/lastName parsé depuis person_name
        * linkedinUrl, jobTitle, companyId
        * acquisitionSource: "Other"
        * acquisitionSourceDetail: "Trigify"
        * lifecycleStage: "intent_sourced" (ou "new_lead" si enum 
          contraint)
        * createdBy: "webhook:trigify"

3. Log structured pour debug:
   console.log("[trigify] matched contact via " + matchMethod, { 
     contactId, signal_type, person_linkedin_url 
   })

BATCH 2.5 — Idempotence / Deduplication (NEW v1.1, ~45min)

Contexte critique: Trigify Time Frame "Last week" rescanne 7 jours 
chaque run. Sans dedup, on créerait 7 IntentSignals pour le même 
event. PRD §2.4 + §6.4.5.

1. Create helper findExistingSignal() (peut être inline ou dans 
   lib/trigify-dedup.ts):

   async function findExistingSignal(
     contactId, signalTypeCode, signalDate, signalDetail?
   ): Promise<IntentSignal | null> {
     const dayStart = new Date(signalDate)
     dayStart.setUTCHours(0, 0, 0, 0)
     const dayEnd = new Date(dayStart)
     dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
     
     return prisma.intentSignal.findFirst({
       where: {
         contactId,
         signalTypeCode,
         signalDate: { gte: dayStart, lt: dayEnd },
         ...(signalDetail 
           ? { sourceData: { path: ["signal_detail"], equals: signalDetail } } 
           : {}),
       },
     })
   }

2. Integration dans le webhook (avant intentSignal.create + avant 
   maybeAlertBDs):
   
   const existingSignal = await findExistingSignal(
     contact.id,
     signalTypeCode,
     signalDate,
     payload.signal_detail,
   )
   
   if (existingSignal) {
     console.log("[trigify] duplicate detected, skipping", {
       contactId: contact.id,
       signalTypeCode,
       existingSignalId: existingSignal.id,
     })
     return Response.json({
       ok: true,
       action: "duplicate_skipped",
       contact_id: contact.id,
       signal_id: existingSignal.id,
     })
   }
   
   // ... rest: create intentSignal + alerts

3. Test acceptance:
   - 1er appel: signal créé OK
   - Re-envoi 5 min après (même contact + signalType + day): 
     action: "duplicate_skipped"
   - Re-envoi lendemain: nouveau signal créé (window 24h passée)
   - Alert Telegram NE PAS envoyée si duplicate

BATCH 3 — Signal type mapping (~1h)

1. Create lib helper or colocate in route.ts:
   const SIGNAL_TYPE_MAPPING = {
     "oxen_engagement_comment":  "trigify_oxen_engagement_comment",

     "oxen_engagement_like":     "trigify_oxen_engagement_like",
     "profile_visit":            "trigify_profile_visit",
     "competitor_engagement":    "trigify_competitor_engagement",
     "page_follow":              "trigify_follow_competitor",
     "role_change":              "trigify_role_change",
     "bio_change":               "trigify_bio_change",
     "default":                  "trigify_intent_signal",
   }
   
   function mapSignalTypeToCode(signal_type?: string): string {
     if (!signal_type) return SIGNAL_TYPE_MAPPING.default
     return SIGNAL_TYPE_MAPPING[signal_type] ?? SIGNAL_TYPE_MAPPING.default
   }
   
   Note: pour signal_type inconnu, log warning + use default placeholder.

2. Update create IntentSignal logic:
   - signalTypeCode = mapSignalTypeToCode(payload.signal_type)
   - Fetch SignalTypeRegistry by code (use lib/signal-types-registry.ts 
     helper Sprint S1 si existe, sinon prisma direct)
   - intentScorePoints = payload.intent_score_points 
                        ?? registry.defaultPoints
   - signalDate = payload.signal_date ? new Date(payload.signal_date) 
                                       : new Date()
   - expiresAt = signalDate + (registry.decayDays * 86400000)
   - companyId denormalized depuis contact.companyId

BATCH 4 — Telegram alerts (~1h30)

1. Create helper maybeAlertBDs():
   - Detect immediate triggers:
     IMMEDIATE_ALERT_SIGNAL_TYPES = [
       "trigify_profile_visit",
       "trigify_oxen_engagement_comment",
     ]
   - Skip if signal not in immediate
   - Read CRM_BD_EMAILS env var (split comma, trim, filter Boolean)
   - Format HTML message (use escHtml from telegram lib):
     🚨 <b>Hot signal — {person_name}</b> <i>(via {competitor_name})</i>
     
     <b>Company</b>: {company_name}
     <b>Action</b>: {signal_detail}
     <b>Type</b>: {signalCode}
     <b>LinkedIn</b>: {person_linkedin_url}
     
     Recommandation: contact within 2h.
     
   - Broadcast via Promise.all + .catch (ne pas bloquer le webhook 
     si Telegram fail)

2. Call maybeAlertBDs() AFTER IntentSignal create, BEFORE response.

3. Webhook response toujours 200 même si alerts fail.

BATCH 5 — Tests (~2h)

Create src/app/api/webhooks/trigify/route.test.ts (NEW) following 
clay-enrichment pattern exactly. Sections:

[1] Authentication — 3 tests
[2] Zod validation — 3 tests
[3] Contact matching LinkedIn URL strict — 2 tests
[4] Contact matching email fallback — 1 test (skip si pas email field 
    selon decision matching)
[5] Contact matching name+company fallback — 1 test
[6] Contact matching auto-create — 3 tests
[7] Idempotence / dedup (NEW v1.1) — 3 tests:
    - same contact + signalType + day → duplicate_skipped
    - same contact + signalType + next day → new signal created
    - duplicate detected → no Telegram alert sent
[8] Signal type mapping — 3 tests (known/unknown/undefined)
[9] Telegram alerts immediate triggers — 4 tests
[10] IntentSignal persistence — 4 tests

Total: ~27 tests (peut réduire à 15-18 essentiels si time-boxed).

Mock prisma, telegram, signal-types-registry.
Use makeReq() helper similar to clay-enrichment.test.ts.

BATCH 6 — Doc + commit (~30min)

1. Update reference/PRD_002_TRIGIFY_PRESPEC.md:
   - Section 8 Sprint Plan: mark as ✅ LIVRÉ
   - Add changelog v1.2 with commit hash

2. Update reference/PRD_001_MAPPING.md:
   - Phase 2 Sources section: add Trigify integration done

3. Update reference/OXEN_OS_ROADMAP_OVERVIEW.md:
   - Mark feature #1 Trigify ✅ FAIT

4. Build + typecheck + lint + tests:
   - npx tsc --noEmit
   - npx eslint (verify 0 new errors)
   - npm test (verify 309 + ~24 = 330+ tests, 0 regression)
   - npm run build

5. Commit local (Mode B):
   "feat(trigify): full integration Phase 2A — webhook + matching + alerts

   Replace placeholder Sprint S1 trigify webhook with production-ready 
   implementation. Maps payload signal_type → 7 canonical 
   SignalTypeRegistry codes, LinkedIn URL-prioritized contact matching 
   with email/name fallback and auto-create, immediate Telegram alerts 
   to BDs on hot signals (profile_visit + oxen_engagement_comment).

   Batches:
   - B1 schema: linkedinUrl index + 7 SignalTypeRegistry Trigify entries
   - B2 matching: LinkedIn URL → email → name+company → auto-create flow
   - B2.5 idempotence: day-level dedup to prevent duplicates from 
     Trigify rescans (Time Frame overlap coverage)
   - B3 signal type mapping: payload signal_type → canonical codes
   - B4 Telegram alerts: broadcast immediate triggers to CRM_BD_EMAILS
   - B5 tests: ~27 tests pattern clay-enrichment (auth, matching, 
     dedup, alerts, persistence)
   - B6 doc: PRD-002 + journal update

   Refs: PRD-002 Trigify Pre-Spec v1.1, Brief Trigify Andy (uploads)"

6. STOP avant push, me montrer:
   - Diff complet
   - Output tests + build + lint
   - Confirmation commit local
   - Reminder: Vernon → Trigify side (workflow Enabled, monitor stats)

Procède.
```

---

## 9. Out of scope V1 — backlog futurs sprints

### Sprint Trigify Phase 2B (~1 jour, plus tard)
- Listening Keyword Searches (banking alternatives, multi-currency, KYC, etc.)
- Multi-platform : X, Reddit, YouTube comments
- AI Agent Filter node côté Trigify Workflow (sentiment + ICP fit)

### Sprint Sentinel Feed UI (feature #4, ~2-3 jours)
- Dashboard "hot signals" daily list sorted by Priority Score
- Filter by signal type, BD assignment, jurisdiction
- Quick actions buttons: send Telegram, create task, view contact

### Sprint Sequence Interruption (~3-4h, dépend décision D4 Andy)
- New field `CrmContact.sequencePaused: bool`
- Lemlist sync update : pause sequence on hot signal
- BD UI button : "resume sequence" + "send personalized"

### Sprint Company BD Assignment (~3-4h, dépend décision D3 Andy)
- New field `Company.assignedBdId: String?` FK Employee
- UI dropdown sur Company detail page pour assigner
- Telegram alert routing: alert only assigned BD instead of broadcast

### Sprint Scoring Engine UI (feature #3 Phase 3, bloqué Andy)
- Priority Score = ICP Score + Intent Score
- Auto-recalculation cron sur signal events
- Tier thresholds (Monitoring/T3/T2/T1) avec transitions
- UI scoring rules editor

---

## 10. References

### Documents repo
- `reference/JOURNAL_2026_05_07.md` — journal session 7 mai (7 sprints livrés)
- `reference/PRD_001_MAPPING.md` v3.7 — Sprint S1 + Phase 2 G1-T1 SEEDED
- `reference/OXEN_OS_ROADMAP_OVERVIEW.md` — master roadmap 14 features Andy
- `reference/SPRINT_S1_DEPLOYMENT_RUNBOOK.md` — runbook Sprint S1 universal signal ingestion
- `docs/conference-brief-cron.md` + `docs/signal-decay-cron.md` — operator guides cron GitHub Actions

### Documents externes
- `Trigify_Brief.docx` (Andy, uploads) — brief original 302 lignes
- `Trigify_Help_Center` : https://help.trigify.io/
  - https://help.trigify.io/articles/1225442-how-to-track-profiles
  - https://help.trigify.io/articles/9504542-http-request
  - https://help.trigify.io/en/articles/27-making-api-calls

### Commits structurants Sprint S1 (foundation pour Trigify)
- `a11161a` — feat(prisma): universal signal ingestion schema (S1 b1)
- `af30e11` — feat(api): POST /api/signals universal ingestion (S1 b2)
- `6565351` — feat(signal): time decay helpers + cron precompute (S1 b3)
- `1e231b4` — feat(webhooks): Clay enrichment optional signal emission (S1 b4)
- `e1b8aa1` — feat(signals): activate decay cron via HTTP endpoint

### Commits Sprint S1 hotfixes
- `f8ddb86` — fix(proxy): whitelist /api/signals
- `e52c139` — feat(cron): GitHub Actions for monthly + daily cron triggers

---

## Changelog

- **v1.0** (2026-05-14 morning) — initial pre-spec post-audit. Architecture Trigify validated via research (help.trigify.io). Sprint plan ready à coller dans Claude Code. 5 decisions pending Andy/Vernon.

- **v1.1** (2026-05-14 afternoon) — integration of Trigify Listening filtering doc findings:
  - §1.5 added: credit-based pricing (1 credit/post) → D1.2 budget verification step before plan choice
  - §2.4 added: Time Frame mechanics — overlap coverage creates duplicates risk
  - §2.5 added: Job Title Filter max 6/search → Top 6 prioritization (Stratégie B) recommended V1
  - §5.2.5 added: search configuration filters (Last 24h, 6 job titles, 25 max results, daily sync)
  - §6.4.5 added: Batch 2.5 — Idempotence / dedup logic (~45min)
  - §8 prompt updated: BATCH 2.5 integrated, BATCH 5 tests increased to ~27 (3 dedup tests added)
  - Total sprint estimate revised from 7-8h → ~8h

---

**End of PRD-002 Trigify Phase 2A pre-spec.**

Next action: Vernon decides Trigify plan (D1), setups Listening + Workflow (§5), then launches Sprint Code via prompt §8.
