# PRD-001 v3 — Intent Scoring Engine
# Document de mapping vers le CRM Oxen OS existant

> Document v3 — généré le 2026-05-01, révisé 2026-05-05 (réponses Andy).
> Référence PRD : Andy / Oxen Finance — `CRM_scoring_brief.docx` — April 29, 2026
> Statut : Draft pour validation Vernon avant décomposition en sprints
> Aucun code modifié, aucune migration, aucune implémentation — audit + mapping uniquement.
>
> **Changelog** :
> - **v1 → v2** : ajout du contexte DB pre-launch (vérifié via `scripts/db/check-counts.ts`), mise à jour des risques migration (drastiquement réduits), estimation effort revue à la baisse.
> - **v2 → v3** : intégration des décisions Andy reçues 2026-05-05 (mapping vertical→group finalisé, FinTech/Crypto IN scope intermediaries only, iGaming + Import/Export OUT, auto-assignment Random 50/50, Pain Tier T2 default, Market Signal workflow, 5/7 Open Questions résolues).

---

## 1. Synthèse exécutive

**Important contexte DB (vérifié 2026-05-01)** : la base est en état pre-launch — 9 CrmContacts seed test, 0 IntentSignal, 0 ICP scores alimentés, 0 relationshipScore. Le scoring engine entrera donc dans une DB vierge en pratique. Migration risk minimal, mais timing critique : implémenter AVANT que Andy démarre le marketing en production pour éviter retraitement des signaux générés.

Le PRD décrit un **Intent Scoring Engine** ambitieux (3 nouveaux models, 22 champs, 9 endpoints, 4 background jobs, 9 React components). Le code actuel a posé **les fondations partielles** : `IntentSignal` existe avec source/signalType/score/expiresAt/raw, `relationshipScore` 0-100 sur `CrmContact`, et 4 champs pré-existants pour ICP (`icpFit`, `icpScore`, `icpScoreBreakdown`, `icpScoredAt`). Mais la couche manquante est **majoritaire** : pas de Pain Tier, pas de Group (G1-G7B), pas de Persona DM/OP, pas de Priority Level, pas de decay 3-paliers, pas de sequence routing par tier × persona, pas de `MarketSignal` model, pas d'endpoint unifié `/api/signals`.

Le **désalignement structurel le plus lourd** : (1) le PRD propose `Account` + `Contact` (1-to-N) mais le CRM a `CrmContact` (qui mélange les deux concepts) + `Company` séparée — décision schéma à trancher. (2) `vertical` actuel (7 valeurs string[]) ne mappe pas 1-to-1 avec les 8 `group` du PRD (G1-G7B). (3) `dealOwner` est string hardcodée, pas FK Employee, ce qui bloque l'`assigned_bd` UUID FK du PRD. (4) **Lemlist library actuelle ne supporte que enroll + remove — pas de pause, pas d'advance, pas de step manipulation** : Open Question #1 du PRD est répondue NÉGATIVEMENT par le code (à vérifier côté API Lemlist mais aucune trace dans le code).

**Verdict effort** : **8 semaines** pour Vernon + Johnny (1 dev externe) + Claude Code, en assumant les 5 décisions structurelles tranchées en S0. Estimation revue à la baisse (vs 9-10 v1) compte tenu du risque migration minimal confirmé.

**Risque principal** : la cohabitation `IntentSignal` (existant) vs `Signal` (PRD) — à trancher avant tout dev. **Migration data en pratique inexistante** (0 IntentSignal en prod).

**Décisions Andy reçues 2026-05-05** : Andy a confirmé 4 décisions structurelles le 2026-05-05 : iGaming et Import/Export OUT of scope outbound, FinTech/Crypto IN avec mapping G1/G5, auto-assignment Random 50/50 Andy/Paul Louis, Pain Tier T2 par défaut. Score override 30j auto-expire (à valider Andy). Market Signals auto-create Lemlist draft + validation BD manuelle. Lemlist API pause/advance à vérifier par Vernon cette semaine.

**Bloquants techniques (à résoudre AVANT dev)** :
- B1 : Open Q #1 Lemlist API pause/advance — code actuel ne l'implémente pas
- B2 : Mapping `vertical` → `group` (7 verticals → 8 groups, pas 1-to-1)
- B3 : Architecture `Signal` vs `IntentSignal`
- B4 : `dealOwner` string → FK Employee (déjà dans backlog `FEATURES.md`)
- B5 : Companies "+ New Company" non fonctionnel (déjà dans backlog `FEATURES.md`)

---

## 2. Mapping entités principales

### 2.1 PRD `Account` → CRM actuel

| Aspect | PRD propose | CRM actuel | Mapping / Décision |
|---|---|---|---|
| Nom de l'entité scoring | `Account` (1) | `CrmContact` (le scoring est sur le contact, pas la company) | **À TRANCHER** : refactor en `Account` ou continuer sur `CrmContact` ? |
| Liée à des contacts | 1 Account → N Contacts | 1 `Company` → N `CrmContact` (FK `companyId` nullable) | **EXISTS différemment** : `Company` ≠ `Account` PRD ; `Account` PRD ≈ `Company` + scoring |
| Champ scoring agrégé existant | - | `CrmContact.relationshipScore` (Int 0-100) | **EXISTS** mais pas de séparation ICP / Intent — **DEAD FIELD : 0/9 contacts > 0** |
| Champs ICP déjà présents | icp_score, icp_breakdown | `CrmContact.icpScore` (Int), `icpScoreBreakdown` (Json), `icpFit` (string), `icpScoredAt` (DateTime) | **DEAD FIELDS** : les 4 champs existent au schema mais sont jamais alimentés en production (9/9 contacts à 0). Décision : conserver le schema existant, réimplémenter la computation logic from scratch en Sprint S2. Pas de migration data nécessaire. |
| Source de vérité scoring | `Account` (account-level) + `Contact` (contact-level) qui rolle up | `CrmContact` uniquement | **GAP** : pas de scoring Company-level — à ajouter si on garde `Company` |

**Décision recommandée** : **EXTEND `CrmContact`** plutôt que créer `Account`. Justifications :
- 60+ routes API et 11 pages utilisent `CrmContact` directement
- Migration `CrmContact` → `Account` casserait le code production
- Le PRD `Account.contacts` 1-to-N est déjà couvert par `Company.contacts` (CrmContact[])
- Renommer mentalement : `Account` PRD = `Company` Oxen + scoring fields ; `Contact` PRD = `CrmContact` Oxen

**Si décision EXTEND CrmContact** : ajouter les 22 champs sur `CrmContact` + les 5 champs Contact PRD aussi sur `CrmContact` (puisque CrmContact = Account + Contact mélangés).

**Si décision REFACTOR vers Account** : sprint S0 dédié de 1-2 semaines avant tout autre travail. Hors scope PRD.

#### Champs nouveaux requis sur l'entité scoring

| Champ PRD | Type PRD | Existe déjà ? | Sous quel nom ? | Décision |
|---|---|---|---|---|
| `icp_score` | INT 0-50 | **Schema OUI, données NON** | `CrmContact.icpScore` (Int 0-100, dead field) | **REUSE schema** : 0 row alimenté → réinterpréter le champ existant comme 0-50 (pas de migration) ; ou ajouter un nouveau check à la computation logic |
| `icp_breakdown` | JSON | **Schema OUI, données NON** | `CrmContact.icpScoreBreakdown` (Json, dead field) | **REUSE schema** : 0 row alimenté → définir la nouvelle structure `{industry, size, decision_maker, geography, pattern}` directement |
| `intent_score` | FLOAT 0-50 | **NON** | - | **NEW** |
| `priority_score` | FLOAT 0-100 | **NON** (mais `relationshipScore` Int 0-100 existe avec sémantique différente) | - | **NEW** ; déprécier `relationshipScore` ou le redéfinir comme `priority_score` |
| `signal_count` | INTEGER | **NON** | - | **NEW** ; calculé via `intentSignals.length` actuellement |
| `priority_level` | ENUM (P1/P2/P3/monitoring) | **NON** | - | **NEW** |
| `priority_level_changed_at` | TIMESTAMP | **NON** | - | **NEW** |
| `priority_level_grace_until` | TIMESTAMP nullable | **NON** | - | **NEW** |
| `assigned_bd` | UUID FK Employee | **OUI partiel** | `CrmContact.dealOwner` (String?, hardcoded "Andy"/"Paul Louis"/"Vernon") | **REFACTOR** : string → FK `Employee.id` (cf. backlog FEATURES.md) ; pré-requis Sprint S0 |
| `outreach_status` | ENUM (monitoring/queued/in_sequence/nurture/excluded) | **OUI partiel** | `CrmContact.lifecycleStage` (String, 9 valeurs) | **À TRANCHER** : ne sont pas le même concept (lifecycleStage = pipeline funnel ; outreach_status = état Lemlist). Les deux doivent COEXISTER comme champs séparés |
| `target_sequence_id` | VARCHAR nullable | **NON** | - | **NEW** ; distinct de `lemlistCampaignId` (campagne enrollée vs campagne cible si pas encore créée) |
| `exclusion_reason` | VARCHAR nullable | **NON** | - | **NEW** ; (`doNotContact` Boolean existe mais sans raison) |
| `score_override` | FLOAT nullable | **NON** | - | **NEW** |
| `score_override_note` | TEXT nullable | **NON** | - | **NEW** |
| `group` | ENUM (G1-G7B) | **NON** | - | **NEW** ; coexister avec `vertical` (cf. section 3.2) |
| `pain_tier` | ENUM (T1/T2/T3) | **NON** | - | **NEW** |

**22 champs PRD compté** : 16 listés ci-dessus + `icp_breakdown` + autres déjà comptés. Vérification : PRD section 7.1 "Modified Entity: Account (new fields)" liste 16 fields → cohérent.

### 2.2 PRD `Contact` (decision_maker / operational) → CrmContact actuel

| Aspect | PRD propose | CRM actuel | Mapping / Décision |
|---|---|---|---|
| Persona DM/OP | `persona` ENUM | **NON** existant | **NEW** champ `persona` sur `CrmContact` |
| `contact_intent_signals` | INTEGER | **NON** | **NEW** ; aujourd'hui `intentSignals.length` |
| `last_signal_at` | TIMESTAMP nullable | **NON** | **NEW** ; aujourd'hui calculé via `max(intentSignals.createdAt)` |
| `status` (active/left_company/bounced/excluded) | ENUM | **OUI partiel** | `CrmContact.doNotContact` (Boolean) + `lifecycleStage` (string) couvrent partiellement | **NEW** champ explicite `contact_status` |
| `lemlist_lead_id` | VARCHAR nullable | **NON** existe pas (mais leadId retourné par enrollLead non persisté) | **NEW** : ajouter `CrmContact.lemlistLeadId` |
| `enrolled_sequence` | VARCHAR nullable | **OUI partiel** | `CrmContact.lemlistCampaignName` (String?) | **EXTEND** ou ajouter `enrolledSequence` distinct (PRD utilise convention `G1-T1-DM`) |

**Note structurelle** : le PRD sépare nettement Account (account-level fields) et Contact (contact-level fields). Le `CrmContact` actuel mélange. Si décision EXTEND CrmContact (cf. 2.1), les 22 + 5 fields s'ajoutent tous sur `CrmContact`. Cela donnera ~50 champs total sur le model — acceptable mais lourd.

### 2.3 PRD `Signal` → IntentSignal existant

**CRITIQUE** : le PRD propose un nouveau model `Signal` mais `IntentSignal` existe déjà avec une partie des champs. Décision majeure.

#### Champs IntentSignal actuel (`prisma/schema.prisma:943-955`)

```
id          String    @id @default(cuid())
contactId   String                              // FK CrmContact
contact     CrmContact @relation(...)
source      String                              // "clay", "trigify", "n8n" actuellement
signalType  String                              // ex: "tech_install", "job_change"
title       String
detail      String?   @db.Text
score       Int       @default(0)
expiresAt   DateTime?                           // +90j set par webhook Clay/Trigify
raw         Json?
createdAt   DateTime  @default(now())
```

#### Mapping field-by-field

| Champ PRD | Type PRD | IntentSignal actuel | Mapping |
|---|---|---|---|
| `id` | UUID | `id` (cuid) | **EXISTS** |
| `account_id` | UUID FK | **NON** (pas de FK Company) | **NEW** ; ou laisser `contactId` et faire le join via `contact.company` |
| `contact_id` | UUID FK nullable | `contactId` String **NOT nullable** | **EXTEND** : rendre nullable pour signaux account-level |
| `source` | ENUM (trigify/apify/lemlist/clay/manual/crm_internal) | `source` String (libre, "clay"/"trigify"/"n8n" en prod) | **EXTEND** : convertir en enum, ajouter "apify"/"manual"/"crm_internal" |
| `signal_category` | CHAR(1) A-I | **NON** | **NEW** |
| `signal_type` | VARCHAR(100) | `signalType` String | **EXISTS** |
| `scope` | ENUM (account/contact) | **NON** | **NEW** |
| `points` | INTEGER | `score` Int | **RENAME** : `score` → `points` (ou garder `score` comme alias) |
| `detected_at` | TIMESTAMP | `createdAt` DateTime | **EXISTS** comme `createdAt` ; PRD distingue `detected_at` (au source) et `ingested_at` (CRM reception) |
| `ingested_at` | TIMESTAMP | **NON** explicit (== `createdAt`) | **NEW** ou alias `createdAt` |
| `expires_at` | TIMESTAMP | `expiresAt` DateTime? | **EXISTS** (set à +90j dans webhooks) |
| `raw_payload` | JSON | `raw` Json? | **RENAME** : `raw` → `rawPayload` (ou garder) |
| `decay_coefficient` | FLOAT (1.0/0.75/0.50) | **NON** | **NEW** ; aujourd'hui c'est expire-binaire (>90j → disparu), pas un coefficient continu |
| `effective_points` | FLOAT (points × decay) | **NON** | **NEW** |
| `status` | ENUM (active/expired/archived) | **NON** | **NEW** ; aujourd'hui implicite (filtré par expiresAt) |
| `title` (custom Oxen, pas PRD) | - | `title` String | **GARDER** (utile pour UI timeline) |
| `detail` (custom Oxen, pas PRD) | - | `detail` String? | **GARDER** |

#### Décision recommandée

**EXTEND `IntentSignal`** plutôt que créer `Signal` séparé. Justifications :
- Code production écrit déjà dans `IntentSignal` (3 webhooks : Clay, Trigify, N8N)
- Les data en prod (X enregistrements à confirmer DB) sont reprises avec migration
- `Signal` PRD = `IntentSignal` Oxen + 7 nouveaux champs (signal_category, scope, ingested_at, decay_coefficient, effective_points, status, account_id implicite)

**Migration data nécessaire si EXTEND** :
1. Ajouter colonnes nouvelles avec defaults (decay_coefficient=1.0 si <7j, signal_category="A" placeholder, scope="contact" par défaut, status="active" si expiresAt > now sinon "expired")
2. Backfill `signal_category` à partir de mapping `signalType` → category (PRD section 6.3) ; nécessite admin manuel sur les types non-mappés
3. Backfill `points` = `score` (juste rename / alias)
4. Backfill `effective_points` = `points × decay_coefficient`

**Migration data si CRÉER Signal séparé** :
1. Cohabitation 2 tables temporaire
2. Réécriture de tous les consumers (3 webhooks + lecture CrmContact.intentSignals)
3. Suppression IntentSignal après migration complète
- Plus risqué, plus long, mais structure plus propre.

**Recommandation finale** : EXTEND IntentSignal. Sprint S0 décide. Sprint S1 fait la migration.

**Migration data** : nombre d'IntentSignal en DB actuellement **NON VÉRIFIÉ** (accès DB Railway non utilisé pour cet audit). À VALIDER VERNON via `npx prisma studio` ou requête SQL.

### 2.4 PRD `SignalTypeRegistry` (NEW)

Aucun équivalent existant. Confirmé par grep.

**Décision** : **NEW model**. À seeder avec ~40 signal types listés dans PRD section 6.3 (catégories A-I). Seed dev-only (NODE_ENV-guarded à la Sprint 0 pattern).

**Champs PRD** : `signal_type` (PK VARCHAR), `category` (CHAR A-I), `default_points` (Int), `scope` (enum), `trigger_urgency` (immediate/rapid/passive/none), `description` (Text), `is_active` (bool).

**Composant UI requis** : `<SignalRegistryAdmin />` P2 — cf. section 6.

### 2.5 PRD `MarketSignal` (NEW)

Aucun équivalent existant. Confirmé par grep.

**Décision** : **NEW model**. Aucune fonctionnalité similaire dans le code (pas de campagne segment-wide, pas de market_signals, pas de competitor_event tracking).

**Note** : confondre potentiellement avec `MarketingIntel` (capture manuelle marketing observations) ou `IntelResult` (Intel module AI-powered). Aucun n'est l'équivalent. À garder distinct comme NEW.

---

## 3. Mapping vocabulaire et concepts

### 3.1 Pain Tier (T1/T2/T3)

| Aspect | Statut |
|---|---|
| Existe dans le code ? | **NON** (grep `pain_tier`, `painTier`, `T1`/`T2`/`T3` → 0 résultats) |
| Si non : nouveau champ sur quel model ? | `CrmContact` (ou Account si refactor) |
| Type | ENUM (`'T1'`, `'T2'`, `'T3'`) |
| Required ou nullable ? | PRD dit **required** |
| Default value ? | **À DÉFINIR avec Vernon** — recommandation : T2 par défaut (largest volume per PRD section 6.9) |
| Backfill stratégie pour les contacts existants ? | **À DÉFINIR** — option : tous T2 par défaut, audit manuel ensuite |
| Validation | CSV import : reject rows sans pain_tier (PRD requirement) |

### 3.2 Group (G1-G7B) vs verticals actuels

| Aspect | PRD `group` | CRM `vertical` |
|---|---|---|
| Type | ENUM 8 valeurs (G1, G2, G3, G4, G5, G6, G7A, G7B) | `String[]` (multi-select) |
| Valeurs actuelles | - | 7 verticals : `FinTech / Crypto`, `Family Office`, `CSP / Fiduciaries`, `Luxury Assets`, `iGaming`, `Yacht Brokers`, `Import / Export` (depuis `crm-config.ts:4-12`) |
| Cardinalité | Single value per Account (required) | Multi-select per CrmContact (array) |
| Sub-verticals | Pas mentionnés | 28 sub-verticals existants (`crm-config.ts:15-44`) |

#### Mapping vertical → group — version finale (Andy 2026-05-05)

| Vertical actuel | Group | Pain Tier default | Status |
|---|---|---|---|
| Family Office | **G4** | T2 | IN scope |
| CSP/Fiduciaries | **G1** | T2 | IN scope |
| Luxury Assets | **G6** | T2 | IN scope |
| Yacht Brokers | **G6** | T2 | IN scope |
| FinTech/Crypto (CSP crypto) | **G1** | **T1** | IN scope (intermediaries only) |
| FinTech/Crypto (compta crypto) | **G5** | **T1** | IN scope (intermediaries only) |
| iGaming | NULL | NULL | **OUT of scope** (clients finaux) |
| Import/Export | NULL | NULL | **OUT of scope** (clients finaux) |

**Note — sub-question Andy en suspens** : "Confirme que FinTech/Crypto = intermédiaires (CSP crypto, compta crypto, avocats crypto), pas exchanges/wallets/protocols ?" — pending réponse Andy.

**Sub-verticals actuels qui matchent les groupes PRD (dérivation auto pendant migration S1)** :
- "Corporate Lawyers", "M&A Lawyers", "Tax Lawyers", "International Contracts Lawyers" → **G2** Legal Deal-Flow
- "Immigration Lawyers" → **G7B** Immigration Law
- "RBI Specialists", "CBI Specialists" → **G3** Investment Gatekeepers
- "Trustees / Trust Companies", "CSPs", "Management Companies" → **G1** Structural Architects
- "Wealth Managers", "Multi-Family Offices (MFO)", "Asset Managers", "Fund Managers" → **G4** Wealth Intermediaries
- "Crypto Accountants", "Crypto Tax Advisors", "Crypto CSPs" → **G5** Compliance & Accounting (T1 high-intensity)
- "Real Estate Brokers", "Yacht Brokers", "Art Brokers", "Private Jets Brokers" → **G6** High-Ticket Settlement
- "Luxury Concierges", "Relocation Agencies" → **G7A** Luxury Concierges

#### Décision finale — Option B (Coexister) — RETENUE

- **`vertical` String[]** reste sur CrmContact (multi-select 7 valeurs marketing/segmentation)
- **`group` ENUM** nouveau champ single value sur CrmContact, requis pour scoring + sequence routing
- **`pain_tier` ENUM** (T1/T2/T3) nouveau champ single value sur CrmContact, default T2 pour la plupart, T1 pour FinTech/Crypto sub-verticals
- Pas de migration data (sauf seed du group à partir de sub-verticals dans Sprint S1)
- iGaming et Import/Export contacts existants : `group = NULL`, exclus du scoring engine (status `outreach_status: "excluded"` avec `exclusion_reason: "B2C, not intermediary"`)

**Conséquence opérationnelle** : seuls les contacts avec `group != NULL` sont éligibles au scoring + Lemlist routing. iGaming et Import/Export contacts restent dans le CRM (filtres marketing) mais pas de campagnes outbound automatisées.

### 3.3 Priority Level vs lifecycleStage

| Aspect | `priority_level` PRD | `lifecycleStage` actuel |
|---|---|---|
| Sémantique | Urgence d'action (P1=2h, P2=24h, P3=standard, Monitoring=watch) | Pipeline funnel (new_lead → closed_won/lost, 9 stages) |
| Cardinalité | 4 valeurs | 9 valeurs |
| Calculé ? | Auto-calculé (depuis priority_score + signal_count) | Manuel (drag & drop Kanban + auto-update via webhooks) |
| Concept | Prioritisation BD | Étape commerciale |

**Décision** : **COEXISTER** — ce ne sont pas le même concept. Les deux champs gardent leur sémantique distincte. Un même contact peut être :
- `lifecycleStage = "sequence_active"` ET `priority_level = "P1"` (en séquence, signal urgent juste détecté)
- `lifecycleStage = "meeting_booked"` ET `priority_level = "monitoring"` (rendez-vous pris, plus de signal urgent)

Les deux sont stockés sur `CrmContact`. Pas de migration nécessaire.

### 3.4 outreach_status vs lifecycleStage / lemlistStatus

| outreach_status PRD | lifecycleStage actuel | lemlistStatus actuel | Mapping |
|---|---|---|---|
| `monitoring` | `new_lead` (stage funnel) | null (pas en sequence) | **PARTIEL** : nouveau état distinct |
| `queued` | **NON** existant | **NON** | **NEW** state — utilisé quand sequence cible n'existe pas dans Lemlist |
| `in_sequence` | `sequence_active` | `"active"` | **MATCH PARTIEL** — ALIGN ou rename |
| `nurture` | **NON** existant explicitement | `"replied"` partiellement | **NEW** state |
| `excluded` | **NON** existant (`doNotContact` Boolean existe) | `"unsubscribed"` partiellement | **NEW** state explicite |

**Décision** : `outreach_status` est un **NEW field** distinct sur `CrmContact`. Couvre l'état Lemlist + workflow PRD-specific (queued, excluded with reason). Coexiste avec `lifecycleStage` (pipeline funnel) et `lemlistStatus` (état brut Lemlist).

Trois axes parallèles :
- `lifecycleStage` (9 valeurs) — pipeline commercial
- `outreach_status` (5 valeurs PRD) — workflow scoring engine
- `lemlistStatus` (5 valeurs) — sync direct Lemlist API

Risque : confusion utilisateur. Décision UX : afficher `priority_level + outreach_status` dans la queue, `lifecycleStage` dans le pipeline Kanban.

### 3.5 Persona (DM / OP)

| Aspect | Statut |
|---|---|
| Existe dans le code ? | **NON** (grep `persona`, `decision_maker`, `operational` → 0 résultats sur CrmContact) |
| Mapping possible | `jobTitle` (string) heuristique — CFO/CEO/COO = DM, Operations Manager = OP |
| Backfill stratégie | Heuristique sur `jobTitle` + admin manuel pour les ambiguïtés |
| Type | ENUM (`'decision_maker'`, `'operational'`) |
| Required ou nullable ? | PRD dit required pour routing sequences DM/OP — recommandation : nullable au début, required après backfill |

**Décision** : **NEW field** `persona` sur `CrmContact`. Backfill heuristique basé sur jobTitle + audit manuel.

---

## 4. Mapping endpoints API

### 4.1 Endpoints PRD vs existant

| Endpoint PRD | Endpoint actuel équivalent | Décision |
|---|---|---|
| `POST /api/signals` | `POST /api/webhooks/clay`, `/trigify`, `/n8n` (chacun écrit dans IntentSignal) | **NEW** endpoint unifié + adapter layer ; les 3 webhooks existants soit POST internally vers `/api/signals`, soit le code de création IntentSignal est centralisé dans une lib partagée |
| `GET /api/accounts/:id/score` | **NON** existant | **NEW** ; (pas d'équivalent score sur Company ; `relationshipScore` lisible via `/api/crm/contacts/[id]`) |
| `GET /api/queue?bd=&level=` | **NON** existant | **NEW** ; (filtrage manuel actuellement via `/api/crm/deals` ou `/api/crm/dashboard`) |
| `GET /api/accounts?name=` | `GET /api/crm/contacts?q=` (search) ou `GET /api/crm/contacts/search` | **EXISTS partiel** ; recherche fuzzy à confirmer (lecture du code search non faite ici) |
| `POST /api/market-signals` | **NON** | **NEW** |
| `PUT /api/market-signals/:id/activate` | **NON** | **NEW** |
| `GET /api/market-signals` | **NON** | **NEW** |
| `GET /api/sequences/check?group=&pain_tier=&persona=` | **NON** existant ; `getLemlistCampaigns()` (`src/lib/lemlist.ts:35`) liste toutes les campaigns | **NEW** ; logique : appelle `getLemlistCampaigns()` puis filtre par naming convention `{Group}-{PainTier}-{Persona}` |
| `GET /api/signal-registry` | **NON** | **NEW** |
| `PUT /api/signal-registry/:signal_type` | **NON** | **NEW** (admin only) |

**Total** : **9 NEW endpoints** + **0 REFACTOR direct** (mais l'adapter layer modifie indirectement les 3 webhooks Clay/Trigify/N8N pour rediriger leur logique vers `/api/signals`).

### 4.2 Webhook ingestion architecture

#### Architecture actuelle

```
Clay     → POST /api/webhooks/clay     → IntentSignal (source="clay")     → recalc CrmContact.relationshipScore (sum, capped 100)
Trigify  → POST /api/webhooks/trigify  → IntentSignal (source="trigify")  → recalc CrmContact.relationshipScore
N8N      → POST /api/webhooks/n8n     → 3 actions : create_signal, update_contact, create_interaction
Lemlist  → POST /api/webhooks/lemlist → CrmContact.lemlistStatus, lemlistStep + OutreachCampaign counters (pas IntentSignal)
Inbound  → POST /api/crm/webhooks/inbound-lead → CrmContact + Deal + Activity + Task + Telegram (pas IntentSignal)
Website  → POST /api/support/webhooks/website-form → SupportTicket
```

**Caractéristiques actuelles** :
- Chaque webhook a un schéma différent (Clay : `email + enrichment_type + data + score` ; Trigify : `email + signal_type + title + detail + score + name + company`)
- Validation Zod par schéma (Sprint 2.3)
- Auth `requireWebhookSecret` (Sprint 0)
- Recalc relationshipScore inline = somme des active signals
- **Pas de signal_category, pas de scope, pas de decay coefficient**

#### Architecture PRD proposée

```
Clay, Trigify, Apify, Lemlist, Manual, CRM Internal
                    ↓
          POST /api/signals (unifié, schéma commun)
                    ↓
        Validation contre SignalTypeRegistry
                    ↓
          Idempotency check (24h dedup)
                    ↓
          Insert Signal + recompute Intent Score
                    ↓
        Priority Level evaluation (event-driven)
                    ↓
   [P1?] Telegram alert + AlertPanel update
   [P2?] Queue reorder
   [P3?] Lemlist enroll (DM + OP staggered)
```

#### Compatibilité

| Aspect | Alignement |
|---|---|
| Format Clay actuel ↔ Signal PRD | **PARTIEL** : `email` + `score` matchent, mais `enrichment_type` ≠ `signal_type` exact, pas de `scope` ni `signal_category` |
| Format Trigify actuel ↔ Signal PRD | **PARTIEL** : meilleur match (déjà `signal_type` champ explicite) |
| Adapter layer requis ? | **OUI** — Clay/Trigify/N8N webhooks doivent transformer leur payload vers le format Signal canonique avant écriture |

**Stratégie de migration recommandée** :
1. Sprint S1 : créer `POST /api/signals` + format canonique
2. Sprint S1 : refactor `clay/route.ts` → appel interne à logique signal centralisée
3. Sprint S1 : idem pour `trigify/route.ts`, `n8n/route.ts`
4. Backward compat : les 3 webhooks externes restent (URLs fixes côté Clay/Trigify/N8N), mais leur traitement passe par `/api/signals`
5. **Lemlist webhook** ne devient PAS un signal source au sens PRD — il met à jour `OutreachCampaign` counters et `CrmContact.lemlistStatus`. Mais certains events Lemlist (`emailsOpened`, `emailsClicked`) sont des signaux Cat B → à router via `/api/signals` aussi (Sprint S1).

---

## 5. Background jobs

### 5.1 Jobs PRD vs existant

| Job PRD | Existe ? | Décision |
|---|---|---|
| Daily Decay Job (02:00 UTC) | **NON** ; aucun cron decay sur IntentSignal (juste `expiresAt` filtré read-time) | **NEW** ; ajouter au worker (cf. ci-dessous) |
| Priority Level Watcher (event-driven) | **NON** ; pas de transition tracking | **NEW** ; déclenchée après chaque signal ingestion |
| Sequence Queue Processor (daily) | **NON** ; pas de queued state | **NEW** |
| Signal Cleanup (weekly) | **NON** ; signals expirés non archivés (juste filtrés à la lecture) | **NEW** |

### 5.2 Architecture workers actuelle

Référence `FEATURES.md` section T2 :
- **`workers/ai-worker/`** : process Claude API jobs (`ai:score-lead`, `ai:generate-article`, `ai:news-scan`, `ai:keyword-discover`, `ai:geo-test`, `ai:score-news`)
- **`workers/sync-worker/`** : process Google sync (`sync:email`, `sync:calendar`)
- Coordination via table `Job` (claim atomique, polling)
- `ENABLE_WORKERS` feature flag — statut prod à confirmer

### 5.3 Décision

**Recommandation** : créer un **nouveau type de jobs `scoring:*`** dans le système existant + l'attribuer au `ai-worker` :
- `scoring:decay-recompute` (daily 02:00 UTC) — ajouté à `AI_WORKER_TYPES` dans `worker-config.ts`
- `scoring:priority-evaluate` (event-driven, déclenché en POST /api/signals) — peut rester inline ou queued selon ENABLE_WORKERS
- `scoring:sequence-queue-flush` (daily) — ajouté à `AI_WORKER_TYPES`
- `scoring:signal-cleanup` (weekly) — idem

**Alternative** : créer un `workers/scoring-worker/` séparé. **Pas recommandé** : ajoute complexité infra (3ème service Railway) sans bénéfice clair vu le faible volume estimé. Garder l'architecture 2-workers.

**Cron Railway** : actuellement utilisé pour `/api/intel/cron`, `/api/telegram/check-upcoming`, `/api/telegram/weekly-digest`. Le mécanisme exact (Railway cron jobs ou worker polling) à clarifier avec Vernon (cf. backlog Intel `FEATURES.md`).

---

## 5b. Décisions opérationnelles Andy (2026-05-05)

Cette section documente les décisions opérationnelles tranchées par Andy le 2026-05-05 qui modifient ou précisent des choix initialement laissés ouverts dans le PRD.

### 5b.1 — Auto-assignment BD (override section 6.10 PRD)

**Décision Andy 2026-05-05** : auto-assignment = **Random 50/50 entre Andy et Paul Louis**. Override le code actuel `getOwnerForGeo`. Vernon (UAE) exclu de l'auto-assignment (cohérent avec ASSUMPTION PRD section 6.10).

**Implications techniques** :
- Le helper `src/lib/crm-config.ts:getOwnerForGeo()` ne sera plus utilisé pour le scoring engine
- Nouvelle fonction `getRandomBdAssignment()` qui retourne aléatoirement Andy ou Paul Louis (50/50)
- Le geo-based assignment existant reste actif pour les **leads inbound non-scoring** (`/api/crm/webhooks/inbound-lead`) — coexistence
- Sprint S0 ou S1 : décider si on renomme `dealOwner` ou si `assigned_bd` est un nouveau champ

**Conséquence sur backlog** : le bloquant **B6** (geo-based vs random 50/50) initialement marqué "garder geo-based" est **inversé** — Andy a tranché pour Random 50/50 sur scoring engine. Geo-based reste pour autres flux (inbound forms).

### 5b.2 — Score override expiration (réponse Open Question #4)

**Décision proposée Vernon** : override expire après 30 jours, ping Telegram BD 3 jours avant expiration.

**Spécification technique** :
- Nouveau champ `score_override_expires_at` TIMESTAMP NOT NULL (set à `score_override_set_at + 30 days`)
- Daily Decay Job (`scoring:decay-recompute`) gère l'expiration : si `now() > score_override_expires_at`, reset `score_override = NULL` et `score_override_note = NULL`
- Notification Telegram 3 jours avant expiration : nouveau job `scoring:override-expiry-notify` (daily check)
- Audit log obligatoire pour chaque création / expiration / extension d'override

**Statut** : **À VALIDER avec Andy** (sub-question pending).

### 5b.3 — Market Signal workflow (résolution Open Question #5)

**Décision Andy 2026-05-05** : Apify détecte signal → CRM crée draft Market Signal + Lemlist campaign en draft → BD reçoit notif Telegram → BD valide depuis Oxen OS (avec preview) ou Lemlist UI → campaign passe en active.

**Workflow détaillé** :
1. **Apify ou source détecte** un événement segment-wide (competitor restriction, regulatory change, etc.)
2. **POST `/api/market-signals`** depuis Apify (via webhook ou n8n adapter) → crée `MarketSignal` record en `status: "draft"`
3. **Auto-create Lemlist campaign** en draft via `createCampaign()` (nouvelle fonction à ajouter dans `src/lib/lemlist.ts` — n'existe pas actuellement)
4. **Notif Telegram BD** (assigned_bd random 50/50) : preview du market signal + lien CRM
5. **BD valide** depuis Oxen OS via `<MarketSignalPanel />` (recommandé) OU directement Lemlist UI
6. **Sur validation** : `PUT /api/market-signals/:id/activate` → enroll non-sequenced accounts dans Lemlist campaign + inject context note dans sequenced accounts

**Statut UX validation** : **À CONFIRMER avec Andy** — préfère-t-il valider depuis Oxen OS (avec preview structuré) ou directement Lemlist UI (plus rapide mais hors-app) ?

**Implication code** :
- Nouvelle fonction `createCampaign(name, draft=true)` dans `src/lib/lemlist.ts` (n'existe pas — vérifier API Lemlist supporte création de campaign programmatique)
- Si NON supporté : fallback alerte Telegram avec lien manuel vers Lemlist UI

---

## 6. UI components

### 6.1 Components PRD vs existant

| Component PRD | Pri | Existe ? | Décision |
|---|---|---|---|
| `<PriorityQueue />` | P0 | **NON** | **NEW** ; nouvelle page ou sub-module CRM |
| `<ScoreCard />` | P0 | **NON** ; pas de "ScoreSection" sur `/crm/contacts/[id]` (vérifié grep) | **NEW** ; à intégrer dans page détail contact |
| `<SignalTimeline />` | P0 | **NON** ; mais `Activity` timeline existe (`<ContactSlideOver />` ou détail contact) | **NEW** distinct ; les Activity et IntentSignal sont 2 concepts (activities = interactions humaines, signals = events scoring) |
| `<AlertPanel />` | P0 | **NON** ; pas d'alert sidebar dédiée (Telegram + sidebar nav existent) | **NEW** ; sidebar component pour P1 alerts |
| `<PriorityLevelBadge />` | P0 | **NON** | **NEW** ; pattern similaire à `<StatusBadge />` Compliance |
| `<SequenceStatus />` | P1 | **NON** ; affichage Lemlist actuel limité à `lemlistStep / lemlistTotalSteps` simple | **NEW** ; doit afficher DM + OP enrollment side by side |
| `<MarketSignalPanel />` | P1 | **NON** | **NEW** |
| `<SignalRegistryAdmin />` | P2 | **NON** | **NEW** (admin only — pattern `requireRole`) |
| `<ScoreOverrideModal />` | P2 | **NON** | **NEW** ; modal classique pattern existant |

### 6.2 Pages à modifier

- **`/crm/contacts/[id]`** : intégrer `<ScoreCard />` (en haut), `<SignalTimeline />` (section dédiée), `<SequenceStatus />` (côté Lemlist)
- **`/crm`** ou nouvelle page `/crm/queue` : intégrer `<PriorityQueue />` comme view principale BD
- **Sidebar globale** : ajouter `<AlertPanel />` ou widget P1 alerts (compteur badge sur "CRM" ou nouvelle entrée "Priority Queue")
- **`/crm/outreach`** : potentiellement intégrer `<MarketSignalPanel />` comme nouveau sub-module
- **`/settings`** ou nouvelle page admin : `<SignalRegistryAdmin />`

---

## 7. Intégrations externes

### 7.1 Lemlist API — Open Question #1 du PRD (CRITIQUE)

**Question PRD** : Lemlist API supporte-t-il pause + step advancement programmatiques ?

#### État actuel du code Oxen OS

Lecture exhaustive de `src/lib/lemlist.ts` (177 lignes) :

| Fonction | Endpoint Lemlist appelé | Action |
|---|---|---|
| `getLemlistCampaigns()` | `GET /api/campaigns` | Liste toutes les campagnes (cache 1h) |
| `enrollLead()` | `POST /api/campaigns/{id}/leads/{email}` | Enrolle un lead dans une campagne |
| `removeLead()` | `DELETE /api/campaigns/{id}/leads/{email}` | Retire un lead d'une campagne spécifique |
| `removeLeadFromAll()` | `DELETE /api/leads/{email}` | Retire de toutes campagnes (unsubscribe) |
| `lemlistAuth()` | - | Helper Basic auth |
| `isLemlistConfigured()` | - | Vérification env var |

**Aucune fonction pause** dans le code.
**Aucune fonction step advancement** dans le code.
**Aucun appel à un endpoint type `/api/campaigns/{id}/leads/{email}/pause`** ou `/advance` ou `/step`.

#### Réponse à Open Question #1

**INCONNU côté code Oxen OS** mais **NON IMPLÉMENTÉ ACTUELLEMENT**.

À VÉRIFIER côté Lemlist API docs (https://developer.lemlist.com) :
- Si l'API expose `POST /campaigns/{id}/leads/{email}/pause` ou équivalent → faisable
- Si l'API n'expose que enroll/remove (cf. ce qui est dans le code) → **NON faisable** sans contournement

#### Si NON : impact sur le PRD

Triggers PRD section 6.7 "Immediate Action (2h SLA) — pauses sequence" :
- Devient **alertes manuelles** : Telegram → BD pause manuellement dans Lemlist UI
- Section 6.7 du PRD à reviser
- Impact sur 8 triggers Immediate :
  1. BD LinkedIn profile visit after email (+10)
  2. Oxen pricing/demo page visit (+12)
  3. Email opened 3+ times in 24h (+8)
  4. Click on link in email (+10)
  5. Comment on Oxen post (+10)
  6. Public banking frustration post (+12)
  7. Lemlist call connected, conversation >2 min (+10)
- **Workaround** : remove + re-enroll cycle (`removeLead` + plus tard `enrollLead`) pour simuler pause+resume — fonctionnel mais perd le "step" exact

#### Recommandation

Vérifier officiellement les capabilities Lemlist API **avant Sprint S5** (Sequence Routing). Si NON, scope du PRD section 6.7 à reduire (alertes manuelles uniquement, pas de pause auto).

### 7.2 Clay — Pattern Match (Open Question PRD section 6.2)

**Statement PRD** : "Pattern Match compares against converted clients and pipeline prospects. Clay used for enrichment only, not Pattern Match."

#### État actuel

- Clay enrichit les CrmContacts (champs `companySize`, `fundingStage`, `techStack`, `annualRevenueRange`, `country`, `city`)
- Clay webhook `/api/webhooks/clay/route.ts` crée des `IntentSignal` avec `source="clay"`, `signalType="tech_install"` (par défaut), `score=10`
- **Aucune logique de Pattern Match dans le code** : pas de comparaison contre `closed_won` deals ou pipeline `Deal[]` actifs

**Confirmé** : Pattern Match (PRD section 6.2 — 5 points sur ICP) **n'existe pas actuellement**. À développer Sprint S2 (ICP Scoring).

**Logique à implémenter** :
- Pour un Account/CrmContact donné : query DB
  - Reference pool A : `Deal` where `stage = "closed_won"` (converted clients)
  - Reference pool B : `Deal` where `stage NOT IN ("closed_won", "closed_lost")` (pipeline prospects)
- Comparer dimensions : `vertical`/`subVertical`, `companySize`, `geoZone`/`country`, `fundingStage`/`annualRevenueRange`
- Strong match (3+ dimensions) → 5 pts ; Partial (2 dimensions) → 3 pts ; Pipeline-only match → 3 pts ; No match → 0

### 7.3 Trigify, Apify, n8n

#### Trigify

- Webhook implémenté : `src/app/api/webhooks/trigify/route.ts` (78 lignes)
- Crée IntentSignal avec `source="trigify"`, `signalType` du payload, `score=15` par défaut
- Crée le contact si inconnu (auto-create avec `acquisitionSource="Other"`, `acquisitionSourceDetail="Trigify"`)
- **Statut** : ✅ Connecté et fonctionnel
- Cross-référence PRD-002 (à venir, hors scope ici)

#### Apify

- **NON connecté** au CRM actuellement
- Pas de `/api/webhooks/apify/route.ts`
- Cross-référence PRD-003 (à venir) — adapter layer Apify + n8n

#### n8n

- Webhook implémenté : `src/app/api/webhooks/n8n/route.ts`
- 3 actions supportées : `create_signal`, `update_contact`, `create_interaction`
- Format flexible : `{ action, contactEmail, data }`
- **Statut** : ✅ Connecté ; peut servir de proxy générique pour Apify en attendant adapter dédié

### 7.4 Telegram Bot

| Fonctionnalité PRD | État actuel |
|---|---|
| Alerte BD sur P1 par chat_id par BD | **Réalisable** ; `Employee.telegramChatId` existe (line 71 schema) ; `inbound-lead` route fait déjà cette logique (line 211-242) |
| `sendTelegramNotification` helper | **Existe** dans `src/lib/telegram.ts` |
| Différenciation par BD | **Réalisable** ; pattern : `prisma.employee.findFirst({ where: { name: dealOwner } })` puis `chatId = employee?.telegramChatId` |
| Format alert P1 | **NEW** template à définir (PRD-driven) |

**Décision** : Telegram intégration côté Oxen OS est **prête**. Sprint S4 ajoute le template P1 alert + déclenchement post-Priority Level Watcher.

### 7.5 Trigify schema (référence)

Webhook `/api/webhooks/trigify` reçoit (depuis `_schemas.ts` non lu mais inféré du route) :
```
email (required)
signal_type (optional, default "job_change")
title (optional, default "Trigify Signal")
detail (optional)
score (optional, default 15)
name (optional, fallback split email)
company (optional)
```

→ Cohérent avec le format Signal canonique PRD. Adapter trivial requis.

---

## 8. Open Questions du PRD — réponses

État au 2026-05-05 : **5/7 résolues**, 2 pending.

| # | Question PRD | Statut | Réponse |
|---|---|---|---|
| 1 | Lemlist API supports pause + step advancement ? | **PENDING** | Pending Vernon vérification (cette semaine). Code Oxen OS actuel ne l'implémente pas (`src/lib/lemlist.ts` : enroll + remove only). À vérifier côté docs Lemlist officielles. |
| 2 | Existing CRM accounts tagged with industry, size, jurisdiction ? | **RESOLVED** | DB check 2026-05-01 (`scripts/db/check-counts.ts`) : 9 contacts test seed, 5/9 sans vertical (55.6%), 0 IntentSignal. Pre-launch state — pas un blocker. |
| 3 | Signal API: auth per source ? | **RESOLVED** | OUI ; chaque webhook a son env var dédié (`CLAY_WEBHOOK_SECRET`, `TRIGIFY_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`, `WEBSITE_WEBHOOK_SECRET`, `LEMLIST_WEBHOOK_SECRET` HMAC). Sprint 0 hardening déjà en place. Pour `/api/signals` unifié : maintenir le pattern par source via `requireWebhookSecret()`. |
| 4 | Should score_override expire ? | **PENDING (Andy validation)** | Vernon proposes 30 jours auto-expire + ping Telegram BD 3 jours avant (cf. section 5b.2). À valider par Andy. |
| 5 | Market campaigns auto-create Lemlist ? | **RESOLVED** | OUI — auto-create draft + BD validate manual (cf. section 5b.3). Implication code : nouvelle fonction `createCampaign(name, draft=true)` dans `src/lib/lemlist.ts` (vérifier API Lemlist supporte création programmatique). |
| 6 | Clay mapping rules pour group + pain tier ? | **PENDING — to define in Sprint S0** | Mapping de base défini (cf. section 3.2) via sub-verticals → group + Pain Tier T1/T2 par sub-vertical. Règles fines (heuristiques companySize / country / fundingStage → group/tier) à formaliser admin-configurable en Sprint S0. |
| 7 | Auto-assignment BD : geo-based (existing) vs random 50/50 (PRD) ? | **RESOLVED (Andy 2026-05-05)** | Random 50/50 Andy/Paul Louis pour scoring engine. Geo-based (`getOwnerForGeo`) reste pour autres flux (inbound forms). Vernon (UAE) exclu. Cf. section 5b.1. |

---

## 9. Risques et bloquants

### 9.1 Bloquants techniques (à résoudre AVANT dev)

| # | Bloquant | Impact | Action |
|---|---|---|---|
| **B1** | Open Q #1 Lemlist API pause/advance | Si NON, section 6.7 du PRD à reviser, triggers Immediate deviennent manuels | Vérifier docs Lemlist officielles + tester avec API key. **Avant Sprint S5.** |
| **B2** | Mapping `vertical` → `group` (7 → 8, pas 1-to-1) | Migration data complexe ; Option A/B/C à trancher | Décision Vernon/Andy : Coexister recommandé. **Avant Sprint S1.** |
| **B3** | Architecture `Signal` vs `IntentSignal` | Refactor (EXTEND IntentSignal) vs coexistence vs nouveau model `Signal` | Décision technique : EXTEND IntentSignal recommandé. **Avant Sprint S1.** |
| **B4** | `dealOwner` string → FK Employee | Bloque `assigned_bd UUID FK` du PRD ; refactor cross-module | Sprint S0 dédié AVANT scoring (déjà dans backlog `FEATURES.md`) |
| **B5** | CRM Companies "+ New Company" non fonctionnel | TODO `companies/page.tsx:119` ; bloque flux PRD nouveaux Accounts | Sprint S0 (déjà dans backlog `FEATURES.md`) |
| **B6** | Auto-assignment `getOwnerForGeo` géo-based vs PRD random 50/50 | Si on garde geo-based, certains BD sont sur-chargés ; si on passe à random, casse la logique métier UAE/Asia=Vernon | Décision Vernon — recommandation : **garder geo-based**, le PRD random est erroné par rapport au métier réel |

### 9.2 Risques de migration

> **Risques migration drastiquement réduits par état DB pre-launch (vérifié 2026-05-01)**. M1-M8 deviennent triviaux sur 9 contacts test. Le vrai risque migration vient si Andy commence le marketing AVANT Sprint S1, créant des CrmContacts production sans Pain Tier / Group / Persona. **D'où l'urgence de Sprint S0 + S1.**

| # | Risque | Estimation v1 | Réalité v2 (vérifié DB) | Mitigation |
|---|---|---|---|---|
| **M1** | CrmContacts sans `vertical` rempli | % INCONNU | **5/9 contacts** (55.6%) — sur 9 seeds test, négligeable | Backfill manuel sur 5 rows |
| **M2** | CrmContacts sans `geoZone` rempli | % INCONNU | **non audité** mais sur 9 seeds, trivial | Backfill via `country` + COUNTRY_GEO_MAP |
| **M3** | Pas de Pain Tier sur contacts existants | 100% | 100% sur 9 contacts seed | Default T2 (manual audit trivial) |
| **M4** | Pas de Group sur contacts existants | 100% | 100% sur 9 contacts seed | Mapping `subVertical`→group automatique (trivial sur 9 rows) |
| **M5** | Pas de Persona sur contacts existants | 100% | 100% sur 9 contacts seed | Heuristique `jobTitle` (trivial sur 9 rows) |
| **M6** | IntentSignal existants sans `signal_category` | 100% | **0 IntentSignal en DB** — aucune migration data | **NON APPLICABLE** |
| **M7** | Migration `score` → `points` + `effective_points` × decay | 100% | **0 IntentSignal** — aucun row à migrer | **NON APPLICABLE** |
| **M8** | `dealOwner` string sur CrmContacts/Deals → FK Employee | 100% | trivial sur 9 contacts seed | Script join sur `Employee.name` (3 valeurs fixes) |

**Risque dominant déplacé** : ce n'est plus la migration data, mais le **timing vs lancement marketing**. Si Andy lance des campagnes Lemlist en prod avant que Sprint S1 (Signal ingestion + scoring fields) soit livré, on génère des CrmContacts production qui devront être backfillés rétroactivement (Pain Tier / Group / Persona / icp_score / etc.). C'est exactement la situation à éviter.

**Mitigation principale** : terminer Sprint S0 + S1 **avant le go-live marketing**. Si pas faisable, fallback : freeze des campagnes Andy jusqu'à S1 livré.

---

## 10. Découpage en sprints — proposition

**Hypothèse équipe** : Vernon + Johnny (1 dev externe) + Claude Code en support

### Sprint S0 — Pré-requis (1 semaine)

**Objectif** : nettoyer la base avant d'ajouter du complexe.
- [ ] Réparer Companies "+ New Company" (cf. backlog `FEATURES.md` 🔴)
- [ ] Refactor `dealOwner` string → FK Employee (cf. dette technique `FEATURES.md`)
- [ ] **Décider mapping `vertical → group`** (Vernon/Andy) — Option A/B/C
- [ ] **Vérifier Lemlist API capabilities** (Open Q #1) via docs + test API key
- [ ] **Décider architecture** Signal (NEW) vs IntentSignal (EXTEND)
- [ ] **Décider auto-assignment** : geo-based actuel vs random 50/50 PRD

**Output** : 5 décisions tranchées + 2 tickets backlog résolus.

### Sprint S1 — Models + Signal ingestion (1 semaine)

- [ ] Migration Prisma : extend IntentSignal avec 7 nouveaux champs (signal_category, scope, account_id implicit, ingested_at, decay_coefficient, effective_points, status)
- [ ] Migration Prisma : extend CrmContact avec 22 champs PRD + 5 fields persona
- [ ] Migration Prisma : NEW models `SignalTypeRegistry` + `MarketSignal`
- [ ] Seed `SignalTypeRegistry` avec 40 types du PRD (NODE_ENV-guarded)
- [ ] Endpoint `POST /api/signals` (validation Zod + idempotency 24h dedup)
- [ ] Adapter layer : refactor webhooks Clay/Trigify/N8N → POST internal `/api/signals`
- [ ] Tests unitaires ingestion (multi-source + dedup + invalid signal type)
- [ ] Backfill IntentSignal existants (decay_coefficient + signal_category placeholder)

### Sprint S2 — ICP Scoring (1 semaine)

- [ ] Computation ICP Score 5 dimensions (industry/size/DM/geography/pattern)
- [ ] Migration : champs `icp_score` (renommer plage 0-100 → 0-50) + `icp_breakdown` (redéfinir structure)
- [ ] Recompute trigger sur création/edit Account (CrmContact)
- [ ] **Pattern Match logic** : query `Deal.stage="closed_won"` + pipeline ; comparer 4 dimensions
- [ ] Endpoint `GET /api/accounts/:id/score` (ICP partie + breakdown)
- [ ] UI : intégrer `<ScoreCard />` (squelette) sur `/crm/contacts/[id]`

### Sprint S3 — Intent Scoring + Decay (1 semaine)

- [ ] Computation Intent Score depuis signals actifs (scope account + contact rolling up)
- [ ] Time decay 3 paliers : 0-7j (1.0) / 8-30j (0.75) / 31-90j (0.50)
- [ ] **Daily Decay Job** (`scoring:decay-recompute` ajouté à AI_WORKER_TYPES, schedule 02:00 UTC)
- [ ] Recompute Intent en temps réel sur signal ingestion (event-driven)
- [ ] Cap à 50 points
- [ ] UI : enrichir `<ScoreCard />` avec ICP donut + Intent donut

### Sprint S4 — Priority Level + Transitions (1 semaine)

- [ ] Champs `priority_level`, `priority_level_changed_at`, `priority_level_grace_until` sur CrmContact
- [ ] **Priority Level Watcher** event-driven (déclenché post POST /api/signals)
- [ ] Hard entry rule : score 40+ AND signal_count 2+
- [ ] Telegram alerts P1 par BD chat_id (template + `sendTelegramNotification`)
- [ ] Endpoint `GET /api/queue?bd=&level=` (paginated + top 3 signals per account)
- [ ] Tests transitions (P3→P2→P1, P1→P2 avec grace 48h)
- [ ] UI : `<PriorityLevelBadge />` partout + `<AlertPanel />` sidebar (squelette)

### Sprint S5 — Sequence Routing + Multi-threading (1 semaine)

- [ ] Champs `persona`, `target_sequence_id`, `enrolled_sequence` sur CrmContact
- [ ] Routing logic : `Group × PainTier × Persona` → naming `{Group}-{PainTier}-{Persona}`
- [ ] Lemlist enrollment auto via `enrollLead()` existant — **DM enrolled immediately, OP staggered 24-48h**
- [ ] Endpoint `GET /api/sequences/check?group=&pain_tier=&persona=` (utilise `getLemlistCampaigns()` cached + filter par naming)
- [ ] State `queued` quand sequence n'existe pas
- [ ] **Sequence Queue Processor** (`scoring:sequence-queue-flush` daily worker job)
- [ ] **SI Lemlist API limité** (cf. B1) : fallback alertes manuelles via Telegram pour pause/advance triggers
- [ ] UI : `<SequenceStatus />` sur contact detail (DM + OP side by side)

### Sprint S6 — UI Components (2 semaines)

Semaine 1 :
- [ ] `<PriorityQueue />` page principale BD (`/crm/queue` ou view dans `/crm`)
- [ ] `<ScoreCard />` complet (ICP/Intent donuts + Priority Score bar + Group/PainTier badges)
- [ ] `<SignalTimeline />` chronologique avec source/category/decay/age

Semaine 2 :
- [ ] `<AlertPanel />` sidebar — badge count + click → account detail
- [ ] `<PriorityLevelBadge />` avec couleurs (rouge P1, orange P2, bleu P3, gris Monitoring)
- [ ] `<SequenceStatus />` finalisé

### Sprint S7 — Market Signals + Admin (1 semaine)

- [ ] Models et API : `POST/GET /api/market-signals`, `PUT /api/market-signals/:id/activate`
- [ ] `<MarketSignalPanel />` create + preview + activate
- [ ] `<SignalRegistryAdmin />` (admin only via `requireRole("admin")`)
- [ ] `<ScoreOverrideModal />` avec justification text + audit log
- [ ] **Signal Cleanup** weekly job (`scoring:signal-cleanup` archive >180j)

### Sprint S8 — Tests, monitoring, polish (3-4 jours)

- [ ] Tests E2E workflows critiques (P1 alert flow, sequence enrollment DM+OP)
- [ ] **Cost monitoring Anthropic** (cf. backlog `FEATURES.md` — pertinent ici car les workers AI seront sollicités pour Pattern Match + auto-classification)
- [ ] **Rate limiting endpoints** scoring (cf. Sprint 4 prévu — pertinent pour `/api/signals`)
- [ ] Doc utilisateur Andy/PM (vue Priority Queue, comprendre les badges)
- [ ] Migration data CrmContacts existants (backfill group / pain_tier / persona — **trivial sur 9 contacts seed**)
- [ ] Audit logs (toutes les mutations score_override, priority_level transitions)

**Total revu v2** : **8 semaines** (vs 9-10 estimation v1) compte tenu du risque migration minimal confirmé. Sprint S8 (tests + migration data) ramené à 3-4 jours sur 9 contacts seed (vs 1 semaine v1).

---

## 11. Recommandations Vernon

### 11.1 À décider AVANT lancement (Sprint S0 obligatoire)

**5 décisions tranchées** par Andy 2026-05-05 (cf. sections 3.2, 5b) :
- ✅ Mapping `vertical` → `group` : Option B Coexister + table finale (Family Office=G4, CSP=G1, Luxury/Yacht=G6, FinTech-CSP=G1/T1, FinTech-compta=G5/T1, iGaming + Import/Export OUT)
- ✅ Architecture `Signal` : EXTEND IntentSignal (Vernon proposed v1, retained)
- ✅ Pain Tier default value : T2 (T1 pour FinTech/Crypto sub-verticals)
- ✅ Auto-assignment : Random 50/50 Andy/Paul Louis pour scoring engine, geo-based reste pour inbound flows
- ✅ Market campaigns auto-create Lemlist : auto-draft + BD validate manual

**2 décisions encore en attente** :

1. **Lemlist API capabilities** : Vernon vérifie cette semaine (Open Q #1) — pause/advance API support. Si NON, fallback alertes manuelles (cf. section 7.1).
2. **Validation finale Andy** :
   - Sub-question : "FinTech/Crypto IN scope = intermédiaires (CSP crypto, compta crypto, avocats crypto), pas exchanges/wallets/protocols ?" (cf. section 3.2)
   - Sub-question : Override 30 jours auto-expire + Telegram 3 jours avant (cf. section 5b.2) — accepted ?
   - Sub-question : UX Market Signal validation depuis Oxen OS vs Lemlist UI (cf. section 5b.3) — préférence ?

### 11.2 À discuter avec le PM lundi

- Roadmap 9-10 semaines : valider la cadence et les arbitrages
- Frictions Andy observées en Semaine 1 d'onboarding → potentiellement modifier priorisation Sprint S5/S6
- Quand brancher le PM sur la review des PRs Johnny ?
- Métriques de succès post-launch : O1 (80% P1 → conversation 7j), O2 (P1 contact 2h), etc. — instrumentation via quels events ?

### 11.3 À discuter avec Andy

- **Mapping vertical → group définitif** : vu les 3 verticals sans match (FinTech, iGaming, Import/Export), comment les classer ? Comme T1 high-intensity dans groupes existants ?
- **Pain Tier criteria explicites** : quels signaux objectifs déterminent T1 vs T2 vs T3 par groupe ?
- **Définitions DM vs OP par groupe** : G1 fiduciaries → DM = associé/managing partner, OP = compliance officer ? Lister par groupe.
- **Sequences Lemlist actuelles** : combien existent déjà avec naming `{Group}-{PainTier}-{Persona}` ? Si zéro, Andy doit en créer ~24 (8 groupes × 3 tiers × 2 personas) ou commencer prioritaires.

### 11.4 À discuter avec Johnny (dev externe)

- Faisabilité technique 9 sprints en 9-10 semaines : capacity / parallelisable ?
- Sprint S2 (ICP) et S3 (Intent) en parallèle possible ?
- Sprint S6 (UI 2 semaines) peut-il commencer en S5 squelette et finir en S6 ?
- Tests E2E : framework existant (Playwright ?) ou nouvelle stack ?
- Workers : préfère-t-il étendre `ai-worker` existant ou créer `scoring-worker` séparé ?

---

## 12. Annexes

### 12.1 Fichiers code lus pour cet audit

| Fichier | Lignes lues | Notes |
|---|---|---|
| `prisma/schema.prisma` | 1513 (sélectif) | Models : Employee, Company, CrmContact, Deal, Activity, Email, IntentSignal, OutreachCampaign, Job |
| `src/lib/crm-config.ts` | 296 (head 100) | Verticals, sub-verticals, geo zones, deal owners, pipeline stages, GEO_OWNER_MAP |
| `src/lib/lemlist.ts` | 177 (full) | **Critique** : seul lemlist library, 4 fonctions implémentées |
| `src/app/api/webhooks/clay/route.ts` | 64 (full) | IntentSignal creation pattern |
| `src/app/api/webhooks/trigify/route.ts` | 78 (full) | IntentSignal creation pattern |
| `src/app/api/crm/webhooks/inbound-lead/route.ts` | 262 (full) | Auto-assignment + Telegram + Activity creation |
| `src/app/api/crm/` (listing) | - | 21 sub-modules (ai, audit, automation, companies, contacts, dashboard, deals, etc.) |
| `src/app/api/lemlist/` (listing) | - | 5 routes : campaigns, debug, enroll, remove, sync |
| `grep "intentSignal\|IntentSignal"` | 5 fichiers | clay, trigify, n8n webhooks + ai/classify-lead + components/crm/types.ts |
| `grep "getOwnerForGeo"` | 5 fichiers + crm-config | Auto-assignment patterns |

### 12.2 État DB actuel (samples)

**Audité 2026-05-01** via `scripts/db/check-counts.ts` (read-only, committed pour suivi récurrent).

#### Snapshot baseline (2026-05-01) — pre-Sprint S0

| Métrique | Valeur | % |
|---|---|---|
| Total CrmContacts | **9** | seeds test |
| Total IntentSignals | **0** | clean migration possible |
| CrmContacts sans `vertical` | 5 / 9 | 55.6% |
| CrmContacts en stage `new_lead` (default, jamais avancé) | 9 / 9 | 100% |
| CrmContacts avec `lifecycleStage` vide | 0 / 9 | 0% |
| CrmContacts sans `icpScore` (= 0 ou null) | 9 / 9 | 100% — dead field |
| CrmContacts avec `icpScore` > 0 | 0 / 9 | 0% |
| CrmContacts avec `relationshipScore` > 0 | 0 / 9 | 0% — dead field |

**Breakdown lifecycleStage** :
- `new_lead` : 9 (100%)

**Breakdown IntentSignal sources** : N/A (table vide).

#### Implications

- **DB en état pre-launch** : 9 contacts test, 0 production data
- **Foundations ICP/Intent existent au schema mais sont dead code** (jamais alimentés)
- **Migration data triviale** : pour chaque migration, max 9 rows à backfill
- **Lemlist webhook + Clay webhook** ont écrit 0 fois en prod (cohérent avec 0 IntentSignal)
- **Aucun risque de retraitement** sur les data existantes

#### Re-runs récurrents

Le script `scripts/db/check-counts.ts` doit être run :
- **Avant chaque sprint PRD-001** : vérifier que la baseline n'a pas dérivé
- **Après chaque sprint PRD-001** : confirmer que la migration s'est passée comme prévu
- **Avant le go-live marketing** : confirmation finale de l'état DB

Snapshots futurs à archiver dans le footer du script (template prêt).

### 12.3 Glossaire des termes nouveaux

- **ICP Score** : 0-50 statique, 5 dimensions (industry, size, decision_maker, geography, pattern_match)
- **Intent Score** : 0-50 dynamique, decay 3 paliers (100%/75%/50%), expire à 90 jours
- **Priority Score** : ICP + Intent (0-100)
- **Priority Level** : P1 (75+ score, 3+ signals, 2h SLA) / P2 (55-74, 2+ signals, 24h) / P3 (40-54, 2+ signals, standard) / Monitoring (<40 OR <2 signals)
- **Pain Tier** : T1 (Maximum Pain) / T2 (Constant Friction) / T3 (Suboptimal Solution) — intensité, intra-groupe
- **Group** : G1 (Structural Architects) / G2 (Legal Deal-Flow) / G3 (Investment Gatekeepers) / G4 (Wealth Intermediaries) / G5 (Compliance & Accounting) / G6 (High-Ticket Settlement) / G7A (Luxury Concierges) / G7B (Immigration Law)
- **Persona** : Decision Maker (DM) / Operational (OP)
- **Sequence Naming** : `{Group}-{PainTier}-{Persona}` (ex: G1-T1-DM, G7A-T2-OP)
- **Hard entry rule** : Priority Score 40+ AND 2+ distinct intent signal types — pas d'exception
- **Grace period** : 48h delay before priority level downgrade if account is in active Lemlist sequence

### 12.4 Décisions tranchées par Vernon (à compléter post-review)

- [ ] D1 : Mapping vertical → group : Option ___ (A/B/C)
- [ ] D2 : Architecture Signal vs IntentSignal : ___ (EXTEND / NEW / OTHER)
- [ ] D3 : Pain Tier default value : ___ (T1/T2/T3)
- [ ] D4 : Score override expiration : ___ jours / never
- [ ] D5 : Market campaigns auto-create Lemlist : ___ (oui/non)
- [ ] D6 : Auto-assignment : ___ (geo-based existing / random 50/50 PRD / hybrid)
- [ ] D7 : Lemlist API pause/advance support : ___ (oui/non/partiel — vérifier docs Lemlist)

---

*Fin du document — PRD-001 v2 mapping vers Oxen OS CRM (2026-05-01)*
