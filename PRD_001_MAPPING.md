# PRD-001 v3.6 — Intent Scoring Engine
# Document de mapping vers le CRM Oxen OS existant

> Document v3.6 — généré le 2026-05-01, révisé 2026-05-06 (Sprint S0 livré + Phase 2 G1-T1 SEEDED + Sprint S0.5 UI Polish IMPLEMENTED).
> Référence PRD : Andy / Oxen Finance — `CRM_scoring_brief.docx` — April 29, 2026
> Statut : Sprint S0 livré + 4 hotfixes (v1-v4) + Phase 2 G1-T1 seed (1 586 Companies + 597 Contacts en DB) + Sprint S0.5 UI Polish (4 batches, 168 tests passants).
>
> **Changelog** :
> - **v1 → v2** : ajout du contexte DB pre-launch (vérifié via `scripts/db/check-counts.ts`), mise à jour des risques migration (drastiquement réduits), estimation effort revue à la baisse.
> - **v2 → v3** : intégration des décisions Andy reçues 2026-05-05 (mapping vertical→group finalisé, FinTech/Crypto IN scope intermediaries only, iGaming + Import/Export OUT, auto-assignment Random 50/50, Pain Tier T2 default, Market Signal workflow, 5/7 Open Questions résolues).
> - **v3 → v3.1** : closure des 3 sub-questions Andy (crypto = intermédiaires UNIQUEMENT confirmé, override 30j validated, Market Signal UX = Oxen OS validated). 6 décisions structurelles confirmées.
> - **v3.1 → v3.2** : Lemlist API verification complétée par Vernon 2026-05-05. Pause/Resume/Status disponibles ; advance/skip step non exposé → workaround pause + update `{{signal_context}}` variable + resume. Aucune réduction scope PRD section 6.7 nécessaire. Open Q #1 RESOLVED. **6/7 questions résolues, 1 pending (Clay mapping rules en S0)**.
> - **v3.2 → v3.3** : **Sprint S0 IMPLEMENTED 2026-05-05**. 5 batches livrés (5 commits, 9 fichiers ajoutés/modifiés, 126 tests passants, 187/187 pages build OK). Pipeline Clay enrichment opérationnel — 2 modes (CSV import + HTTP API push) convergents sur les mêmes upsert helpers (single source of truth dans `src/lib/clay-enrichment.ts`). Phase 2 prête : seed des 2 692 rows existantes (1 711 companies + 981 people). Open Q #6 (Clay mapping rules) reste à formaliser début S1 — la base technique est en place.
> - **v3.3 → v3.4** : Post-deploy clarifications (2026-05-05 soir). (1) Hotfix `477cb93` : extraction des helpers client-safe vers `@/lib/clay-helpers.ts` après crash `PrismaClient is unable to run in browser` sur `/crm/contacts` — `ClayImportWizard` importait transitivement `prisma` via `@/lib/clay-enrichment`. (2) BD emails clarification : `CRM_BD_EMAILS` Railway env var corrigée avec les emails réels DB (`ad@oxen.finance`, `pg@oxen.finance`) — ancien template `.env.example` (`andy@`, `paullouis@`) ne matchait pas. (3) Glossaire ajouté : "Paul Louis" = nom interne pour **Paul Garreau** (Deputy CEO, `pg@oxen.finance`), 2ème BD aux côtés d'Andy. (4) Décision explicite : `dealOwnerId` = ownership CRM Oxen interne uniquement, **distinct des sender identities Lemlist** (Lemlist gère ses outreach aliases séparément, hors scope de ce PRD).
> - **v3.4 → v3.5** : **Phase 2 G1-T1 SEEDED 2026-05-06**. Import des 2 tables Clay G1-T1 effectué via wizard CSV (Mode A). Résultats : **1 586 Companies** (1 711 CSV − 2 errored description >2000 − 123 dedupe by domain) + **597 CrmContacts** (981 CSV − 384 dedupe by email Apollo cascade). 100% field coverage sur tous les champs critiques. Persona 99.3% DM (table Clay pré-filtrée upstream). Country distribution G1 : 73.7% UAE / 11.6% Cyprus / 8.7% Malta / 6.0% adjacents (UK/US/EU/SG/CA). dealOwner répartition 52.4% Andy / 47.6% Paul Garreau (random uniforme sain). **Phase 2 a révélé 4 hotfixes** (`477cb93` v1 client/server, `2cc7444` v2 per-row validation + `description.max(10000)`, `69c17fe` v3 Apollo aliases + `extractCountryFromLocation`, `cab3545` v4 country inheritance from Company) — tous fixés et déployés. Chaîne de protection country à 3 niveaux (explicit → location parsing → Company inheritance) garantit **0 contact avec country=NULL** sur 597. Scripts de vérification committed : `check-companies-phase2.ts` (`54f0217`) + `check-contacts-phase2.ts` (`8f1afdd`).
> - **v3.5 → v3.6** : **Sprint S0.5 UI Polish IMPLEMENTED 2026-05-06**. 4 batches (Mode B strict — commits locaux puis push global) pour rendre les fields PRD-001 (Group/PainTier/Persona) visibles dans toute l'UI : 3 nouvelles colonnes badges sur Contacts list (B1 `759d50b`), 3 dropdowns filters URL-bookmarkable + extension `listContactsQuery` Zod (B2 `858978d`), section "Clay Enrichment" sur fiche contact + extraction color maps vers `@/lib/crm-badge-colors.ts` (B3 `71ff38e`), badges Group/PainTier sur cards Companies + 3 dropdowns filters + section Clay Enrichment sur tab Overview détail company + fix bug placeholder vide tab Companies subNav `/crm` (B4 `06b1644`, option γ minimal viable). 13 fichiers touchés, ~940 insertions. Tests 158 → **168** (+10 nouveaux integration tests sur les 2 routes API étendues). Voir section **11.3** ci-dessous pour le détail complet.

---

## 1. Synthèse exécutive

**Important contexte DB (vérifié 2026-05-01)** : la base est en état pre-launch — 9 CrmContacts seed test, 0 IntentSignal, 0 ICP scores alimentés, 0 relationshipScore. Le scoring engine entrera donc dans une DB vierge en pratique. Migration risk minimal, mais timing critique : implémenter AVANT que Andy démarre le marketing en production pour éviter retraitement des signaux générés.

Le PRD décrit un **Intent Scoring Engine** ambitieux (3 nouveaux models, 22 champs, 9 endpoints, 4 background jobs, 9 React components). Le code actuel a posé **les fondations partielles** : `IntentSignal` existe avec source/signalType/score/expiresAt/raw, `relationshipScore` 0-100 sur `CrmContact`, et 4 champs pré-existants pour ICP (`icpFit`, `icpScore`, `icpScoreBreakdown`, `icpScoredAt`). Mais la couche manquante est **majoritaire** : pas de Pain Tier, pas de Group (G1-G7B), pas de Persona DM/OP, pas de Priority Level, pas de decay 3-paliers, pas de sequence routing par tier × persona, pas de `MarketSignal` model, pas d'endpoint unifié `/api/signals`.

Le **désalignement structurel le plus lourd** : (1) le PRD propose `Account` + `Contact` (1-to-N) mais le CRM a `CrmContact` (qui mélange les deux concepts) + `Company` séparée — décision schéma à trancher. (2) `vertical` actuel (7 valeurs string[]) ne mappe pas 1-to-1 avec les 8 `group` du PRD (G1-G7B). (3) `dealOwner` est string hardcodée, pas FK Employee, ce qui bloque l'`assigned_bd` UUID FK du PRD. (4) **Lemlist library actuelle ne supporte que enroll + remove — pas de pause, pas d'advance, pas de step manipulation** : Open Question #1 du PRD est répondue NÉGATIVEMENT par le code (à vérifier côté API Lemlist mais aucune trace dans le code).

**Verdict effort** : **8 semaines** pour Vernon + Johnny (1 dev externe) + Claude Code, en assumant les 6 décisions structurelles confirmées en S0. Estimation revue à la baisse (vs 9-10 v1) compte tenu du risque migration minimal confirmé.

**Risque principal** : la cohabitation `IntentSignal` (existant) vs `Signal` (PRD) — à trancher avant tout dev. **Migration data en pratique inexistante** (0 IntentSignal en prod).

**Décisions Andy reçues 2026-05-05** : Andy a confirmé **6 décisions structurelles** le 2026-05-05 : (1) iGaming et Import/Export **OUT of scope** outbound (B2C, pas intermédiaires), (2) **FinTech/Crypto IN scope = intermédiaires UNIQUEMENT** (CSP crypto → G1/T1, compta crypto → G5/T1, avocats crypto) — **PAS** exchanges, wallets, ou protocols, (3) auto-assignment Random 50/50 Andy/Paul Louis, (4) Pain Tier T2 par défaut, (5) Score override 30j auto-expire (validated), (6) Market Signals auto-create Lemlist draft + validation depuis Oxen OS (validated). Lemlist API verified par Vernon 2026-05-05 : pause/resume/status ✅, advance/skip step ❌ non exposé mais workaround simple via pause + update variables + resume. Reste pending : **Clay mapping rules** à formaliser en début de Sprint S0 (~30 min Vernon + Andy).

**Sprint S0 IMPLEMENTED — 2026-05-05** : Pipeline Clay enrichment fully operational. **5 batches livrés** :
- **Batch 1** (commit `2f6195c`) — Migration Prisma : 4 enums (`CrmGroup`, `CrmPainTier`, `CrmPersona`, `EnrichmentSource`) + extensions Company/CrmContact + rename `hqCountry → country`.
- **Batch 2** (commit `2c9984b`) — Helpers `src/lib/clay-enrichment.ts` (`classifyPersona`, `extractClayTableSegment`, `assignRandomBD`) + cleanup script D2.
- **Batch 3** (commit `b801a71`) — Endpoint `POST /api/webhooks/clay-enrichment` (auth `x-webhook-secret`, validation Zod, idempotency Company.domain + CrmContact.email).
- **Batch 4** (commit `35270b0`) — Refactor upsert logic into reusable helpers (`upsertCompanyFromClay`, `upsertPersonFromClay`) + new authenticated batch endpoint `/api/crm/contacts/import-clay` + UI component `ClayImportWizard.tsx` + `parseClayTableName()` parser. **Single source of truth** : Mode A (CSV import) et Mode B (HTTP API push) convergent sur les mêmes helpers.
- **Batch 5** (this commit) — Documentation (`docs/clay-setup-guide.md` pour Duy, `docs/clay-csv-import-guide.md` pour Andy) + PRD v3.3 + E2E manual test.

**Métriques** : 9 fichiers nouveaux/modifiés, 126 tests passants (113 baseline + 13 nouveaux), build 187/187 pages OK, lint 0 nouveau warning. Phase 2 prête : seed des 2 692 rows existantes (1 711 companies G1-T1 + 981 people G1-T1) après exécution de `scripts/db/cleanup-seed-contacts.ts` pour drop des 9 seeds test.

**Bloquants techniques (à résoudre AVANT dev)** :
- ~~B1 : Open Q #1 Lemlist API pause/advance — code actuel ne l'implémente pas~~ → **RESOLVED 2026-05-05** (cf. section 7.1 — pause/resume API ✅, advance via workaround Option A)
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

**Décision Andy 2026-05-05** : auto-assignment = **Random 50/50 entre Andy Dessy (`ad@oxen.finance`) et Paul Garreau (`pg@oxen.finance`, alias interne "Paul Louis")**. Override le code actuel `getOwnerForGeo`. Vernon (UAE) exclu de l'auto-assignment (cohérent avec ASSUMPTION PRD section 6.10).

> **Important** — `dealOwner` (et le futur `dealOwnerId`) = **ownership CRM Oxen interne uniquement** : qui suit le contact dans le pipeline, qui reçoit les alertes Telegram P1, qui est responsable du compte. **C'est distinct des sender identities Lemlist** : Lemlist peut envoyer des emails depuis des aliases outreach (par ex. `andy@oxengroup.com`, `paullouis@joinoxen.com` cf. domains existants dans `OutreachDomain`) pour préserver la deliverability et les vrais inboxes des BDs. Les 2 systèmes sont **séparés et indépendants** — `dealOwner` ne dicte pas l'expéditeur Lemlist.

**Implications techniques** :
- Le helper `src/lib/crm-config.ts:getOwnerForGeo()` ne sera plus utilisé pour le scoring engine
- Nouvelle fonction `assignRandomBD()` (livrée Sprint S0 batch 2 — `src/lib/clay-enrichment.ts`) qui retourne aléatoirement l'`Employee.id` correspondant à Andy ou Paul Garreau via lookup sur `CRM_BD_EMAILS` env var (50/50)
- Le geo-based assignment existant reste actif pour les **leads inbound non-scoring** (`/api/crm/webhooks/inbound-lead`) — coexistence
- Sprint S0 ou S1 : décider si on renomme `dealOwner` ou si `assigned_bd` est un nouveau champ

**Configuration env var (Railway)** : `CRM_BD_EMAILS="ad@oxen.finance,pg@oxen.finance"`. Set 2026-05-05 post-deploy après que la query DB sur `Employee` ait révélé que les emails template initiaux (`andy@`, `paullouis@`) ne correspondaient pas aux records réels.

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

### 7.1 Lemlist API — Open Question #1 du PRD (RESOLVED 2026-05-05)

**Question PRD** : Lemlist API supporte-t-il pause + step advancement programmatiques ?

**Statut** : ✅ **RESOLVED** — vérification Vernon 2026-05-05.

#### Capabilities Lemlist API — vérifiées

| Capability | Endpoint Lemlist | Statut |
|---|---|---|
| ✅ **Pause lead** | `POST /api/leads/pause/{leadId}` | Disponible |
| ✅ **Resume lead** | `POST /api/leads/start/{leadId}` | Disponible |
| ✅ **Get lead status** | `GET /api/leads/{email}?version=v2` | Disponible (state, currentStep, paused, etc.) |
| ❌ **Advance / skip step** (direct) | — | **NON exposé** par l'API |

**Refs officielles** :
- https://developer.lemlist.com/api-reference/endpoints/leads/pause-lead
- https://developer.lemlist.com/api-reference/endpoints/leads/resume-paused-lead
- https://developer.lemlist.com/api-reference/endpoints/leads/get-lead-by-email

#### Workaround pour "advance step" (non exposé)

Pas d'endpoint direct pour avancer le step d'un lead. **Workaround Option A retenu** :

1. **Pause** le lead (POST pause)
2. **Update lead variables** custom (ex: `{{signal_context}}`) via API ou via re-enroll avec nouveaux variables
3. **Resume** le lead (POST start)

Le step suivant utilise alors les nouvelles variables → contextualisation auto du prochain message.

**Convention pour Andy** : ajouter la variable `{{signal_context}}` dans les templates Lemlist côté UI → permet l'auto-injection du contexte signal au prochain touch.

#### Code Oxen OS actuel (`src/lib/lemlist.ts`, 177 lignes)

| Fonction existante | Endpoint Lemlist appelé | Action |
|---|---|---|
| `getLemlistCampaigns()` | `GET /api/campaigns` | Liste toutes les campagnes (cache 1h) |
| `enrollLead()` | `POST /api/campaigns/{id}/leads/{email}` | Enrolle un lead dans une campagne |
| `removeLead()` | `DELETE /api/campaigns/{id}/leads/{email}` | Retire un lead d'une campagne spécifique |
| `removeLeadFromAll()` | `DELETE /api/leads/{email}` | Retire de toutes campagnes (unsubscribe) |

**Helpers à ajouter en Sprint S5** :
- `pauseLemlistLead(leadId)` → `POST /api/leads/pause/{leadId}`
- `resumeLemlistLead(leadId)` → `POST /api/leads/start/{leadId}`
- `getLemlistLeadStatus(email)` → `GET /api/leads/{email}?version=v2`
- (Optionnel) `updateLemlistLeadVariables(leadId, vars)` — si exposé par API, à vérifier au moment du dev. Sinon : re-enroll cycle.

#### Impact sur le PRD section 6.7

**Section 6.7 Immediate Action (8 triggers, 2h SLA) — pauses sequence** :
- ✅ **Fully implementable** via `POST /api/leads/pause/{leadId}` après détection signal
- Les 8 triggers (BD profile visit, pricing visit, email opens 3+, link click, comment Oxen, banking frustration post, call connected, etc.) déclenchent tous : Telegram alert → pause auto → BD a 2h pour agir → resume manuel après action
- Pas besoin de fallback "alertes manuelles uniquement"

**Section 6.7 Rapid Action (4 triggers, 24h SLA) — advances next touch** :
- Pas d'advance/skip direct → **Workaround Option A retenu** : pause + update variables + resume
- Les 4 triggers (competitor post like/comment, job change CFO/COO, funding round, geographic expansion) → contextualise le prochain touch via `{{signal_context}}` injecté
- Andy doit s'assurer que les templates Lemlist utilisent `{{signal_context}}` pour bénéficier de l'auto-contextualisation

**Conclusion** : aucune réduction de scope nécessaire dans le PRD. Toutes les triggers section 6.7 sont implémentables.

### 7.2 Clay — Pattern Match + architecture finale post-Sprint S0

**Statement PRD** : "Pattern Match compares against converted clients and pipeline prospects. Clay used for enrichment only, not Pattern Match."

#### Architecture Clay enrichment (Sprint S0 IMPLEMENTED)

**2 endpoints, 1 logique** :

```
[Mode A — CSV Import]                        [Mode B — HTTP API push]
ClayImportWizard.tsx                         Clay HTTP API column
        │                                            │
        ▼                                            ▼
POST /api/crm/contacts/import-clay        POST /api/webhooks/clay-enrichment
(auth: requirePageAccess "crm")           (auth: x-webhook-secret)
        │                                            │
        ├──────────────┬─────────────────────────────┘
                       ▼
        @/lib/clay-enrichment.ts
        upsertCompanyFromClay()  /  upsertPersonFromClay()
                       │
                       ▼
                 [Prisma DB]
```

**Idempotency** : Company match by `domain` (lowercased), Contact match by `email` (lowercased). Re-imports = updates, pas de duplications.

**Persona auto-classification** : `classifyPersona(jobTitle)` → DM si keywords (ceo, founder, owner, managing director, chief, president, partner, director) ; sinon OP.

**BD assignment** : nouveaux contacts → `assignRandomBD()` 50/50 Andy/Paul Louis ; contacts existants : `dealOwner` PRESERVÉ.

**Mapping intentionnel** : Clay payload `primaryIndustry` → Oxen schema `industry` (decision C1 — kept for compat with 11 AI consumer files).

#### Pattern Match (PRD section 6.2 — 5 points sur ICP)

Pattern Match logic **n'existe pas encore dans le code**. À développer Sprint S2 (ICP Scoring).

**Logique à implémenter** (Sprint S2) :
- Pour un Account/CrmContact donné : query DB
  - Reference pool A : `Deal` where `stage = "closed_won"` (converted clients)
  - Reference pool B : `Deal` where `stage NOT IN ("closed_won", "closed_lost")` (pipeline prospects)
- Comparer dimensions : `vertical`/`subVertical`, `companySize`, `geoZone`/`country`, `industry`, `fundingStage`/`annualRevenueRange`
- Strong match (3+ dimensions) → 5 pts ; Partial (2 dimensions) → 3 pts ; Pipeline-only match → 3 pts ; No match → 0

#### Webhook Clay legacy (intent signals — distinct du nouveau pipeline)

Le webhook `/api/webhooks/clay/route.ts` (existant pré-Sprint S0) reste actif et gère uniquement les **intent signals** (création `IntentSignal` avec `source="clay"`). Ce webhook est **distinct** de `/api/webhooks/clay-enrichment` (nouveau Sprint S0) qui gère l'**enrichissement structurel** (Company + CrmContact upsert avec group/painTier/persona). Les deux peuvent coexister — Clay envoie selon le type d'événement.

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

État au 2026-05-05 : **6/7 résolues**, **1 pending** (Q6 Clay rules).

| # | Question PRD | Statut | Réponse |
|---|---|---|---|
| 1 | Lemlist API supports pause + step advancement ? | **RESOLVED (Vernon 2026-05-05)** | Pause/Resume/Status : ✅ disponibles (`POST /api/leads/pause/{leadId}`, `POST /api/leads/start/{leadId}`, `GET /api/leads/{email}?version=v2`). Advance/skip step direct : ❌ non exposé — workaround Option A : pause + update variables (`{{signal_context}}`) + resume. Aucune réduction de scope PRD section 6.7 nécessaire. Cf. section 7.1. |
| 2 | Existing CRM accounts tagged with industry, size, jurisdiction ? | **RESOLVED** | DB check 2026-05-01 (`scripts/db/check-counts.ts`) : 9 contacts test seed, 5/9 sans vertical (55.6%), 0 IntentSignal. Pre-launch state — pas un blocker. |
| 3 | Signal API: auth per source ? | **RESOLVED** | OUI ; chaque webhook a son env var dédié (`CLAY_WEBHOOK_SECRET`, `TRIGIFY_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`, `WEBSITE_WEBHOOK_SECRET`, `LEMLIST_WEBHOOK_SECRET` HMAC). Sprint 0 hardening déjà en place. Pour `/api/signals` unifié : maintenir le pattern par source via `requireWebhookSecret()`. |
| 4 | Should score_override expire ? | **RESOLVED (Andy 2026-05-05)** | OUI — 30 jours auto-expire + ping Telegram BD 3 jours avant expiration. Champ `score_override_expires_at` TIMESTAMP NOT NULL. Daily Decay Job gère expiration + notifications. Audit log obligatoire. Cf. section 5b.2. |
| 5 | Market campaigns auto-create Lemlist ? | **RESOLVED (Andy 2026-05-05)** | OUI — auto-create draft + **validation BD depuis Oxen OS** (avec preview structuré, pas Lemlist UI). Implication code : nouvelle fonction `createCampaign(name, draft=true)` dans `src/lib/lemlist.ts` (vérifier API Lemlist supporte création programmatique). Cf. section 5b.3. |
| 6 | Clay mapping rules pour group + pain tier ? | **PENDING — to define in Sprint S0** | Mapping de base défini (cf. section 3.2) via sub-verticals → group + Pain Tier T1/T2 par sub-vertical. Règles fines (heuristiques companySize / country / fundingStage → group/tier) à formaliser admin-configurable en Sprint S0 (Vernon + Andy, ~30 min). |
| 7 | Auto-assignment BD : geo-based (existing) vs random 50/50 (PRD) ? | **RESOLVED (Andy 2026-05-05)** | Random 50/50 Andy/Paul Louis pour scoring engine. Geo-based (`getOwnerForGeo`) reste pour autres flux (inbound forms). Vernon (UAE) exclu. Cf. section 5b.1. |

---

## 9. Risques et bloquants

### 9.1 Bloquants techniques (à résoudre AVANT dev)

| # | Bloquant | Impact | Action |
|---|---|---|---|
| ~~**B1**~~ | ~~Open Q #1 Lemlist API pause/advance~~ | **RESOLVED 2026-05-05** | Pause/resume disponibles. Advance via workaround pause + `{{signal_context}}` + resume. Cf. section 7.1. Helpers à ajouter en Sprint S5. |
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

### 11.1 Sprint S0 — IMPLEMENTED 2026-05-05 + Phase 2 G1-T1 SEEDED 2026-05-06

**6 décisions structurelles tranchées par Andy + 5 batches Sprint S0 implémentés + 4 hotfixes (v1-v4) + Phase 2 G1-T1 seed terminé** :

#### Décisions (Andy 2026-05-05)
- ✅ Mapping `vertical` → `group` : Option B Coexister + table finale (Family Office=G4, CSP=G1, Luxury/Yacht=G6, FinTech-CSP=G1/T1, FinTech-compta=G5/T1, iGaming + Import/Export OUT)
- ✅ FinTech/Crypto scope précisé : intermédiaires UNIQUEMENT (CSPs, accountants, lawyers) — **PAS** exchanges/wallets/protocols
- ✅ Architecture `Signal` : EXTEND IntentSignal (Vernon proposed v1, retained)
- ✅ Pain Tier default value : T2 (T1 pour FinTech/Crypto sub-verticals)
- ✅ Auto-assignment : Random 50/50 Andy/Paul Louis pour scoring engine, geo-based reste pour inbound flows
- ✅ Score override expiration : 30 jours auto-expire + Telegram 3 jours avant (Andy validated)
- ✅ Market campaigns auto-create Lemlist : auto-draft + validation BD depuis **Oxen OS** (Andy validated)

#### Pré-requis Sprint S0 (vérifications)
- ✅ Lemlist API verification (Vernon, 2026-05-05) : pause/resume/status disponibles, advance/skip via workaround pause + update variables `{{signal_context}}` + resume. Helpers à ajouter en Sprint S5 : `pauseLemlistLead`, `resumeLemlistLead`, `getLemlistLeadStatus`. Convention Andy : utiliser `{{signal_context}}` dans templates Lemlist. Cf. section 7.1.

#### Items Sprint S0 livrés (5 batches, 5 commits)

**Asymétrie volontaire documentée** : Clay payload utilise `primaryIndustry` mais le schema Oxen utilise `industry`. Mapping intentionnel dans le handler webhook (decision C1 — Sprint S0 batch 1). 11 AI consumer files n'ont PAS été migrés vers `primaryIndustry` pour éviter risque régression silencieuse des prompts Claude.

| # | Item | Commit | Statut |
|---|---|---|---|
| 1 | Migration Prisma : 4 enums + Company/CrmContact extensions + rename hqCountry→country | `2f6195c` | ✅ DONE |
| 2 | Helpers `classifyPersona`, `extractClayTableSegment`, `assignRandomBD` (`src/lib/clay-enrichment.ts`) | `2c9984b` | ✅ DONE |
| 3 | Cleanup script (D2) `scripts/db/cleanup-seed-contacts.ts` (créé, à exécuter Phase 2) | `2c9984b` | ✅ DONE (script ready, NOT yet run) |
| 4 | Endpoint `POST /api/webhooks/clay-enrichment` (Zod + idempotency Company.domain + CrmContact.email) | `b801a71` | ✅ DONE |
| 5 | Refactor upsert helpers (`upsertCompanyFromClay`, `upsertPersonFromClay`) — single source of truth | `35270b0` | ✅ DONE |
| 6 | Endpoint `POST /api/crm/contacts/import-clay` (batch CSV import, chunks de 100, allSettled) | `35270b0` | ✅ DONE |
| 7 | UI component `ClayImportWizard.tsx` (5-step modal upload→source→mapping→preview→result) | `35270b0` | ✅ DONE |
| 8 | Source-table parser `parseClayTableName()` (vDC_{group}_Tier {n}_{scope}_{filter}) | `35270b0` | ✅ DONE |
| 9 | Documentation `docs/clay-setup-guide.md` (Duy, Mode B HTTP) + `docs/clay-csv-import-guide.md` (Andy, Mode A CSV) | `600b313` | ✅ DONE |

#### Hotfixes post-deploy (révélés par Phase 2)

| # | Issue | Commit | Statut |
|---|---|---|---|
| H1 | `PrismaClient is unable to run in browser` sur `/crm/contacts` — `ClayImportWizard` importait transitivement `prisma`. Fix : extract pures helpers vers `@/lib/clay-helpers.ts`. | `477cb93` | ✅ DONE |
| H2 | Import 1 711 rows échoue avec 400 Invalid input car 2 rows ont description >2000 chars. Batch Zod rejette tout. Fix : `description.max(2000)` → `max(10000)` + per-row validation dans `Promise.allSettled` (1 bad row n'arrête plus le batch) + retry x1 sur exceptions. | `2cc7444` | ✅ DONE |
| H3 | Apollo CSV columns non auto-mappées : `Work Email`, `Email Address`, etc. + Apollo Location `"City, Country"` non parsé. Fix : 5 alias Apollo dans `PEOPLE_AUTO_MAP` + nouveau helper `extractCountryFromLocation()` (whitelist 21 entrées, normalisation UAE/UK/USA → canonical). | `69c17fe` | ✅ DONE |
| H4 | 2 contacts sur 5 (mini-test) ont country=NULL car `Location` en arabe (`دبي الإمارات العربية المتحدة`) non parseable. Fix : 3-step country resolution chain — explicit → `extractCountryFromLocation` → **inherit from `Company.country`** (universel multilingue). Backfill SQL appliqué sur les 2 rows. | `cab3545` | ✅ DONE |

#### 1 item en attente (formalisation, non bloquant Phase 3)

1. **Clay mapping rules** sub-vertical → Group + Pain Tier (Vernon + Andy, ~30 min) — Open Q #6. Mapping de base existe (cf. section 3.2), règles fines (heuristiques companySize / country / fundingStage) à formaliser début Sprint S1. **N'a pas empêché le seed Phase 2** : les rows Clay arrivent déjà tagged G1-T1 par construction (encodé dans le source_table).

### 11.2 Phase 2 G1-T1 — SEEDED 2026-05-06

**Phase 2 lancement complet** : seed des 2 tables Clay G1-T1 (Company + People) effectué via Mode A (CSV wizard).

#### Métriques DB post-seed (verifié `check-companies-phase2.ts` + `check-contacts-phase2.ts`)

##### Companies (G1-T1)

| Métrique | Valeur |
|---|---|
| Total Company en DB | **1 586** |
| Source CSV input | 1 711 rows |
| Errored (description >2000 chars, fixé en hotfix v2 mais déjà skippées) | 2 |
| Dedupe by `domain` (idempotence) | 123 |
| Field coverage : `name`, `domain`, `country`, `industry`, `linkedinUrl`, `clayTableSegment`, `enrichedAt` | **100%** |
| Field coverage : `companySize` | 99.8% (3 nulls Apollo) |
| Country distribution | 82.7% UAE / 11.8% Cyprus / 5.5% Malta |
| Industry distribution | 52% Business Consulting / 38% Financial Services / 9% Legal / 1% Professional |
| Company size distribution | 86.6% sont 2-50 employees (profil PME/CSP cible) |

##### CrmContacts (G1-T1)

| Métrique | Valeur |
|---|---|
| Total CrmContact en DB | **597** |
| Source CSV input | 981 rows |
| Dedupe by `email` (idempotence + Apollo cascade dedup) | 384 |
| Field coverage : `email`, `jobTitle`, `persona`, `country`, `companyId`, `dealOwner` | **100%** |
| Field coverage : `firstName` | 99.7% (2 nulls — données Apollo) |
| **Country = NULL count** | **0 / 597** ✅ (chaîne d'inheritance fonctionne) |
| Persona distribution | 99.3% DM / 0.7% OP (table Clay pré-filtrée DM upstream) |
| Country distribution | 73.7% UAE / 11.6% Cyprus / 8.7% Malta / 6.0% adjacents (UK/US/EU/SG/CA) |
| dealOwner distribution | 52.4% Andy Dessy / 47.6% Paul Garreau (random uniforme sain) |

#### Implications pour Phase 3 (scoring engine)

- **Foundations DB solides** : 1 586 Companies + 597 Contacts taggés G1-T1 avec 100% field coverage prêts à recevoir le scoring (icpScore, intentScore, priorityScore, priorityLevel).
- **Chaîne de protection country bulletproof** : aucun contact orphelin geo, le scoring `geography` factor (max 10 pts) peut s'appliquer sur 100% du dataset.
- **Persona ready** : 593 DM identifiés → outreach Lemlist `G1-T1-DM` peut démarrer dès que les sequences sont créées (Open Q Andy).
- **dealOwner ready** : Telegram routing P1 (2h SLA) peut router vers Andy ou Paul Garreau immédiatement.
- **6.0% Person.country ≠ Company.country** (cadres expat) — choix scoring à faire : downgrade léger ou égalité (cf. section 11.3).

#### Pour les futures tables G+T (G1-T2, G2-T1, etc.)

- **Mode A (CSV wizard)** : inchangé, ajouter le `source_table` au preset dropdown si récurrent (cf. `PRESET_TABLES` dans `ClayImportWizard.tsx`).
- **Mode B (HTTP API push)** : prêt côté Oxen, dépend de la config Clay HTTP API column (Duy, cf. `docs/clay-setup-guide.md`).
- **Vérification post-seed** : adapter les 2 scripts `check-companies-phase2.ts` / `check-contacts-phase2.ts` (changer le filtre `WHERE "group" = 'G1' AND "painTier" = 'T1'`).

#### Sprints suivants (S1, S2, ...)

À discuter avec le PM lundi :
- Roadmap 9-10 semaines : valider la cadence et les arbitrages
- Frictions Andy observées en Semaine 1 d'onboarding → potentiellement modifier priorisation Sprint S5/S6
- Quand brancher le PM sur la review des PRs Johnny ?
- Métriques de succès post-launch : O1 (80% P1 → conversation 7j), O2 (P1 contact 2h), etc. — instrumentation via quels events ?
- Open Q #6 (Clay mapping rules fines) : 30 min Vernon + Andy en début Sprint S1.

### 11.3 Sprint S0.5 — UI Polish IMPLEMENTED 2026-05-06

Sprint d'amélioration UI pour rendre les nouveaux fields PRD-001 (`group`, `painTier`, `persona`) populés par Clay enrichment **visibles dans toute l'application** : Contacts list + detail, Companies cards + detail, et fix du bug placeholder vide sur le subNav `/crm` Companies.

**Mode B strict respecté** : 4 batches avec commits locaux séquentiels, validation visuelle de Vernon entre chaque batch via diff review, push global groupé en fin de sprint.

#### Métriques

| Métrique | Valeur |
|---|---|
| Batches commits locaux | 4 (`759d50b`, `858978d`, `71ff38e`, `06b1644`) |
| Files touchés (uniques) | 13 |
| Insertions | ~940 lignes |
| Tests | 158 → **168** (+10 integration tests) |
| Build | ✅ all batches green (`Compiled successfully` sur chaque) |
| Typecheck | ✅ clean sur chaque batch |
| Lint nouveau code | ✅ 0 nouveau warning/error (vérifié `git stash` baseline) |
| Régressions | 0 (5 tabs detail Company préservés, 0 fonctionnalité supprimée) |

#### Items implémentés par batch

##### Batch 1 — Quick wins UI (`759d50b`, 3 fichiers, +72 / -0)

- **Auto-mapping wizard** : ajout alias Apollo `"linkedin profile" → linkedinUrl` dans `PEOPLE_AUTO_MAP` (`ClayImportWizard.tsx`).
- **3 columns Contacts list** : `Group` (G1..G7B), `Pain Tier` (T1..T3), `Persona` (DM/OP) avec badges colorés readonly, position entre legacy "Outreach Group" et "Stage" (`InlineEditableTable.tsx`).
- **Color palette** : 8 hex distincts pour Groups (red→indigo), gradient d'intensité Pain Tier (red→amber→gray), DM rose-gold brand / OP gray. Inline dans `InlineEditableTable.tsx` à ce stade (extracted en B3).
- **Type plumbing** : `TableContact` + `CrmContact` page-level interfaces étendues avec les 3 nouveaux fields.

##### Batch 2 — Filters Contacts (`858978d`, 4 fichiers, +224 / -5)

- **3 filter dropdowns** : `All Groups`, `All Pain Tiers`, `All Personas` ajoutés en toolbar `/crm/contacts`, positionnés avant le legacy `outreachGroup` filter (renommé `"All Outreach Groups"` pour disambiguation).
- **URL query params** : `?group=G1&painTier=T1&persona=DM` bookmarkable / shareable via `useSearchParams` + `router.replace`. Anti-loop guard via early return sur `params.toString() === searchParams.toString()`.
- **API extension** : `listContactsQuery` Zod schema gains 3 enum-validated optional fields (`crmGroupEnum` / `crmPainTierEnum` / `crmPersonaEnum`). Invalid values → 400 Invalid query parameters. GET handler forward dans `where` Prisma.
- **Tests** : 8 nouveaux integration tests (`route.test.ts`) — forwarding individuel, combined, absent, invalid enum miss × 3, G7A/G7B sub-grouped, preservation legacy filters.

##### Batch 3 — Contact detail (`71ff38e`, 3 fichiers, +191 / -25)

- **Section "Clay Enrichment"** sur `/crm/contacts/[id]` colonne droite, AVANT le legacy `Enrichment` GlassCard. Read-only badges (Group / Pain Tier / Persona) + texte (Table Segment, Source, Enriched At formatté `fmtDateTime`).
- **Empty state** : si aucun des 6 champs Clay n'est set, affiche `"Not enriched via Clay"` italique dimmed (1 ligne, évite 6 rows de "—").
- **Refacto color maps** : extraits depuis `InlineEditableTable.tsx` vers nouveau module **`src/lib/crm-badge-colors.ts`** (single source of truth, client-safe). Exports : `GROUP_COLORS`, `PAIN_TIER_COLORS`, `PERSONA_COLORS`, `FALLBACK_BADGE_COLOR` + helpers `getGroupColor()` / `getPainTierColor()` / `getPersonaColor()` (signature `value | null | undefined → string | null`).
- **Field Location** read-only display ajouté à la section legacy `Enrichment` (read-only car `location` n'est PAS dans `updateContactSchema` — défensif anti-footgun).

##### Batch 4 — Companies grid + filters + detail (`06b1644`, 6 fichiers, +456 / -6)

**Décision : option γ "minimal viable"** retenue (vs α coexistence / β wipe / δ unification) après audit révélant que `/crm/companies/page.tsx` (cards grid) + `/crm/companies/[id]/page.tsx` (5 tabs detail) existent déjà — Vernon's mental model "coming soon" était stale, le vrai placeholder vide est sur le **subNav `/crm` tab Companies** (`src/app/crm/page.tsx` ligne 765).

- **Tab Companies subNav `/crm`** : placeholder `"Companies view coming soon."` remplacé par carte avec `<Link href="/crm/companies">` + bouton rose-gold "Open Companies →". Fixe le bug user-facing visible dans le screenshot Vernon, sans dupliquer la grid view.
- **Cards Companies augmentées** : 2 badges (Group + Pain Tier) ajoutés sur chaque card Clay-enriched, positionnés sous le nom + industry, avant la HQ location. Companies non-Clay : pas de badges (clean empty).
- **3 filter dropdowns** : `All Groups`, `All Pain Tiers`, `All Countries` (whitelist 17 entrées alignée avec `extractCountryFromLocation` canonical names) ajoutés en toolbar `/crm/companies`. URL sync identique à batch 2 (`?group=G1&painTier=T1&country=Cyprus`).
- **API extension** : `listCompaniesQuery` Zod schema gains `group` / `painTier` (enum-validated, reuse des enums batch 2) + `country` (free-string, max 100 chars). GET handler forward dans `where` Prisma. `country='all'` traité comme no-op (sentinel page).
- **Détail Company tab Overview** : nouvelle GlassCard "Clay Enrichment" en haut de la colonne droite (avant `Verticals & Sub-Verticals`). Champs : Group + Pain Tier (badges colorés) + Table Segment + Source + Enriched At. Empty state pour non-Clay. **Les 5 tabs (Overview / Contacts / Deals / Activity / Files) sont entièrement préservés** — 0 régression.
- **Tests** : 10 nouveaux integration tests sur `route.test.ts` — forwarding par filter individuel, combined avec country UAE (URL-encoded), absent, invalid enum × 2, G7A/G7B, preservation legacy, country='all' no-op.

#### Décisions structurelles

1. **Color maps centralisés** : `src/lib/crm-badge-colors.ts` module unique, consommé par 3 endroits (`InlineEditableTable.tsx`, `/crm/contacts/[id]/page.tsx`, `/crm/companies/page.tsx` + `/crm/companies/[id]/page.tsx`). Évite drift de palette entre composants.

2. **Pattern "Clay Enrichment" cohérent** entre Contact detail (B3) et Company detail (B4) — même titre de section, même empty state, mêmes badges, mêmes labels. UX prévisible quel que soit le contexte.

3. **Persona reste contact-only** — pas affiché ni filtré sur Companies (le champ est sur `CrmContact`, pas sur `Company`). Volontaire et documenté.

4. **Readonly badges** sur les nouveaux fields Clay : `type: "readonly"` côté inline table, display-only côté detail pages. Évite footgun UX où un edit inline serait silently stripped par Zod (champs non listés dans `updateContactSchema` / `updateCompanySchema`). Édition inline est un follow-up explicite si besoin.

5. **Option γ pour Companies** : pas de wipe du code existant (cards UI, 5 tabs detail), pas de duplication d'UI (pas de table view créée en parallèle). Sprint S0.5 = polish, pas refacto archi. Si unification voulue plus tard → Sprint dédié.

6. **URL query params seulement pour les nouveaux filters** : les filters legacy (vertical, geoZone, industry, contactType, etc.) restent ephemeral state — out of scope batch 2 et batch 4 pour éviter scope creep.

#### Test E2E manuel récap (post-deploy)

**`/crm/contacts`** :
- ✅ 3 colonnes Group / Pain Tier / Persona affichent badges colorés sur les contacts G1-T1 Clay-enriched
- ✅ Contacts non-Clay (legacy seeds) affichent `—` dimmed dans les 3 colonnes
- ✅ 3 dropdowns toolbar fonctionnent + URL bookmarkable (`?group=G1&painTier=T1&persona=DM`)
- ✅ Click contact → fiche détail affiche section "Clay Enrichment" en haut colonne droite

**`/crm` (subNav Companies)** :
- ✅ Card "Open Companies →" affichée (rose-gold gradient button) au lieu du placeholder
- ✅ Click navigue vers `/crm/companies` (pas de redirect implicite)

**`/crm/companies`** :
- ✅ Cards G1-T1 affichent badges Group + Pain Tier sous le nom + industry
- ✅ Cards non-Clay : pas de badges (clean)
- ✅ 3 dropdowns toolbar (Groups / PainTiers / Countries) fonctionnent + URL bookmarkable (`?group=G1&painTier=T1&country=Cyprus`)
- ✅ Click card → fiche détail

**`/crm/companies/[id]`** :
- ✅ Tab Overview affiche section "Clay Enrichment" en haut colonne droite (G1 + T1 badges, Table Segment, Source, Enriched At)
- ✅ Empty state `"Not enriched via Clay"` italique pour companies legacy
- ✅ 5 tabs (Overview / Contacts / Deals / Activity / Files) tous préservés et fonctionnels

#### Out of scope (deferred → Sprint S0.6 ou suivants)

1. **Sprint S0.6 — Lemlist hardening** (audit `bifjvm3lb` 2026-05-06) :
   - **Footgun #1** : `Push to Lemlist (all)` UI label "Push all 597" mais ne pousse que la page courante (50). Bug UX critique.
   - **Footgun #2** : `/api/lemlist/enroll` ne valide pas la cohérence cross-field `persona ↔ campaign name` (peut enroll un OP dans une campaign DM).
   - **Footgun #3** : pas de retry / chunking / rate limit côté `bulk push` (séquentiel pur).

2. **Unification subNav `/crm` ↔ pages standalone** (option δ batch 4) — Refacto archi, hors scope polish. Décision : déferrer à Sprint dédié si nécessaire.

3. **Édition inline des fields Clay** (`group` / `painTier` / `persona` / `country`) sur table + fiches détail — nécessite extension de `updateContactSchema` / `updateCompanySchema` Zod. Pas urgent : ces fields sont populés par Clay, manual override est rare.

4. **Sprint S1 — Open Q #6 Clay mapping rules** (Vernon + Andy, ~30 min en début S1) — Heuristiques fines `companySize` / `country` / `fundingStage` → group + Pain Tier mapping (existing base déjà fonctionnelle via `source_table` parsing).

### 11.4 À discuter avec Andy

- **Mapping vertical → group définitif** : vu les 3 verticals sans match (FinTech, iGaming, Import/Export), comment les classer ? Comme T1 high-intensity dans groupes existants ?
- **Pain Tier criteria explicites** : quels signaux objectifs déterminent T1 vs T2 vs T3 par groupe ?
- **Définitions DM vs OP par groupe** : G1 fiduciaries → DM = associé/managing partner, OP = compliance officer ? Lister par groupe.
- **Sequences Lemlist actuelles** : combien existent déjà avec naming `{Group}-{PainTier}-{Persona}` ? Si zéro, Andy doit en créer ~24 (8 groupes × 3 tiers × 2 personas) ou commencer prioritaires.

### 11.5 À discuter avec Johnny (dev externe)

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

### 12.3bis Team & terminology (clarification post-deploy 2026-05-05)

- **"Paul Louis" = Paul Garreau** (`pg@oxen.finance`, Deputy CEO Oxen). "Paul Louis" est un slang interne issu d'anciens jours, le nom formel est **Paul Garreau**. Les deux noms désignent la **même personne** — c'est le **2ème BD** aux côtés d'Andy pour l'auto-assignment scoring engine.
- **Andy = Andy Dessy** (`ad@oxen.finance`, Sales Manager) — 1er BD.
- **`dealOwner` (et le futur `dealOwnerId`) = ownership CRM Oxen interne** : qui suit le contact dans le pipeline, qui reçoit les Telegram P1, qui est responsable. Distinct de l'expéditeur des emails Lemlist — voir ci-dessous.
- **Lemlist sender identity = système séparé** : Lemlist peut utiliser des **outreach aliases** (par ex. emails sur les domains `oxengroup.com`, `joinoxen.com`, `oxenpartners.com` cf. seeds `OutreachDomain`) pour préserver la deliverability et les vrais inboxes des BDs. **Out of scope pour PRD-001** — géré côté Lemlist UI par l'équipe Outreach.
- **`CRM_BD_EMAILS` env var** : utilise les **emails Employee réels** (`ad@oxen.finance`, `pg@oxen.finance`), pas les aliases Lemlist. Resolved par `assignRandomBD()` via `prisma.employee.findMany({ where: { email: { in: emails } } })`.

### 12.4 Décisions tranchées par Vernon (à compléter post-review)

- [ ] D1 : Mapping vertical → group : Option ___ (A/B/C)
- [ ] D2 : Architecture Signal vs IntentSignal : ___ (EXTEND / NEW / OTHER)
- [ ] D3 : Pain Tier default value : ___ (T1/T2/T3)
- [ ] D4 : Score override expiration : ___ jours / never
- [ ] D5 : Market campaigns auto-create Lemlist : ___ (oui/non)
- [ ] D6 : Auto-assignment : ___ (geo-based existing / random 50/50 PRD / hybrid)
- [ ] D7 : Lemlist API pause/advance support : ___ (oui/non/partiel — vérifier docs Lemlist)

---

*Fin du document — PRD-001 v3.6 mapping vers Oxen OS CRM (2026-05-01, révisé 2026-05-06 post-Sprint S0.5 UI Polish)*
