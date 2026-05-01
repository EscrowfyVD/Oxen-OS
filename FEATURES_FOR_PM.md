# Oxen OS — Welcome to the team

> Document d'onboarding pour le nouveau Product Manager Oxen.
> Préparé par Vernon Dessy. Lu en 30-45 min. Utile pour 30 jours.
> Version 1.0 — 2026-05-01.

---

## Préambule

### Mission Oxen OS

Oxen OS est l'OS interne d'Oxen Finance / Escrowfy GmbH (VQF SRO-licensed Swiss fintech). Il remplace dans une seule application :

- **HubSpot** (CRM + sales pipeline)
- **Notion** (wiki + documentation interne)
- **Calendly** (calendar + scheduling)
- **Google Analytics** (marketing/SEO metrics)

Avec en plus : modules dédiés Compliance (VQF Switzerland), Conferences, AI insights cross-module (Sentinel), automations, et helpdesk multi-canal.

### Stack technique

- **Frontend** : Next.js 16 / TypeScript (strict) / React 19 / inline React.CSSProperties (no CSS modules, no Tailwind)
- **Backend** : Next.js API routes / Prisma 5.22 / PostgreSQL (Railway)
- **AI** : Anthropic Claude API (`@anthropic-ai/sdk`, model `claude-sonnet-4-20250514`)
- **Auth** : NextAuth v5 + Google OAuth (restricted aux domaines `@oxen.finance` / `@escrowfy.ch`)
- **Hébergement** : Railway (3 services : monolith Next.js + AI Worker + Sync Worker + Postgres)
- **Design system** : Glassmorphism dark UI, rose-gold accent #C08B88, Bellfair serif (numbers/headings) + DM Sans (data/labels)

Voir `ARCHITECTURE.md` pour détails infra et sécurité.

### Sécurité & compliance (état post-Sprint 0 → 3.x)

- **OAuth tokens encrypted at rest** (AES-256-GCM) — Sprint 1.3
- **TLS HSTS forced** (max-age 2 ans) — Sprint 2.4
- **Webhooks signés** (HMAC SHA-256 où applicable, `timingSafeEqual` constant-time compare)
- **Validation Zod** sur 49 routes critiques — Sprint 2.3
- **Logging structuré** (pino) + error tracking (Sentry, PII-safe) — Sprint 2.4 / 2.4b
- **16 champs monétaires** en `Decimal(19,4)` (pas de drift IEEE 754) — Sprint 3.2
- **51 indexes** sur 16+ tables (perf reads) — Sprint 3.3
- **Seed routes guarded** (`NODE_ENV === "production"` → 403) — Sprint 0
- **NextAuth debug** désactivé en prod — Sprint 0

Voir les 13 `SPRINT_X_REPORT.md` à la racine pour log technique.

---

## Table des matières

- [Préambule](#préambule)
- [Pour Andy — Modules Sales/Marketing/CRM](#pour-andy--modules-salesmarketingcrm)
- [Pour le PM — Vue complète](#pour-le-pm--vue-complète)
- [Modules détaillés](#modules-détaillés)
  - [1. Dashboard](#1-dashboard)
  - [2. CRM](#2-crm)
  - [3. Marketing](#3-marketing)
  - [4. Finance](#4-finance)
  - [5. Compliance](#5-compliance)
  - [6. Sentinel](#6-sentinel)
  - [7. Calendar](#7-calendar)
  - [8. Tasks](#8-tasks)
  - [9. Intel](#9-intel)
  - [10. Conferences](#10-conferences)
  - [11. Support](#11-support)
  - [12. Settings](#12-settings)
  - [13. Organigramme](#13-organigramme)
  - [14. Team](#14-team)
  - [15. Wiki](#15-wiki)
  - [16. Absences](#16-absences)
- [Architecture transverse](#architecture-transverse)
  - [T1. Webhooks entrants](#t1-webhooks-entrants)
  - [T2. Workers Railway](#t2-workers-railway)
  - [T3. AI insights cross-module](#t3-ai-insights-cross-module-sentinel-surfacé-partout)
  - [T4. Authentification (NextAuth v5)](#t4-authentification-nextauth-v5)
  - [T5. Telegram bot](#t5-telegram-bot)
  - [T6. Google Drive integration](#t6-google-drive-integration)
  - [T7. Google Email sync](#t7-google-email-sync)
  - [T8. Job queue](#t8-job-queue)
- [Backlog produit identifié](#backlog-produit-identifié)
  - [Priorité 🔴 critique](#priorité--critique)
  - [Priorité ⚠️ important](#priorité-️-important)
  - [Priorité 🟡 nice-to-have](#priorité--nice-to-have)
- [Dette technique](#dette-technique)
- [Annexes](#annexes)
  - [Tableau récapitulatif des 16 modules](#tableau-récapitulatif-des-16-modules)
  - [Health-check des modules](#health-check-des-modules)
  - [Glossaire](#glossaire)
  - [Maintenance](#maintenance)

---

## Bienvenue

Tu rejoins une équipe en pleine accélération. Oxen Finance / Escrowfy GmbH est une fintech VQF-régulée basée à Zoug (Switzerland) avec des entités opérationnelles à Brussels, Dubai, et Malte. Cet OS interne (Oxen OS) est notre tour de contrôle :

- **L'équipe sales** (Andy Head of Sales, Paul Louis, Vernon CEO) y suit ses deals et campagnes Outreach
- **L'équipe ops** (Aleks COO, Veronika Compliance Officer) y gère les processus, les policies, le screening, les incidents
- **Vernon (CEO)** y pilote la stratégie produit, le pipeline financier multi-entité, et le programme régulateur (VQF + autres juridictions)
- **L'équipe dev externe** (Johnny + freelances) construit selon les specs validées dans ce système
- **Toi (PM)** : tu vas être le point de pivot entre stratégie Vernon, exécution dev, et besoins terrain Andy/ops

Ton rôle pivote : capturer les frictions terrain, prioriser le backlog, traduire en specs, suivre la livraison.

---

## Ton onboarding 30 jours

### Jour 1 — Fondations
- Lire ce doc en entier (45 min) — ce que fait Oxen OS module par module
- Setup accès Oxen OS (Google OAuth avec ton `@oxen.finance`)
- Faire une session 30 min avec Vernon : Q&A (cf. liste de questions plus bas)
- Parcourir manuellement les modules dans l'ordre du sommaire
- Tester en cliquant : Dashboard → CRM Pipeline → Sentinel Chat → Calendar → Wiki

### Semaine 1 — Immersion
- Shadow Andy 1h (CRM Contacts, Pipeline, Outreach Lemlist) — observer son workflow réel
- Shadow Aleks/Veronika 1h (Compliance Policies, Risks, Trainings, Incidents)
- Lire `ARCHITECTURE.md`, `MIGRATIONS.md`
- Identifier 3 frictions UX/produit majeures observées (les noter, ne pas encore agir)
- Prendre des notes sur les workflows réels vs ce que dit cette doc

### Semaine 2 — Cartographie
- Compléter ce doc avec ce qui manque (TODOs vus en utilisation, frictions Andy/ops)
- Proposer un format de roadmap (Vernon validera la structure : Now / Next / Later, ou OKRs trimestriels)
- Première réunion produit hebdo (créer le rituel)
- Auditer le backlog stratégique connu (cf. plus bas) — proposer prioritisation

### Semaine 3-4 — Pilotage
- Driver 1 sprint produit avec l'équipe dev externe (Johnny)
- Présenter roadmap Q3 à Vernon
- Établir les mécaniques de pilotage : combien de sprints/mois, comment on tranche les arbitrages, qui décide quoi
- Commencer à shipper de la valeur (un fix ou une petite feature)

---

## 10 questions à poser à Vernon en jour 1

1. **Quels modules sont *vraiment* utilisés au quotidien** vs juste construits ? (le doc liste 16 modules — la réalité doit être plus serrée)
2. **Quelle est la priorité absolue cette semaine ?** (pas en abstrait — concrètement quel deal ou compliance deadline)
3. **Quels sont les SLA implicites** (réactivité Andy, livraison features, response Telegram) ?
4. **Quel est le rythme de release préféré ?** Daily? Weekly? À chaque PR mergée ?
5. **Avec qui parler pour valider une décision produit** ? (toi seul ? Andy pour CRM ? Veronika pour Compliance ?)
6. **Quel est le budget Anthropic API actuel** ? (cf. backlog 🔴 critique : pas de monitoring du coût AI)
7. **Quels modules sont audités par VQF / régulateurs** ? (Compliance évidemment, mais quoi d'autre ?)
8. **Quelles entités juridiques sont actives** vs en cours de création ? (cf. backlog 🔴 désalignement Finance entities — code dit 4, réalité dit 6)
9. **Quel est ton avis sur la dette technique Tasks** (2 namespaces — `Task` vs `CrmTask`) ? À quel sprint on tranche ?
10. **Qui sont les utilisateurs power vs occasionnels** ? (Andy power CRM/Outreach, Veronika power Compliance, qui d'autre ?)

---

## Backlog stratégique connu (court terme)

> Synthèse extraite de la section [Backlog produit identifié](#backlog-produit-identifié) de ce doc. Pour explorer en détail, voir cette section.

### 🔴 Critiques à trancher rapidement (court terme — Q3)

1. **CRM Companies — bouton "+ New Company" non fonctionnel** (TODO `companies/page.tsx:119`) — bloque la création de companies via UI
2. **Désalignement entités Finance ↔ OrgEntity** : code Finance hardcodé sur 4 entités, réalité business 6+ entités. Synchroniser.
3. **Dette Tasks 2 namespaces** : `Task` vs `CrmTask` à trancher (indice : Sentinel utilise `Task`)
4. **Settings Tab General incomplet** : décider si on complète ou on supprime
5. **Coût Anthropic non monitoré** : aucune visibilité par feature/user/mois
6. **Rate limiting absent sur routes AI** : un user peut spam les endpoints (Sprint 4 prévu)

### Sprints techniques prévus

- **Sprint 4** — rate limiting général (AI routes + webhooks + Telegram + Drive)
- **Sprint 3.3b** — pagination `findMany` sur les routes qui n'en ont pas (perf reads)
- **Sprint 3.4** — fix N+1 patterns (audit Prisma queries)
- **Sprint 5 (modularité)** — refactor de la page CRM `/crm` (1500+ lignes à scinder), cleanup composants orphelins Finance, suppression routes legacy 410

### Wishlist Andy (à confirmer en shadow)

> Vernon a mentionné qu'Andy a des frictions terrain non documentées. Pendant ton shadow Semaine 1, capture-les explicitement. Placeholder pour cette section :
>
> - [ ] Friction X observée (à compléter)
> - [ ] Friction Y observée (à compléter)
> - [ ] Feature manquante Z mentionnée par Andy (à compléter)

---

## Notation des statuts dans ce doc

- ✅ **Mature** : routes + pages + utilisé activement, sub-nav cohérente
- ⚠️ **Stable mais limité** : structure présente mais sub-modules vides, ou TODOs visibles, ou UI compacte vs backend riche
- 🔴 **En chantier** : code commencé mais pas terminé, plusieurs TODOs critiques (aucun module en 🔴 actuellement, mais des items 🔴 dans le backlog)
- 🟡 **Legacy / obsolète** : code présent mais peut-être plus utilisé

Distribution actuelle : **9× ✅ Mature** + **7× ⚠️ Stable mais limité** + **0× 🔴** + **0× 🟡**.

---

## Ressources clés

- **Ce doc** : `FEATURES_FOR_PM.md` (vue complète + onboarding) — tu lis ceci
- **`FEATURES.md`** (master) : vue complète sans préambule onboarding (référence canonique)
- **`FEATURES_FOR_ANDY.md`** : vue restreinte Sales/Marketing/CRM (à lire pour comprendre la perspective Andy)
- **`ARCHITECTURE.md`** : stack technique, infra Railway, sécurité (à lire Semaine 1)
- **`MIGRATIONS.md`** : pipeline DB, Prisma migrations
- **`README.md`** : setup local
- **`CLAUDE.md`** : conventions développement Oxen OS (utile si tu écris des PRs)
- **13 `SPRINT_X_REPORT.md`** à la racine : log technique des sprints de hardening récents
- **`prisma/schema.prisma`** : 70 models de données (référence de structure)
- **`src/lib/crm-config.ts`** : conventions CRM centralisées (stages, verticals, owners)
- **`src/lib/permissions.ts`** : règles d'accès par module/role
- **Slack/Telegram team** : Vernon te donnera les invites en jour 1

---

> **Le reste du document ci-dessous est l'inventaire complet des 16 modules + 8 transverses + backlog + dette technique + annexes.** C'est ta référence canonique. Reviens-y régulièrement pour vérifier la réalité du code.

---

## Modules détaillés

### 1. Dashboard

**Objectif** : Vue d'ensemble unifiée de l'activité Oxen Finance pour démarrer la journée — KPIs critiques, agenda du jour, et flux d'activité temps réel à travers tous les modules.

**Audience principale** : Tous

**Statut global** : ✅ Mature

**URL principale** : `/`

#### Vue d'ensemble

Le Dashboard est la page d'atterrissage par défaut après login. Il agrège des données provenant de plusieurs modules (CRM, Tasks, Calendar, Sentinel) en une vue compacte. Pas de sub-nav — c'est une page unique avec 4 sections empilées : KPIs, Quick Actions, Recent Activity, et Today's Schedule. L'horloge en temps réel (HH:MM:SS) est affichée dans le header. Equivaut au "morning briefing" — tout ce qu'un user doit savoir en 30 secondes en arrivant.

#### Features actuelles

- **4 KPI Cards animés** (Bellfair serif, counters animés au load) :
  - Active Clients (count)
  - Pipeline Value (€)
  - Monthly Volume (€)
  - Your Open Tasks (count, scope user-spécifique)

- **Quick Actions** — boutons d'accès rapide vers les pages principales (CRM, Tasks, etc.). Liste configurée côté backend dans `/api/dashboard`.

- **Recent Activity Feed** — flux temps réel des 10 derniers événements à travers Oxen OS, typés et icônisés :
  - `client_onboarded`, `agent_created`, `employee_joined`
  - `meeting_summary`, `task_completed`, `task_created`
  - `wiki_updated`, `sentinel_insight`, `contact_created`, `callnote_generated`
  - Chaque entrée cliquable renvoie vers la ressource concernée
  - Affichage relatif ("just now", "5 min ago", "yesterday", date au-delà de 7j)

- **Today's Schedule** — meetings du jour issus de Google Calendar :
  - Heure de début (24h, tabular-nums)
  - Titre du meeting
  - Avatars des attendees (max 5 + "+N")
  - Lien direct vers `/calendar` (View Full Calendar)

#### Routes API associées

- `GET /api/dashboard` : agrège stats + activityFeed + schedule + quickActions
- `GET /api/me` : infos user courant (utilisé pour scope "Your Open Tasks")

#### Models Prisma touchés (lecture)

Multi-modèles via `/api/dashboard` : `Deal` (pipeline), `CrmContact` (clients), `CrmTask` (open tasks), `Activity`/`ActivityLog` (feed), `CalendarEvent` (schedule).

#### Intégrations externes

- **Google Calendar** (via `googleapis`) : alimente Today's Schedule

#### Backlog identifié

- Aucun TODO visible dans le code de la page
- Dashboard hardcoded à 4 KPIs — pas de personnalisation user (chaque user voit les mêmes KPIs sauf "Your Open Tasks" qui est scopé)
- Activity feed limité à 10 entrées (pagination absente)
- Pas de filtre temporel (today / this week / this month)

---

### 2. CRM

**Objectif** : Tour de contrôle commercial complet — pipeline de deals (9 stages), base contacts/companies enrichie, séquences Outreach via Lemlist, et reporting. Remplace HubSpot dans Oxen OS.

**Audience principale** : Andy + PM + Vernon

**Statut global** : ✅ Mature (riche)

**URL principale** : `/crm`

**Contrôle d'accès** : Vérification via `requirePageAccess("crm")` dans toutes les routes API. Sidebar masque l'entrée si l'user n'a pas le pageKey `crm`.

#### Vue d'ensemble

Le module CRM est de loin le plus dense d'Oxen OS (60+ routes, 11 pages, 12+ models Prisma). Sub-nav officielle : 6 sub-modules (Dashboard, Pipeline, Contacts, Companies, Outreach, Reports). Deux features additionnelles vivent comme pages dédiées hors sub-nav principale : Inbox (`/crm/inbox`) et Forecast (`/crm/forecast`).

**Conventions métier (depuis `src/lib/crm-config.ts`)** :
- 9 stages pipeline : `new_lead`, `sequence_active`, `replied`, `meeting_booked`, `meeting_completed`, `proposal_sent`, `negotiation`, `closed_won`, `closed_lost`
- 7 verticals : FinTech/Crypto, Family Office, CSP/Fiduciaries, Luxury Assets, iGaming, Yacht Brokers, Import/Export
- 9 geo zones avec auto-assignment via `getOwnerForGeo()`
- 3 deal owners : Andy, Paul Louis, Vernon
- 8 outreach groups : GROUP 1 → GROUP 7B

---

#### Sub-module 2.1 — CRM Dashboard (`/crm`, sub-nav `dashboard`)

**Objectif** : Tableau de bord personnel CRM par owner — état du pipeline du user, deals en aging, relations à entretenir.

**Features** :
- Greeting personnalisé selon l'heure ("Good morning / afternoon / evening, [Owner]")
- Vue scopée à l'owner courant (Andy / Paul Louis / Vernon) ou aggrégée pour admins
- Aging des deals en couleur (vert / amber / rouge selon ancienneté du stage)
- Relations strength indicator (cold / warm / hot)
- Activité récente du portefeuille de l'user

**Composant** : `PersonalDashboard.tsx`

**Routes API** :
- `GET /api/crm/dashboard?owner={name}` : KPIs scopés owner avec date helpers (today/week/month)
- `GET /api/crm/overview` : vue agrégée tous owners
- `GET /api/crm/metrics` : metrics granulaires (close rate, avg deal size, etc.)
- `GET /api/crm/health` : health check des relations clients (lifecycle = "customer")

**Models** : `Deal`, `CrmContact`, `Activity`

---

#### Sub-module 2.2 — Pipeline (`/crm`, sub-nav `pipeline`)

**Objectif** : Visualisation Kanban des deals à travers les 9 stages. Drag & drop pour avancer un deal. Cœur opérationnel quotidien des sales.

**Features** :
- 3 view modes : **Kanban** (default), **Table**, **Cards**
- Drag & drop d'un deal d'un stage à l'autre → trigger PATCH `/api/crm/deals/[id]/stage`
- Filtres : Owner, Vertical (multi-select), Source d'acquisition, Geo Zone, Search texte
- Lost-deal modal : si un deal est déplacé en `closed_lost`, modal pour capturer raison + notes
- Probabilité pondérée par stage (`STAGE_PROBABILITY` constant)
- Aging visuel sur chaque card (couleur du badge selon temps passé dans le stage)
- Couleur per-owner (Andy / Paul Louis / Vernon)
- Indicators : KYC status, Outreach group badge, Vertical pills

**Composants** : `PipelineView.tsx`, `TableView.tsx`, `CardView.tsx`

**Routes API** :
- `GET /api/crm/deals` : liste paginée avec filtres
- `POST /api/crm/deals` : créer deal
- `GET/PATCH/DELETE /api/crm/deals/[id]` : CRUD individuel
- `PATCH /api/crm/deals/[id]/stage` : move stage (avec lostReason si applicable)
- `GET /api/crm/pipeline` : agrégat pipeline par stage
- `GET /api/crm/playbook/[dealId]` + `POST .../init` + `PATCH .../step/[stepId]` : checklist méthodologique par deal (PlaybookStep model)

**Models** : `Deal`, `PlaybookStep`, `LOST_REASONS` (config), `STAGE_LABELS`/`STAGE_COLORS`/`STAGE_PROBABILITY`

**Pages connexes** :
- `/crm/[id]` : détail deal individuel
- `/crm/inbox` : flux des dernières interactions reçues (emails, meetings, WhatsApp, Lemlist events)
- `/crm/forecast` : projection mensuelle pondérée par win probability

---

#### Sub-module 2.3 — Contacts (`/crm/contacts`)

**Objectif** : Base de contacts enrichie avec lifecycle, scoring AI, et synchronisation Lemlist. Page dédiée hors sub-nav (mais accessible aussi depuis `/crm` sub-nav `contacts`).

**Features** :
- 2 view modes : **List** (table inline-éditable) + **Kanban** (par lifecycle stage)
- Persistance du view mode en `localStorage`
- Filtres : Search, Outreach Group, Lifecycle Stage, Deal Owner, Vertical, Geo Zone, Contact Type, Lemlist Campaign
- Sort dynamique sur 10 champs (firstName, company, email, lifecycleStage, contactType, geoZone, dealOwner, lastInteraction, totalInteractions, createdAt)
- Pagination (50 contacts/page)
- **CSV Import Wizard** : import bulk avec mapping de colonnes
- **Push to Lemlist Modal** : enrôler N contacts sélectionnés (ou tous filtrés) dans une campagne Lemlist
- ContactSlideOver : panneau latéral d'édition (sans quitter la liste)
- Affichage Lemlist : campaignName, status, step / totalSteps, enrolledAt
- Page détail : `/crm/contacts/[id]` avec timeline complet

**Composants** : `KanbanBoard.tsx`, `InlineEditableTable.tsx`, `ContactSlideOver.tsx`, `CsvImportWizard.tsx`, `PushToLemlistModal.tsx`

**Routes API principales** :
- `GET /api/crm/contacts` : liste paginée + filtres + sort
- `POST /api/crm/contacts` : créer
- `GET/PATCH/DELETE /api/crm/contacts/[id]` : CRUD
- `GET /api/crm/contacts/[id]/activities` : timeline d'activités du contact
- `POST /api/crm/contacts/check-duplicates` : déduplication par email
- `POST /api/crm/contacts/import` : import CSV
- `GET /api/crm/contacts/export` : export CSV
- `GET /api/crm/contacts/search` : recherche full-text

**Routes API contacts (transverses, héritées)** :
- `/api/contacts/[id]/{emails,interactions,link-agent,metrics,signals,timeline}` — sub-routes utilisées par la page détail (timeline, IntentSignal, métriques)

**Models** : `CrmContact`, `Activity`, `IntentSignal`

**Intégrations** :
- **Lemlist** (via `src/lib/lemlist.ts`) : sync campaigns + push contacts via `/api/lemlist/enroll`, `/api/lemlist/campaigns`
- **Anthropic Claude** : AI scoring/summarize via `/api/crm/ai/score-lead/[contactId]`, `/api/crm/ai/summarize/[contactId]`

---

#### Sub-module 2.4 — Companies (`/crm/companies`)

**Objectif** : Annuaire des entreprises (employer ou client) avec rattachement aux contacts et deals.

**Features** :
- Liste de cards avec : nom, industry, HQ country/city, vertical pills, geo zone, domain, website
- Stats par company : nombre de contacts liés, nombre de deals actifs, total revenue (deals `closed_won`)
- Filtres : search, vertical, geo zone, industry (8 industries hardcodés : Financial Services, Technology, Legal, Real Estate, Gaming, Consulting, Logistics, Other)
- Page détail : `/crm/companies/[id]` avec contacts/deals/intel rattachés

**Routes API** :
- `GET /api/crm/companies` : liste avec filtres
- `POST /api/crm/companies` : créer (mais voir Backlog)
- `GET/PATCH/DELETE /api/crm/companies/[id]` : CRUD

**Models** : `Company`, `CompanyIntel`

**Backlog identifié** :
- 🔴 **TODO non résolu** dans `src/app/crm/companies/page.tsx:119` — bouton "+ New Company" affiche un placeholder, le modal de création n'est pas encore branché
- ⚠️ Pas de bulk import CSV (contrairement aux Contacts)
- ⚠️ Industries hardcodées (8 valeurs) — pas de gestion dynamique

---

#### Sub-module 2.5 — Outreach (`/crm/outreach`)

**Objectif** : Centre de contrôle des campagnes email Outreach (Lemlist) avec monitoring de la deliverability et gestion de la suppression list.

**Features** : 4 sections internes (state `Section = "domains" | "campaigns" | "suppression" | "warmup"`) :

**Domains** — gestion des domaines d'envoi :
- Health check par domain : SPF/DKIM/DMARC valid, tracking domain, blacklist status
- Metrics : open rate, reply rate, bounce rate, spam rate, inbox placement (avec couleurs vert/amber/rouge selon seuils)
- Status : `warmup` / `active` / `paused` / `blacklisted`
- Champ `warmupStartDate` calculé en semaines de chauffe (helper `warmupWeeks`)

**Campaigns** — campagnes Lemlist :
- Liste avec : name, vertical, owner, domain rattaché, platform (lemlist), status
- Metrics : totalSent, totalOpened, totalClicked, totalReplied, totalBounced, totalUnsubscribed
- Replies catégorisées : `repliesInterested`, `repliesNotInterested`, `repliesOoo`
- Meetings booked depuis la campagne (compteur)

**Suppression List** — emails à ne plus contacter :
- Sources : unsubscribed, bounced, do_not_contact, spam_complaint, manual
- Bulk add + import + export

**Warmup** — état de chauffe des domaines (calculé)

**Routes API** :
- `GET/POST /api/crm/outreach/domains` + `/api/crm/outreach/domains/[id]`
- `GET/POST /api/crm/outreach/campaigns` + `/api/crm/outreach/campaigns/[id]`
- `GET/POST /api/crm/outreach/suppression` + `/api/crm/outreach/suppression/[id]` + `.../bulk` + `.../export`
- `GET /api/crm/outreach/alerts` + `/api/crm/outreach/alerts/[id]` : alertes deliverability
- `POST /api/crm/outreach/check-health` : déclenche un health check
- `GET /api/crm/outreach/weekly-report` : rapport hebdomadaire
- `/api/lemlist/{campaigns,sync,enroll,remove,debug}` : intégration Lemlist directe

**Models** : `OutreachDomain`, `OutreachCampaign`, `OutreachAlert`, `SuppressionEntry`

**Webhook entrant** : `/api/webhooks/lemlist` (HMAC SHA-256) reçoit les events Lemlist temps réel et incrémente automatiquement les compteurs de la campagne correspondante (Sprint 0 hardened).

**Intégrations** : Lemlist (API + webhook signé)

---

#### Sub-module 2.6 — Reports (`/crm/reports`)

**Objectif** : Rapports de performance commerciaux — pipeline distribution, revenue par source/vertical, performance par owner.

**Features** :
- 4 KPI principaux : Total Pipeline, Weighted Pipeline, Total Active Deals, Won This Quarter
- Charts (Recharts) :
  - **Pipeline by stage** : BarChart avec count + totalValue + weightedTotal
  - **Revenue by source** : breakdown des deals `closed_won` par acquisitionSource
  - **Revenue by vertical** : breakdown par vertical
  - **Performance per owner** : par DEAL_OWNERS (Andy / Paul Louis / Vernon)
- Tooltip custom Bellfair-styled

**Routes API** :
- `GET /api/crm/reports/pipeline` : agrégation par stage
- `GET /api/crm/reports/revenue` : agrégation par source + vertical
- `GET /api/crm/deals` : alimenté pour calculs custom

**Models** : Lecture de `Deal` agrégée

---

#### Pages connexes (hors sub-nav principale)

- **`/crm/inbox`** — Inbox des activités entrantes (email_received, meeting_calendly, whatsapp_message, clay_sequence_event), 50 dernières, cliquable vers contact/deal
- **`/crm/forecast`** — Forecast mensuel pondéré par winProbability, charts par stage et par owner
- **`/crm/[id]`** — Détail deal complet (avec Playbook checklist, AI deal health)
- **`/crm/agents/[id]`** — 🟡 Page legacy (4 lignes), redirige vers `/crm/contacts/[id]`. Concept "agent" fusionné dans Contacts comme `contactType: "introducer"`.

---

#### CRM AI (transverse au module)

Le sub-module Sentinel surface des features AI directement dans CRM (insights inline) :

**Routes** :
- `GET /api/crm/ai/score-lead/[contactId]` + `POST /api/crm/ai/score-all` : lead scoring via Claude
- `GET /api/crm/ai/summarize/[contactId]` : résumé contact
- `GET /api/crm/ai/deal-health/[dealId]` + `POST /api/crm/ai/health-check-all` : santé deal (signaux de risque/opportunité)
- `GET/POST /api/crm/ai/followups` + `/api/crm/ai/followups/[id]` + `POST /api/crm/ai/check-followups` : follow-ups suggérés
- `POST /api/crm/ai/compute-relationships` : calcul des relationship scores

**Models** : `AIInsight`, `AIFollowUp`

**Intégration** : Anthropic Claude API (`@anthropic-ai/sdk`, model `claude-sonnet-4-20250514`)

---

#### Automations CRM

- `POST /api/crm/automation/run-daily` (admin requis via `requirePageAccess("crm")`) : job quotidien qui :
  - Update deal aging (`stage_aging_days` incrémenté)
  - Recompute relationship scores
  - Surface stale tasks
  - Mettre à jour les contacts dormants

#### Audit log

- `GET /api/crm/audit?entityType=...&entityId=...` : historique des mutations (createdAt, oldValue, newValue, performedBy) — alimente `AuditLog` model

#### SmartViews

- `GET/POST /api/crm/views` + `/api/crm/views/[id]` : sauvegarde de filtres custom par user (model `SmartView`)

---

#### Intégrations externes du module CRM

- **Anthropic Claude** : lead scoring, deal health, summaries, follow-ups suggestions
- **Lemlist** : sync campaigns, push contacts, webhook events temps réel
- **Google Calendar / Gmail** : timeline contact alimentée par sync emails + meetings (workers Railway)
- **Clay** : webhook entrant `/api/webhooks/clay` enrichit `IntentSignal` (tech installs, etc.)
- **Trigify** : webhook entrant `/api/webhooks/trigify` enrichit signaux de job-change

#### Workflow type — Acquisition d'un nouveau lead

1. Lead arrive via formulaire site (`/api/crm/webhooks/inbound-lead`) → `CrmContact` créé en `lifecycleStage: "new_lead"`
2. Auto-assignment owner via `getOwnerForGeo(country)` (Andy / Paul Louis / Vernon)
3. AI scoring via `/api/crm/ai/score-lead/[contactId]` → `relationshipScore` calculé
4. Push vers une campagne Lemlist via `PushToLemlistModal` → `lifecycleStage: "sequence_active"`
5. Webhook Lemlist reçoit `emailsSent` → incrémente `lemlistStep`, alimente Activity
6. Webhook Lemlist reçoit `emailsReplied` → `lifecycleStage: "replied"`, ajoute Activity
7. Sales schedule meeting → `lifecycleStage: "meeting_booked"`
8. Deal créé manuellement, avancé dans le pipeline (Kanban drag & drop)
9. Closed won → `OutreachCampaign.meetingsBooked` incrémenté, AuditLog créé

#### Backlog identifié pour CRM

- 🔴 **Companies "+ New Company" non fonctionnel** (TODO `companies/page.tsx:119`)
- ⚠️ Pas de bulk-edit dans la liste contacts (sélection multi-row absente sauf pour Lemlist push)
- ⚠️ Custom fields : pas de mécanisme — tout est hardcoded dans le model `CrmContact`
- ⚠️ Mobile responsive non vérifié (interface dense, optimisée desktop)
- 🟡 Refactoring suggéré : page `/crm` mélange 6 sub-modules dans un seul fichier 1500+ lignes

---

### 3. Marketing

**Objectif** : Hub de pilotage marketing — social media metrics, content calendar, génération SEO/GEO assistée par IA, veille concurrentielle, et compliance check des contenus publiés.

**Audience principale** :
- **Andy** (focus quotidien) : Social Media + Content + Compliance Check
- **Vernon** (focus stratégique) : SEO/GEO + Veille (cf. décision Phase 0)
- **PM** : full

**Statut global** : ⚠️ Stable mais limité (1 page UI pour 34 routes API — backend riche, surface UI compacte par tabs)

**URL principale** : `/marketing`

**Contrôle d'accès** : `super_admin` / `admin` OU département `marketing`. Sinon "Access Denied" affiché. Vérifié via `/api/me` au mount.

#### Vue d'ensemble

Le module Marketing est une seule page avec 5 onglets (Social Media, Content, SEO/GEO, Veille, Compliance Check). Chaque onglet est un composant séparé. Le sub-module SEO/GEO est lui-même un composant complet (`SeoModule`) avec ses propres 6 sub-tabs internes — c'est essentiellement un mini-module imbriqué dans Marketing.

Le subtitle dynamique du header affiche : `{X} followers · {Y} impressions this month`.

---

#### Sub-module 3.1 — Social Media (tab `social`)

**Objectif** : Tracking des metrics social (LinkedIn, Twitter, etc.) avec saisie manuelle hebdomadaire et visualisation tendances.

**Composants** : `OverviewTab.tsx` + `MetricsTab.tsx`

**Features** :
- **Overview KPIs** : Total Followers, Monthly Impressions, Engagement, Click-through, Posts (Bellfair counters animés)
- **Charts** (Recharts) : LineChart d'évolution + BarChart par platform
- **Saisie manuelle** : modal pour ajouter une entrée hebdomadaire {platform, date, followers, impressions, engagement, clicks, posts}
- Plateformes supportées : configurées dans `src/components/marketing/constants.ts` (PLATFORMS, PLATFORM_COLORS)

**Routes API** :
- `GET /api/marketing/metrics` : liste des metrics
- `POST /api/marketing/metrics` : ajouter entrée
- `GET /api/marketing/metrics/summary` : résumé pour Overview KPIs

**Models** : `SocialMetrics`

**Backlog** :
- Saisie manuelle uniquement — pas de sync auto avec LinkedIn/Twitter/Reddit APIs
- Pas de comparaison période-à-période (M-1 vs M)

---

#### Sub-module 3.2 — Content (tab `content`)

**Objectif** : Pipeline éditorial (Kanban) des idées de contenu, avec drag & drop entre statuses et compliance check intégré.

**Composant** : `ContentTab.tsx`

**Features** :
- Kanban avec colonnes par status (`IDEA_STATUSES`) — drag & drop entre colonnes
- Status `rejected` séparé (toggle "Show Rejected")
- Bouton "+ New Idea" → `IdeaModal` (création/édition)
- Idée avec : title, platform, status, priority, assignee (employé), description, contentText
- **Compliance Check inline** : icône ShieldCheck sur chaque idée → ouvre `CheckModal` pour analyser le contenu

**Routes API** :
- `GET /api/marketing/ideas` : liste
- `POST /api/marketing/ideas` : créer
- `GET/PATCH/DELETE /api/marketing/ideas/[id]` : CRUD
- `PATCH /api/marketing/ideas/[id]` (status only) : drag & drop trigger

**Models** : `ContentIdea`

---

#### Sub-module 3.3 — SEO / GEO (tab `seo`)

**Objectif** : Mini-module dédié à la SEO traditionnelle + GEO (Generative Engine Optimization, c.-à-d. visibilité dans les réponses ChatGPT/Claude). Utilise massivement Anthropic pour génération.

**Composant racine** : `SeoModule.tsx` avec 6 sub-tabs internes (`SeoSubTab`) :

##### 3.3.a — Overview (sub-tab `overview`)
**Composant** : `SeoOverview.tsx`
**Route API** : `GET /api/seo/reports/overview`
KPIs SEO + alertes actives.

##### 3.3.b — Keywords (sub-tab `keywords`)
**Composant** : `KeywordsTab.tsx`
**Routes API** :
- `GET/POST /api/seo/keywords` + `/api/seo/keywords/[id]`
- `POST /api/seo/keywords/bulk-import` : import bulk
- `POST /api/seo/keywords/discover` : **AI-powered keyword discovery** via Claude
**Models** : `Keyword`

##### 3.3.c — Blog Writer (sub-tab `writer`)
**Composant** : `BlogWriterTab.tsx`
**Routes API** :
- `GET/POST /api/seo/articles` + `/api/seo/articles/[id]`
- `POST /api/seo/articles/generate` : **génération article via Claude** (prompts dans `src/lib/claude.ts`)
- `POST /api/seo/articles/[id]/refresh` : régénération
- `POST /api/seo/articles/[id]/publish` : publication
- `POST /api/seo/articles/auto-publish` : publication automatique
- `GET /api/seo/articles/calendar` : calendrier éditorial
**Models** : `Article`

##### 3.3.d — GEO Monitor (sub-tab `geo`)
**Composant** : `GeoMonitorTab.tsx`
**Objectif** : tester si Oxen est cité dans les réponses LLM pour des prompts cibles
**Routes API** :
- `GET/POST /api/seo/geo/prompts` + `/api/seo/geo/prompts/[id]` : prompts à tester
- `POST /api/seo/geo/run-test/[promptId]` : run un test individuel
- `POST /api/seo/geo/run-tests` : run batch
- `GET /api/seo/geo/results` : résultats
- `GET /api/seo/geo/share-of-voice` : part de voix vs concurrents
**Models** : `GeoTestPrompt`, `GeoTestResult`

##### 3.3.e — News Monitor (sub-tab `news`)
**Composant** : `NewsMonitorTab.tsx`
**Routes API** :
- `GET /api/seo/news` : flux news
- `POST /api/seo/news/scan` : scan manuel des sources
- `POST /api/seo/news/auto-scan` : scan automatique (cron)
- `GET/POST /api/seo/news/sources` + `/api/seo/news/sources/[id]` : gestion des sources RSS
**Models** : `NewsItem`, `NewsSource`

##### 3.3.f — Reports (sub-tab `reports`)
**Composant** : `SeoReportsTab.tsx`
**Routes API** :
- `GET /api/seo/reports/articles` : perf articles publiés
- `GET /api/seo/reports/keywords` : perf keywords
- `GET /api/seo/reports/geo` : perf GEO

**Alertes SEO** : `GET/POST /api/seo/alerts` + `/api/seo/alerts/[id]` (model `SeoAlert`)

**Intégrations sub-module SEO/GEO** :
- **Anthropic Claude** (massivement) : keyword discovery, article generation, GEO testing
- Sources RSS externes (configurées dans `NewsSource`)

---

#### Sub-module 3.4 — Veille (tab `intel`)

**Objectif** : Capture manuelle d'observations marketing (concurrence, tendances, opportunités) — **distinct du module top-level Intel** qui fait de la veille AI-powered cross-domaine.

**Composant** : `IntelTab.tsx`

**Features** :
- Liste filtrable par type (`INTEL_TYPES`) avec couleurs et niveau de relevance
- Bouton "+ Add Intel" → `IntelModal` (création/édition)
- Expand/collapse de chaque entrée
- Suppression directe

**Routes API** :
- `GET /api/marketing/intel` : liste
- `POST /api/marketing/intel` : créer
- `GET/PATCH/DELETE /api/marketing/intel/[id]` : CRUD

**Models** : `MarketingIntel`

**Note** : Sub-module à différencier du module Intel top-level (`/intel`) qui fait de la recherche AI cross-vertical.

---

#### Sub-module 3.5 — Compliance Check (tab `compliance`)

**Objectif** : Validation pré-publication des contenus marketing par règles métier (claims interdits, terminologie réglementée, etc.) — clé pour une fintech VQF-régulée.

**Composant** : `ComplianceCheckTab.tsx`

**Features** :
- Liste des checks effectués (history)
- Création d'un check : platform, contentType, contentText, optional imageUrl
- Lien direct possible vers un `ContentIdea` du tab Content (`contentIdeaId`)
- Résultat : tableau de **Findings** {rule, status: pass/warning/fail, detail, suggestion}
- Pending checks : `GET /api/marketing/compliance-checks/pending`

**Routes API** :
- `GET /api/marketing/compliance-checks` : liste
- `GET/PATCH/DELETE /api/marketing/compliance-checks/[id]` : CRUD
- `POST /api/marketing/compliance-check` : **lancer un check** (utilise Anthropic Claude pour analyser le contenu)
- `GET /api/marketing/compliance-checks/pending` : queue

**Models** : `ContentComplianceCheck`

**Intégration** : Anthropic Claude (analyse de conformité)

---

#### Intégrations externes du module Marketing

- **Anthropic Claude** (intensivement) : SEO/GEO génération, Compliance Check, Keyword Discovery, Blog Writer
- **Sources RSS news** : configurables via `NewsSource`
- **Veille manuelle** : pas d'intégration directe LinkedIn/Twitter (saisie manuelle)

#### Backlog identifié pour Marketing

- ⚠️ **Surface UI compacte** : 1 page avec 5 tabs pour 34 routes API — beaucoup de features backend non visibles à 100% en UI (à auditer)
- ⚠️ Social Media : pas de sync API auto (saisie manuelle hebdomadaire uniquement)
- ⚠️ Content : pas de scheduler de publication (statuses manuels)
- ⚠️ Veille (`MarketingIntel`) vs Intel top-level (`/intel`) — risque de confusion utilisateur, double-emploi potentiel à clarifier
- ⚠️ Compliance Check : algorithme exact des "rules" pas auditable depuis l'UI (côté Claude prompt)
- 🟡 Pas de TODO `/FIXME` visible dans le code des tabs

---

### 4. Finance

**Objectif** : Comptabilité opérationnelle multi-entités du groupe Oxen — P&L mensuel, transactions catégorisées, budgets vs réalisé, comptes bancaires, et reporting (cashflow, P&L, comparatif inter-entités).

**Audience principale** : Vernon (super_admin / admin) ou département `finance`

**Statut global** : ⚠️ Backend riche (15 routes, 5 sub-modules fonctionnels), UI compacte (1 page avec 5 tabs). Composants orphelins (`EntriesTab.tsx`, `BudgetTab.tsx`, `EntryModal.tsx`, `ImportModal.tsx`) indiquent un refactor partiel.

**URL principale** : `/finance`

**Contrôle d'accès** : `super_admin` / `admin` OU département `finance`. Sinon "Access Denied". Vérifié via `/api/me`.

#### Vue d'ensemble

Le module Finance gère la comptabilité opérationnelle des **4 entités du groupe** (telles que définies dans le code) : Oxen, Escrowfy, Galaktika, Lapki. Chaque tab supporte le filtrage par entité (`selectedEntity`) et par mois (`selectedMonth`, sauf Transactions et Accounts). Les données monétaires sont en `Decimal(19,4)` côté DB (Sprint 3.2 Decimal hardening) et sérialisées proprement via `serializeMoney()`.

**Catégories métier hardcodées (`src/components/finance/constants.ts`)** :
- Revenue : Client Fees, Exchange Spread, Card Interchange, Other Revenue
- Expense : Salaries, Office, Tech Infrastructure, Legal, Compliance, Marketing, ... (liste extensible)

---

#### Sub-module 4.1 — P&L Overview (tab `overview`)

**Objectif** : Tableau de bord financier mensuel — KPIs, tendance, breakdown des catégories.

**Composant** : `OverviewTab.tsx`

**Features** :
- KPIs : Revenue, Expenses, Net Profit, Cash Balance (Bellfair counters)
- Charts (Recharts) : BarChart par catégorie, AreaChart d'évolution, PieChart répartition expenses
- Goals : objectifs financiers configurables avec progression visuelle
- Sparklines pour tendances rapides
- Filtres : mois (`selectedMonth`) + entité (`selectedEntity`)

**Routes API** :
- `GET /api/finance/overview?month=YYYY-MM&entity=...` : agrégation mensuelle
- `GET /api/finance/summary` : résumé global
- `GET/POST /api/finance/goals` : CRUD objectifs

**Models** : `FinanceTransaction` (lecture agrégée), `FinanceGoal`

---

#### Sub-module 4.2 — Transactions (tab `transactions`)

**Objectif** : Saisie + visualisation des transactions financières (revenus + dépenses) par entité.

**Composant** : `TransactionsTab.tsx` (+ `TransactionModal.tsx` + `TransactionImportModal.tsx`)

**Features** :
- Tableau triable sur 6 colonnes : date, type (revenue/expense), category, amount, entity, status
- Filtres : entité
- Ajout / édition via `TransactionModal`
- **Import bulk** via `TransactionImportModal`
- **Export CSV** : `window.open("/api/finance/transactions/export?...")`
- Statuses transaction : `TX_STATUSES`
- Sources de paiement : `PAYMENT_SOURCES`
- Champs : type, category, amount, currency, entity, status, paymentSource, date, notes

**Routes API** :
- `GET /api/finance/transactions?entity=...` : liste filtrée
- `POST /api/finance/transactions` : créer
- `GET/PATCH/DELETE /api/finance/transactions/[id]` : CRUD
- `POST /api/finance/transactions/bulk` : import bulk
- `GET /api/finance/transactions/export` : export CSV

**Models** : `FinanceTransaction`

---

#### Sub-module 4.3 — Budgets (tab `budgets`)

**Objectif** : Budgets prévisionnels par catégorie + comparaison automatique avec le réalisé (variance).

**Composant** : `BudgetsTab.tsx`

**Features** :
- Liste des budgets du mois courant avec colonnes : category, budgeted, actual, variance
- Création de budgets en lot (POST `/api/finance/budgets` reçoit un array `items: [{category, amount}]`)
- Sélecteur de mois (`getMonthOptions`, `getPrevMonth`)
- Goals affichés inline (FinanceGoal model)
- Visualisation variance : couleurs (vert si actual ≤ budgeted, rouge si dépassé)

**Routes API** :
- `GET /api/finance/budgets?month=YYYY-MM&entity=...` : liste avec calcul variance
- `POST /api/finance/budgets` : créer/upsert en lot
- `GET /api/finance/budget` : (singulier — endpoint séparé, à clarifier)

**Models** : `FinanceBudget`

---

#### Sub-module 4.4 — Accounts (tab `accounts`)

**Objectif** : Catalogue des comptes bancaires du groupe (par entité).

**Composant** : `AccountsTab.tsx`

**Features** :
- Cards par compte : entity, label, type, IBAN, balance, currency, status
- Création / édition inline
- Filtres : entity, active uniquement (`active=true`)
- Account types : `ACCOUNT_TYPES` constant
- IBAN format : placeholder MT00 XXXX... (Maltese standard, à adapter)

**Routes API** :
- `GET /api/finance/accounts?entity=...&active=true` : liste
- `POST /api/finance/accounts` : créer
- `GET/PATCH/DELETE /api/finance/accounts/[id]` : CRUD

**Models** : `BankAccount`

---

#### Sub-module 4.5 — Reports (tab `reports`)

**Objectif** : Reports financiers structurés par type — P&L, Cashflow, Entity Comparison.

**Composant** : `ReportsTab.tsx`

**Features** :
- 3 ReportType : `pnl`, `cashflow`, `entity_comparison`
- Charts (Recharts) : BarChart (P&L), AreaChart (cashflow trend), comparison stacked bars
- Export probable (à confirmer)

**Routes API** :
- `GET /api/finance/reports?type={pnl|cashflow|entity_comparison}` : data du report
- `GET /api/finance/[id]` : route ambiguë (à confirmer son rôle exact)
- `GET/POST /api/finance/bulk` : opérations bulk

**Models** : `FinanceTransaction`, `FinanceBudget` (lecture agrégée)

---

#### Workflow type — Saisie d'une transaction

1. User clique "+ New Transaction" sur tab Transactions → ouvre `TransactionModal`
2. Sélectionne type (revenue/expense), category (depuis liste hardcoded), entity (4 entités), amount, currency, date, status
3. POST `/api/finance/transactions` → crée le `FinanceTransaction`
4. `refreshAll()` rafraîchit les 5 fetchers (transactions, summary, budgets, goals, accounts)
5. KPIs Overview se mettent à jour automatiquement
6. Si tab Budgets ouvert : variance recalculée dynamiquement

#### ⚠️ Dette technique signalée

- **Composants orphelins** : `EntriesTab.tsx` et `BudgetTab.tsx` (singulier) existent dans `src/components/finance/` mais ne sont **pas importés** par `page.tsx`. Probablement des composants legacy d'une ancienne version (avant la sub-nav actuelle à 5 tabs). Idem `EntryModal.tsx` + `ImportModal.tsx`. **À auditer pour suppression future.**
- **Decimal serialization** : appliqué Sprint 3.2 — fields `amount`, `balance`, `target`, `actual` en `Decimal(19,4)` (16 fields), sérialisés via `serializeMoney()` (cf. `src/lib/decimal.ts`)

#### Backlog identifié pour Finance

- 🔴 **Désalignement entités** : code liste **4 entités** (`oxen`, `escrowfy`, `galaktika`, `lapki`) mais réalité business inclut **Escrowfy GmbH, Escrowfy Ltd, Neural ID Pay, Arventis Labs, Green Nation SARL, Lapki Digital Pay**. Synchroniser avec `OrgEntity` (source de vérité). La liste est hardcodée dans `src/components/finance/constants.ts` — pas de fetch dynamique depuis OrgEntity.
- ⚠️ **Surface UI compacte** : 1 page pour 15 routes — certaines features backend (`/api/finance/[id]`, `/api/finance/seed`) pas évidemment branchées
- ⚠️ Catégories revenue/expense **hardcodées** dans `constants.ts` — pas de gestion dynamique
- ⚠️ 4 entités hardcodées (Oxen, Escrowfy, Galaktika, Lapki) — gérées dans `OrgEntity` côté Settings mais pas synchronisées
- ⚠️ Pas de multi-currency conversion (FinanceTransaction stocke `currency` mais agrégations supposent même devise)
- ⚠️ Imports CSV : format de mapping pas documenté (à voir dans `TransactionImportModal`)
- 🟡 Route `/api/finance/seed` : endpoint dev-only (Sprint 0 NODE_ENV-guarded à vérifier)

---

### 5. Compliance

**Objectif** : Plateforme de gestion compliance VQF-régulée (Switzerland) — registre des risques, bibliothèque des policies versionnées, programme de training, suivi des licenses régulatrices, et reporting d'incidents.

**Audience principale** : Vernon + Veronika (Compliance Officer) + équipe ops

**Statut global** : ✅ Mature

**URL principale** : `/compliance`

**Contrôle d'accès** : pageKey `compliance` (vérifié via sidebar + `requirePageAccess` côté API)

#### Vue d'ensemble

Le module Compliance est un des plus structurés d'Oxen OS — 3 pages dédiées (`/compliance`, `/compliance/incidents/[id]`, `/compliance/policies/[id]`), 6 sub-modules en sub-nav, 8 models Prisma. Conçu pour respecter les exigences VQF (SRO Switzerland) et préparé pour audits régulateurs : SEMI (UK FCA), VASP (Italy), MSB (Canada), MFSA (Malta), CSSF (Luxembourg).

KPI Cards (Bellfair styled) en Overview avec icônes Lucide colorées, badges severity (critical/high/medium/low), badges status (active/draft/pending/resolved/etc.).

---

#### Sub-module 5.1 — Overview (tab `overview`)

**Objectif** : Vue agrégée de tout le programme compliance — comptes par catégorie, deadlines à venir, score moyen de risque, taux de complétion training.

**Features** :
- 6 KPI Cards : policies (par status), risks (par status), avg risk score, training completion rate, incidents (par severity), licenses (par status), screening (par result)
- **Upcoming deadlines** : liste agrégée des dates clés (review dates, expiry dates, renewal dates) à travers policies/risks/training/licenses

**Route API** : `GET /api/compliance/overview`

**Models lus** : `Policy`, `Risk`, `Training`, `RegulatoryLicense`, `ComplianceIncident`, `ScreeningRecord`

---

#### Sub-module 5.2 — Policies (tab `policies`)

**Objectif** : Bibliothèque des politiques internes versionnées (KYC, AML, Privacy, Risk, etc.).

**Features** :
- CRUD policies avec champs : title, code, category, status, priority, description, ownerId, reviewerId, effectiveDate, expiryDate, reviewDate
- Lien vers entité (`OrgEntity`) — quel département/société porte la policy
- **Versioning** : chaque policy a un historique (`PolicyVersion`)
- Page détail : `/compliance/policies/[id]` avec viewer du contenu + history
- Categories Risk : operational, financial, regulatory, cyber, reputational, strategic, compliance (couleurs distinctes)

**Routes API** :
- `GET/POST /api/compliance/policies` : liste + création
- `GET/PATCH/DELETE /api/compliance/policies/[id]` : CRUD
- `GET/POST /api/compliance/policies/[id]/versions` : versioning

**Models** : `Policy`, `PolicyVersion`

---

#### Sub-module 5.3 — Risks (tab `risks`, label "Risk Register")

**Objectif** : Registre formel des risques avec scoring quantitatif (likelihood × impact) et plan de mitigation.

**Features** :
- Scoring : `likelihood` (1-5) × `impact` (1-5) → `riskScore` (1-25)
- Mitigation tracking : `mitigation` text + `residualLikelihood` × `residualImpact` → `residualScore`
- Status workflow : open → mitigating → monitoring → accepted / closed
- Champ `lastAssessedAt` pour suivi des révisions
- 7 catégories de risques (operational, financial, regulatory, cyber, reputational, strategic, compliance)

**Routes API** :
- `GET/POST /api/compliance/risks` : liste + création
- `GET/PATCH/DELETE /api/compliance/risks/[id]` : CRUD

**Models** : `Risk`

---

#### Sub-module 5.4 — Training (tab `training`)

**Objectif** : Programme de formation compliance — modules (KYC, AML, etc.), tracking des complétions par employé.

**Features** :
- CRUD trainings avec : title, code, category, provider, durationHours, frequency (annual/biennial/etc.), mandatory bool, dueDate
- Per-training : `completionRate`, `completedCount`, `totalAssigned`
- Tracking individual : `TrainingCompletion` model (qui a complété, quand)
- Status : active / archived

**Routes API** :
- `GET/POST /api/compliance/training` : liste + création
- `GET/PATCH/DELETE /api/compliance/training/[id]` : CRUD
- `GET/POST /api/compliance/training/[id]/completions` : marquer comme complété par employé

**Models** : `Training`, `TrainingCompletion`

---

#### Sub-module 5.5 — Licenses (tab `licenses`, label "Regulatory")

**Objectif** : Inventaire des licenses régulatrices détenues par chaque entité du groupe.

**Features** :
- Champs : name, code, regulator (FINMA, FCA, MFSA, CSSF, VARA, etc.), type, status, entity, grantedDate, expiryDate, renewalDate, conditions
- Status workflow : active / pending / suspended / expired / revoked
- Suivi des dates de renouvellement (alimente Overview "upcoming deadlines")

**Routes API** :
- `GET/POST /api/compliance/licenses` : liste + création
- `GET/PATCH/DELETE /api/compliance/licenses/[id]` : CRUD

**Models** : `RegulatoryLicense`

**Glossaire** :
- VQF (SRO suisse), SEMI (UK FCA Small EMI), VASP (Italy), MSB (Canada), MFSA (Malta), CSSF (Luxembourg), FINMA (Switzerland), VARA (UAE)

---

#### Sub-module 5.6 — Incidents (tab `incidents`)

**Objectif** : Reporting + investigation des incidents compliance/sécurité, avec suivi de l'éventuel report aux régulateurs.

**Features** :
- Champs : title, code, type, severity (critical/high/medium/low), status (investigating/open/resolved/closed), reportedBy, assignedTo
- **Reporting régulateur** : `reportedToRegulator` bool + `regulatorRef` + `reportedAt`
- Impact financier : `financialImpact` + `currency` (Decimal(19,4))
- Tags multi-valeurs
- Page détail : `/compliance/incidents/[id]` avec timeline + actions

**Routes API** :
- `GET/POST /api/compliance/incidents` : liste + création
- `GET/PATCH/DELETE /api/compliance/incidents/[id]` : CRUD

**Models** : `ComplianceIncident`

---

#### Screening (intégré au tab Overview, pas un sub-tab dédié)

Bien que le sub-nav officiel ne liste pas Screening comme tab séparé, il est complètement implémenté en UI :
- **KPI card Overview** : count de "clear" + "match"
- **Bouton "+ New Screening"** dans le header Overview → ouvre `AddScreeningModal`
- Champs : subject (individual/entity), screening type (sanctions/PEP/adverse media), provider, result, notes
- **Routes API** : `GET/POST /api/compliance/screening` + `GET/PATCH/DELETE /api/compliance/screening/[id]`
- **Models** : `ScreeningRecord`

**Backlog** : Promouvoir Screening en sub-tab dédié (cohérence avec les 6 autres) ou ajouter sa propre page `/compliance/screening`. Aujourd'hui c'est un sub-tab "fantôme" — découvrable uniquement quand l'user est sur Overview.

#### Intégrations externes du module Compliance

- **Aucune intégration externe directe** détectée pour ce module (pas de Sanctions API tierce branchée — screening est manuel ou via UI custom)
- Possibilité future : intégration ComplyAdvantage, Onfido, Sumsub (à confirmer avec Vernon)

#### Workflow type — Création d'un incident compliance

1. Compliance Officer (Veronika) clique "+ New Incident" sur tab Incidents
2. Renseigne : title, type, severity, description, financialImpact, entity concernée
3. POST `/api/compliance/incidents` → status initial `investigating`
4. Si gravité critique/high : flag manuel `reportedToRegulator: true`, ajout `regulatorRef`
5. Investigation se déroule (status → `open`)
6. Mise à jour du `assignedTo`, ajout de tags
7. Fermeture : status `resolved` + `resolvedAt`
8. Audit log automatique (transverse, model `AuditLog`)

#### Backlog identifié pour Compliance

- ⚠️ Pas d'intégration Sanctions/PEP API tierce visible (screening manuel)
- ⚠️ Pas de notifications email/Slack sur incidents critical/high
- ⚠️ Workflow approval pour Policies (créer → reviewer review → approve) pas évident dans l'UI (status `pending_review` existe mais le mécanisme exact ?)
- ⚠️ Bulk actions absentes (assigner en masse un training à 10 employés)
- 🟡 Pas de TODO visible dans le code

---

### 6. Sentinel

**Objectif** : Assistant IA intégré à Oxen OS — chat conversationnel intelligent, insights automatiques, briefs de meeting, et call notes. Fil rouge AI cross-module powered by Claude.

**Audience principale** : Tous (Andy + PM + Vernon + équipe)

**Statut global** : ✅ Mature

**URL principale** : `/ai`

**Contrôle d'accès** : Aucun gating dédié (sidebar visible à tous), mais "Team View" toggle disponible uniquement pour `super_admin` / `admin`.

#### Vue d'ensemble

Sentinel est l'assistant AI signature d'Oxen OS — l'entrée sidebar est mise en évidence avec un effet visuel "pulse" + gradient rose-gold. Page composée de 3 sections principales empilées (`ChatSection`, `InsightsSection`, `BriefsSection`) + 1 panneau Intel Highlights latéral + 1 modal Daily Digest déclenchable.

**Tagline officiel** : "Sentinel — your AI-powered sales intelligence engine, powered by Claude"

**Deep-link CRM** : Si arrive depuis `/crm/contacts/[id]?contactId=...&contactName=...`, le chat pré-remplit le prompt : "Tell me about [Name] — deal status, recent interactions, risks, and opportunities."

---

#### Sub-module 6.1 — Chat (Section 1)

**Objectif** : Interface conversationnelle pour interroger Oxen OS en langage naturel.

**Composant** : `ChatSection.tsx`

**Features** :
- Conversation persistée (model `AIConversation`)
- Quick Actions pré-définies (`QUICK_ACTIONS` constant) pour démarrer rapidement
- **Markdown-lite renderer** custom dans le composant (gère titres, listes, gras)
- **Action Blocks** : Sentinel peut renvoyer des `action-json` blocks rendus comme boutons cliquables (ex: "Create Task", "Open Contact")
- Historique scrollable
- `initialPrompt` optionnel via deep-link
- `onRefresh` callback : déclenche refresh insights + briefs après une action AI

**Routes API** :
- `POST /api/ai/chat` : envoie un prompt, reçoit la réponse Claude
- `GET /api/ai/conversations` : historique conversations

**Models** : `AIConversation`

---

#### Sub-module 6.2 — Insights (Section 2)

**Objectif** : Insights AI auto-générés sur le pipeline + base contacts (deals à risque, opportunités, contacts dormants à relancer).

**Composant** : `InsightsSection.tsx`

**Features** :
- Liste des insights actifs avec : title, summary, severity (critical/high/medium/low), category
- **Run Analysis** button : déclenche une analyse fraîche
- **Dismiss** : marquer un insight comme traité (`dismissed: true`)
- **Create Task from Insight** : génère un `Task` lié (préfixe `[AI]`) avec priority dérivée de severity, met à jour `actionTaken` sur l'insight
- Loading state pendant l'analyse

**Routes API** :
- `GET /api/ai/insights` : liste
- `POST /api/ai/auto-insights` : déclenche analyse Claude (génère nouveaux insights)
- `PATCH /api/ai/insights/[id]` : update (dismiss, actionTaken, linkedTaskId)
- `POST /api/tasks` : créer task depuis insight

**Models** : `AIInsight`, `Task` (lien)

---

#### Sub-module 6.3 — Meeting Briefs (Section 3)

**Objectif** : Génération AI de briefs préparatoires avant chaque meeting Calendar — contexte client, deal status, talking points.

**Composant** : `BriefsSection.tsx` (+ `BriefModal.tsx`)

**Features** :
- Liste des briefs générés (history) + meetings à venir sans brief (Calendar)
- **Generate Brief** sur un event : POST `/api/ai/brief` avec eventId, title, meetingDate, attendees
- **View Brief** : ouvre `BriefModal` avec brief complet
- **Prepare Call Notes** : ouvre `CallNotesModal` (component de `/calendar`) — génère un fichier HTML autonome avec tout le design system embedded (utilise Anthropic Claude pour génération HTML)
- **Team View toggle** (admin only) : affiche briefs/events de toute l'équipe, pas juste user courant
- État loading par brief (`generatingBriefId`)

**Routes API** :
- `GET /api/ai/briefs?teamView=...` : liste
- `POST /api/ai/brief` : générer brief pour un event
- `GET /api/ai/briefs/[id]` : détail brief
- `POST /api/call-notes/generate` : générer call note HTML
- `GET /api/call-notes` + `/api/call-notes/[id]` + `/api/call-notes/[id]/data` : CRUD call notes
- `GET /api/calendar/events?upcoming=true` : alimente liste events à briefer

**Models** : `MeetingBrief`, `CallNote`

---

#### Daily Digest (transverse, sur la page Sentinel)

**Objectif** : Synthèse quotidienne en 1 paragraphe — état pipeline + activité récente + alertes — affichable en banner.

**Features** :
- Bouton "Daily Digest" en header de Sentinel
- POST `/api/ai/digest` → renvoie un paragraphe Claude
- Affiché en banner gradient rose-gold avec close button
- Format whitespace-pre-wrap pour préserver la mise en page Claude

**Route API** : `POST /api/ai/digest`

---

#### Intel Highlights (panneau latéral)

**Objectif** : Top 5 résultats récents du module Intel (top-level) directement dans Sentinel — relays of pertinent intelligence.

**Features** :
- Charge les 5 derniers résultats Intel marqués `relevance: critical | high`
- Catégories iconisées : marketing 🎯, ai_tools 🤖, competitors ⚔️, regulations 📜, conferences 🎪, oxen 🏛, finance 💰
- Chaque card affiche : category badge, relevance badge (si critical/high), title, summary (clamp 2 lignes)
- Lien "View in Intel →" vers `/intel`

**Route API** : `GET /api/intel/results/feed?limit=5`

**Note** : Ce panneau crée un pont entre Sentinel et le module Intel top-level (différent de Marketing > Veille).

---

#### Cross-module surface (où Sentinel apparaît ailleurs)

Sentinel n'existe pas qu'à `/ai` — il alimente plusieurs autres modules :

- **Dashboard** : insights cards via `sentinel_insight` activity type
- **CRM Deals** : deal health AI (`/api/crm/ai/deal-health/[dealId]`)
- **CRM Contacts** : lead scoring + summary inline
- **CRM Inbox** : follow-ups suggestions (`/api/crm/ai/followups`)
- **Marketing Compliance Check** : analyse de conformité du contenu via Claude
- **Marketing SEO/GEO** : génération keywords + articles
- **CallNotes** : génération HTML autonome post-meeting

#### Intégrations externes du module Sentinel

- **Anthropic Claude API** (intensivement) : `@anthropic-ai/sdk`, model `claude-sonnet-4-20250514`
- Prompts centralisés dans `src/lib/claude.ts`
- **Google Calendar** : alimente la liste des events pour Briefs

#### Workflow type — Préparer un meeting client

1. User arrive sur `/ai` (ou directement depuis `/crm/contacts/[id]` avec deep-link)
2. Section Briefs montre le meeting du jour (depuis Google Calendar via sync-worker)
3. Click "Generate Brief" → POST `/api/ai/brief` → Claude analyse contexte deal + activities récentes + intent signals
4. `MeetingBrief` créé en DB → apparaît dans la liste
5. Click "View Brief" → `BriefModal` affiche talking points formatés
6. Optionnel : "Prepare Call Notes" → ouvre `CallNotesModal` → génère un template HTML autonome stylé Oxen design system
7. Post-meeting : retour sur `/calendar/[id]` (page CallNote détail) pour renseigner notes
8. Refresh : Sentinel learns de la conversation pour insights futurs

#### Backlog identifié pour Sentinel

- ⚠️ **Rate limiting absent** sur les routes AI (Sprint 4 prévu — protection contre abuse / coût Anthropic)
- ⚠️ Pas de cache des prompts Claude (chaque insight = call API fraîche, coûteux)
- ⚠️ Daily Digest : pas de scheduled job pour envoi auto matinal (Telegram bot existe mais pas wired ici directement)
- ⚠️ Conversations `AIConversation` : pas d'export, pas de search dans l'historique
- ⚠️ Action Blocks : `action-json` rendering dans `ChatSection.tsx` — vocabulaire d'actions documenté dans le code mais pas en doc utilisateur
- ⚠️ **Cost monitoring Anthropic absent** — pas de tracking du coût par feature (insight / brief / digest / score-lead / etc.). Sprint 4 (rate limiting) résout le risque budget mais pas la visibilité granulaire. Pas de dashboard "Anthropic spend by feature" — pas d'alerte sur dépassement budget mensuel.
- 🟡 Pas de TODO visible dans le code

---

### 7. Calendar

**Objectif** : Calendrier d'équipe unifié — synchronisation bidirectionnelle Google Calendar, événements internes, absences agrégées, et préparation/archivage des call notes par meeting.

**Audience principale** : Tous

**Statut global** : ✅ Mature

**URL principale** : `/calendar`

**Pages** : `/calendar` (vue agenda) + `/calendar/[id]` (détail call note avec iframe HTML)

**Sub-modules** : 0 (page unique avec 3 view modes)

#### Vue d'ensemble

Le module Calendar consolide en une seule vue tous les meetings de l'équipe Oxen — événements Google Calendar (par owner), événements internes créés in-app (model `InternalEvent`), et absences (`LeaveRequest` approuvées, en filigrane). Pas de sub-nav officielle — le navigation entre `week / day / month` est un toggle de viewport (`viewMode`), pas un sub-module distinct.

#### View modes (3)

- **Week** (default) : grille hebdomadaire 7 jours avec slots horaires
- **Day** : agenda détaillé d'une journée
- **Month** : grille calendaire avec events compacts par cellule, click → drill-down vers Day

**Navigation** : flèches `<` `>` (navigateDate) avec pas adapté au viewMode (±1 jour / ±7 jours / ±1 mois) + bouton "Today".

#### Features

- **Multi-owner display** : événements de tous les members de l'équipe (récupérés via `/api/calendar/owners`), filtrables individuellement
- **Color-coding par owner** : palette de 8 couleurs (`TEAM_COLORS`) cyclées
- **Absences en filigrane** : `LeaveRequest` (status approved) affichées en arrière-plan pour visualiser qui est en off
- **Sync Google Calendar** : bouton "Sync All" → `POST /api/calendar/sync-all` → polled par sync-worker pour pull events des comptes Google de l'équipe
- **Création d'événement interne** via `EventModal` (mode `create`) : différent des events Google Calendar — stocké en `InternalEvent`
- **Edit/View event** : `EventModal` mode `edit` (interne) ou `view` (read-only pour Google Calendar event)
- **Source distinction** : `event.source === "internal"` détermine si on peut éditer (interne) ou juste view (Google)

#### Call Notes (feature transverse, accessible depuis Calendar)

- **Liste call notes** : panel à droite avec recherche (`searchCallNotes`)
- **Upload HTML** : input file → POST `/api/call-notes` avec htmlContent
- **Prepare modal** : `CallNotesModal` génère un template HTML autonome via Claude (cf. Sentinel, sub-module 6.3)
- **Page détail** : `/calendar/[id]` charge le HTML dans une `iframe` avec data save-back (model `CallNote.noteData`)

#### Routes API

- `GET /api/events?start=...&end=...&owners=...` : events filtrés par range + owners (consolidé Google + internal)
- `POST /api/events` : créer event interne
- `GET/PATCH/DELETE /api/events/[id]` : CRUD event interne
- `GET /api/calendar/events?upcoming=true&teamView=true` : events à venir (utilisé par Sentinel Briefs)
- `GET /api/calendar/owners` : liste des members de l'équipe avec calendrier connecté
- `POST /api/calendar/sync` : sync user courant
- `POST /api/calendar/sync-all` : sync tous les owners (admin)
- `GET/POST /api/call-notes` : liste / créer call note
- `GET/PATCH/DELETE /api/call-notes/[id]` : CRUD call note
- `PATCH /api/call-notes/[id]/data` : update savedData (état du formulaire dans l'iframe)
- `POST /api/call-notes/generate` : génération HTML via Claude

#### Models Prisma

- `CalendarEvent` (events Google Calendar synced)
- `InternalEvent` (events créés in-app)
- `CallNote` (notes liées à un event ou standalone)

#### Intégrations externes

- **Google Calendar** (via `googleapis` + sync-worker) : pull events des comptes Google des members, polling périodique
- **Anthropic Claude** : génération template HTML call note (cf. Sentinel)

#### Workflow type — Préparer + capturer un meeting

1. User voit son meeting du jour sur `/calendar` (viewMode `day` ou `week`)
2. Click sur un event → `EventModal` affiche les détails (attendees, meet link, description)
3. Avant le meeting : click "Prepare Call Notes" → ouvre `CallNotesModal`
4. Claude génère un fichier HTML autonome stylé Oxen (template structuré : agenda, attendees, talking points, action items)
5. Pendant le meeting : user remplit le HTML directement (form intégré)
6. État sauvegardé via `/api/call-notes/[id]/data` (auto-save)
7. Post-meeting : retour sur `/calendar/[id]` pour consultation/édition de la note

#### Backlog identifié pour Calendar

- ⚠️ Pas de drag-and-drop pour reschedule events (uniquement edit via modal)
- ⚠️ Recurring events Google : sync OK mais création récurrente in-app pas évidente
- ⚠️ Conflits de meetings (deux events overlap) pas highlightés visuellement
- ⚠️ Permissions calendrier Google : si user révoque le scope `calendar`, l'app ne le détecte pas proactivement
- 🟡 Pas de TODO visible dans le code

---

### 8. Tasks

**Objectif** : Gestion des tâches d'équipe en Kanban — vue personnelle, vue globale, et vue dédiée au Customer Support avec colonne supplémentaire "Waiting Client".

**Audience principale** : Tous

**Statut global** : ⚠️ Stable mais limité (3 sub-modules fonctionnels, mais **dette technique 2 namespaces** — voir section dédiée plus bas)

**URL principale** : `/tasks`

**Pages** : `/tasks` (1390 lignes, riche)

**Sub-modules** : 3 (sélection via `ViewMode` toggle, pas de URL distincte)

#### Vue d'ensemble

Tasks est un Kanban classique avec drag & drop entre colonnes, mais avec une vue spécialisée "Customer Support" qui ajoute une 4ème colonne "Waiting Client" et linke chaque task à un `SupportTicket` ou un `CrmContact`. Les 3 vues partagent le même corpus de tasks mais filtrent différemment.

**Tags système (7)** : `compliance`, `onboarding`, `tech`, `sales`, `legal`, `finance`, `support` — chacun avec couleur dédiée.

**Priorités (3)** : `high` (rouge), `medium` (amber), `low` (gris). Sort interne par `PRIORITY_ORDER`.

**Indicators temporels** : `isOverdue`, `isDueToday`, `isDueThisWeek` — badges + colors différenciés. Badge "OVERDUE" en rouge sur les tasks dépassées.

**Indicator off** : si l'assignee est en leave (cf. Absences), badge ⚠ amber affiché à côté du nom.

---

#### Sub-module 8.1 — My Tasks (`viewMode: "my"`)

**Objectif** : Vue personnelle des tasks dont l'user courant est assignee.

**Features** :
- Filtre auto sur `assignee = currentUser.name`
- Kanban 3 colonnes : To Do (red), In Progress (amber), Done (green)
- Filter pills en haut : `["all", "compliance", "onboarding", "tech", "sales", "legal", "finance", "support"]`
- Tri intra-colonne : par priority desc puis deadline asc
- Click sur card → modal d'édition

---

#### Sub-module 8.2 — All Tasks (`viewMode: "all"`)

**Objectif** : Vue globale toutes équipes — toutes les tasks affichées avec assignee visible.

**Features** :
- Mêmes 3 colonnes que My Tasks (To Do / In Progress / Done)
- Mêmes filter pills par tag
- Affichage de l'assignee sur chaque card
- Sort identique
- Permet visibilité cross-team (qui fait quoi)

---

#### Sub-module 8.3 — Customer Support (`viewMode: "support"`)

**Objectif** : Vue dédiée aux tâches liées aux tickets Support — workflow spécifique avec étape "Waiting Client".

**Features** :
- **4 colonnes** au lieu de 3 : To Do, In Progress, **Waiting Client**, Done
- Tasks affichent le nom du client (depuis `supportTicket.clientName` ou `contact.name`) avec icône user en couleur teal
- Lien direct "→ View ticket" qui navigue vers `/support/{ticketId}`
- Création de task : champ `supportTicketId` ou `contactId` linké
- Stats Customer Support visibles ("Customer Support Tasks — N open")

#### Routes API

- `GET /api/tasks?view=...&assignee=...` : liste filtrée
- `POST /api/tasks` : créer
- `GET/PATCH/DELETE /api/tasks/[id]` : CRUD
- `GET /api/crm/tasks` : namespace alternatif (cf. dette technique)
- `POST /api/crm/tasks` + `GET/PATCH/DELETE /api/crm/tasks/[id]` : CRUD CRM-side

**Sources alimentées** :
- `/api/team` : liste des employees pour assignment
- `/api/contacts` (sub-routes) ou `/api/crm/contacts/search` : contacts pour `contactId` link
- `/api/support/tickets` : tickets pour `supportTicketId` link
- `/api/leaves/who-is-out` : alimente le badge "on leave" (à côté de assignee)

#### Models Prisma

- **`Task`** (model du module Tasks)
- **`CrmTask`** (model du module CRM)

#### ⚠️ Dette technique signalée

> **2 namespaces de tasks coexistent dans le code** :
>
> - **`Task` model** + routes `/api/tasks/*` (79 lignes pour la liste route) — utilisé par la page `/tasks`
> - **`CrmTask` model** + routes `/api/crm/tasks/*` (70 lignes pour la liste route) — utilisé par CRM pour les tasks liées aux deals/contacts
>
> Les deux modèles existent en parallèle dans `prisma/schema.prisma`. Sentinel (`/api/ai/insights` → "Create Task from Insight") POST vers `/api/tasks` (pas `/api/crm/tasks`).
>
> **Hypothèses possibles** :
> - Refactor en cours (un des deux était la cible, migration jamais finie)
> - Séparation volontaire (Task = global équipe, CrmTask = scope CRM strict)
> - Ou doublon involontaire à fusionner
>
> **Indice sur le canonique** : Sentinel ("Create Task from Insight" dans `InsightsSection`) fait un POST vers `/api/tasks` (model `Task`), pas `/api/crm/tasks`. C'est un signal que `Task` est probablement le namespace cible canonique — mais c'est une **hypothèse à valider avec Vernon**, pas une décision actée. Le refactor effectif (migration des données `CrmTask` → `Task`, suppression du namespace alternatif, mise à jour des consumers CRM) reste à faire.
>
> **À trancher dans un sprint futur de cleanup.** Risque si non traité : double-saisie, incohérence entre les deux vues, confusion dev/PM.

#### Intégrations externes

- **Aucune intégration externe directe** sur ce module
- Branchements internes : Sentinel (insights → tasks), Support (ticket → task), CRM (contact → task), Leaves (assignee on leave warning)

#### Workflow type — Tâche depuis un insight Sentinel

1. Sentinel détecte un insight critical (ex: "Deal X dormant depuis 30 jours")
2. User clique "Create Task" sur l'insight (cf. Sentinel sub-module 6.2)
3. POST `/api/tasks` avec title `[AI] {insight.title}`, priority dérivée de severity
4. Task apparaît dans `/tasks` viewMode `my` (column "To Do")
5. User drag-and-drop vers "In Progress" → PATCH update
6. Une fois fini, drag vers "Done" — task fermée

#### Backlog identifié pour Tasks

- 🔴 **Priorité haute — Dette technique 2 namespaces** (cf. ci-dessus)
- ⚠️ Pas de subtasks (checklist intra-task)
- ⚠️ Pas de dépendances entre tasks (blocked-by)
- ⚠️ Pas de notifications (push / email / Telegram) sur task assignée ou overdue
- ⚠️ Pas d'estimation de durée / time tracking
- ⚠️ Filtres par assignee absents en vue "all" (que par tag)
- 🟡 Pas de TODO visible dans le code

---

### 9. Intel

**Objectif** : Module de **veille AI-powered cross-domaine** — recherches automatiques (one-time ou récurrentes) déclenchées via Claude pour monitorer concurrents, régulations, AI tools, mentions Oxen, marketing trends, conférences pertinentes, et financial news.

**Audience principale** : Vernon + PM (lecture cross-équipe), Andy (lecture marketing/competitors)

**Statut global** : ✅ Mature

**URL principale** : `/intel`

**Pages** : `/intel` (2348 lignes — c'est l'une des pages les plus riches d'Oxen OS)

**Sub-modules** : 7 catégories (treated as sub-modules per décision Phase 0)

> ⚠️ **À ne pas confondre avec Marketing > Veille** : ce module Intel est **AI-powered** (Claude lance des recherches selon prompts pré-définis ou custom). Marketing > Veille (`MarketingIntel`) est une **capture manuelle** d'observations marketing.

#### Vue d'ensemble

Le user crée des "Researches" (sujets de veille) — soit `one_time` (run unique), soit `recurring` (daily / weekly / monthly avec scheduledDay + scheduledTime). Chaque Research est ensuite exécutée par Claude (via `Anthropic` SDK directement dans `/api/intel/cron` et `/api/intel/run/[id]`), qui produit des `Result` avec : title, summary, source URL, sentiment, relevance, actionable bool, metadata structurée.

**View modes** :
- **Mine** (default pour members) : researches créés par l'user courant
- **All** (admin only) : toutes researches de l'équipe

**Filtres results** : `all` / `critical` / `high` / `actionable` / `starred` / `unread`
**Sort results** : `relevance` / `newest` / `sentiment`

**Actions par result** : starred toggle, dismissed toggle, read marker, expand pour voir summary complet, accept/reject (pour conferences détectées), context menu, bulk select avec actions groupées

**Surface cross-module** : les top 5 results `relevance: critical | high` apparaissent aussi dans Sentinel (panneau "Intel Highlights").

---

#### Sub-module 9.1 — Marketing Intel (`category: marketing`)

**Objectif** : Veille marketing — tendances social media, intel concurrentielle, suggestions de repost, idées de contenu.

**Subcategories (4)** :
- `social_trends` : "Latest social media trends in fintech, payments, digital banking..."
- `competitive_intel` : "Marketing analysis of Mercury, Wise Business, Payoneer, Revolut Business, Relay"
- `repost_suggestions` : "Recent LinkedIn posts to repost or comment on"
- `content_ideas` : "10 content ideas for Oxen Finance social media"

Chaque subcategory a un **prompt pré-rempli** dans le code (`PREFILLED_QUERIES` constant) — l'user peut éditer avant de lancer.

---

#### Sub-module 9.2 — AI Tools (`category: ai_tools`)

**Objectif** : Veille sur l'écosystème AI — outils trending, repos GitHub stars, news AI.

**Subcategories (4)** :
- `trending_tools` : "10 most trending AI tools this week (Twitter, Reddit, ProductHunt) for fintech ops"
- `github_repos` : "10 most starred GitHub repos in LLM apps, fintech tooling, payment processing"
- `google_search` : "Latest AI tools and fintech innovations on Google"
- `news_scraping` : "Latest AI news for fintech: model releases, AI regulation, AI startups in finance"

---

#### Sub-module 9.3 — Competitors (`category: competitors`)

**Objectif** : Surveillance directe de la concurrence — news business, changements site, reviews.

**Subcategories (3)** :
- `business_news` : "Recent news about Mercury, Wise Business, Payoneer, Revolut Business, Relay (licenses, features, fines, hiring)"
- `website_changes` : "Recent changes on competitor websites (new pages, pricing, features)"
- `reviews` : "Recent reviews on Trustpilot, G2, Reddit — common complaints + opportunities"

---

#### Sub-module 9.4 — Regulations (`category: regulations`)

**Objectif** : Veille réglementaire continue (critique pour fintech VQF) — UE, UK, UAE, Malta, Switzerland, Luxembourg.

**Subcategories (4)** :
- `new_regulation` : "New regulations enacted past 3 months: MiCA, PSD3, DORA, FCA, CBUAE, VARA, MFSA, FINMA, CSSF — focus payment services, crypto/VASP, banking, AML/KYC"
- `regulation_change` : "Amendments to existing regulations affecting payment / VASP / banking in EU, UK, UAE, Malta, Switzerland, Luxembourg"
- `regulation_removal` : "Regulations being relaxed/removed/simplified in EU, UK, Malta, Cyprus, UAE — opportunities"
- `regulation_news` : "News and commentary about upcoming regulatory changes in financial services, payments, crypto"

---

#### Sub-module 9.5 — Conferences (`category: conferences`)

**Objectif** : Détection automatique des conférences pertinentes pour Oxen.

**Subcategory (1)** :
- `relevant_conferences` : "Upcoming fintech, payments, iGaming, crypto, banking conferences in next 6 months — name, location, dates, topics, ticket price, speakers, why Oxen should attend. Focus Europe, UAE, Malta, Cyprus, UK. Include SiGMA, Money20/20, Paris Fintech Forum"

**Surface particulière** : les results de cette catégorie peuvent être **acceptés** via `POST /api/intel/conferences/[resultId]/accept` → crée automatiquement un `Conference` dans le module Conferences (top-level), ou **rejetés** via `POST /api/intel/conferences/[resultId]/reject`.

---

#### Sub-module 9.6 — Oxen Mentions (`category: oxen`)

**Objectif** : Self-monitoring — mentions Oxen / Escrowfy / Lapki / Galaktika dans la presse, social, reviews.

**Subcategories (3)** :
- `news_mentions` : "News articles, blog posts, press mentions of Oxen Finance, Escrowfy, Lapki Digital Pay, Galaktika Pay"
- `social_mentions` : "Social media posts mentioning Oxen / Escrowfy on LinkedIn, Twitter/X, Reddit"
- `reviews_oxen` : "Reviews of Oxen Finance, Escrowfy on Trustpilot, G2, Reddit — categorized positive/negative/neutral"

---

#### Sub-module 9.7 — Financial News (`category: finance`)

**Objectif** : Tendances macro fintech / crypto / payments + tracking fundraisings.

**Subcategories (2)** :
- `financial_news` : "Most important financial news past week — fintech, digital banking, crypto, payments, cross-border. Focus on news affecting Oxen client sectors (iGaming, crypto, family offices, luxury)"
- `fundraisings` : "Recent fundraising rounds (past 30 days) in fintech / payments / crypto / digital banking — company, round size, stage, investors, relevance to Oxen"

---

#### Création d'une Research

Form fields (très riche) :
- title, category (7 valeurs), subcategory (variable selon category)
- query (prompt — pré-rempli mais éditable)
- type : `one_time` | `recurring`
- frequency (si recurring) : `daily` | `weekly` | `monthly`
- scheduledDay (jour de la semaine si weekly)
- scheduledTime (HH:MM, default `09:00`)
- sources (multi-select)
- keywords (multi-tag input)
- companies (multi-tag input — pour scoping)
- regions (default : `europe`, `uae`, `uk`, `malta`, `cyprus`)
- language (default : `english`)

Status d'une Research : `active` / `archived`. Compteurs : `resultCount`, `unreadCount`.

#### Sources reconnues (icons)

`SOURCE_ICONS` mapping : linkedin (Linkedin icon), twitter (𝕏), reddit (🔴), github (Github), google (Globe), news (Newspaper), website (Globe), review_site (Star), regulatory (FileText), conference_site (Calendar).

#### Routes API

- `GET /api/intel/researches?category=...&showArchived=...` : liste researches
- `POST /api/intel/researches` : créer
- `GET/PATCH/DELETE /api/intel/researches/[id]` : CRUD (PATCH pour archive, status, reschedule)
- `POST /api/intel/run/[id]` : déclencher un run **manuel** d'une research (utilise `Anthropic` directement)
- `GET /api/intel/cron` : endpoint cron qui détecte les researches `nextRunAt < now` et les exécute (utilise `computeNextRunAt`)
- `GET /api/intel/results?researchId=...&filter=...&sort=...` : results d'une research
- `GET /api/intel/results/feed?limit=N&category=...&filter=...&sort=...` : feed cross-research (utilisé par Sentinel)
- `GET/PATCH/DELETE /api/intel/results/[id]` : CRUD result (PATCH pour starred, dismissed, read)
- `POST /api/intel/conferences/[resultId]/accept` : accepter un result conference → crée `Conference`
- `POST /api/intel/conferences/[resultId]/reject` : rejeter

#### Models Prisma

- `IntelResearch` : sujet de veille (recurring ou one_time)
- `IntelResult` : résultat individuel d'un run (avec metadata flexible JSON)

#### Intégrations externes

- **Anthropic Claude API** (intensivement, **directement dans les routes**) : `Anthropic` SDK importé dans `/api/intel/cron/route.ts` et `/api/intel/run/[id]/route.ts`. Pas via job queue — exécution synchrone.
- Sources externes consultées par Claude : LinkedIn, Twitter, Reddit, GitHub, news sites, regulatory sites, review platforms (Claude utilise ses propres outils web pour scraper)

#### Workflow type — Veille concurrentielle hebdomadaire

1. Vernon arrive sur `/intel`, sélectionne category `competitors`
2. Click "+ New Research" → modal de création
3. Choisit subcategory `business_news`, prompt pré-rempli s'affiche
4. Type `recurring`, frequency `weekly`, scheduledDay `monday`, scheduledTime `09:00`
5. POST `/api/intel/researches` → crée IntelResearch, calcule `nextRunAt`
6. Lundi matin 09:00 : `GET /api/intel/cron` (déclenché par cron Railway) trouve la research, exécute Claude
7. Claude renvoie 5-10 results structurés → DB `IntelResult`
8. Lundi matin : Vernon ouvre Sentinel, voit les top 5 dans "Intel Highlights"
9. Pour les results actionable, click → ouvre dans `/intel`, lit summary, peut star ou dismiss
10. Si un result mentionne une conférence → "Accept" → crée un `Conference` dans le module Conferences

#### Backlog identifié pour Intel

- ⚠️ **Pas de rate limiting** sur `/api/intel/run/[id]` — un user pourrait déclencher 100 runs en boucle (coût Anthropic)
- ⚠️ Pas de **cap budget** Anthropic par user/mois (cf. backlog Sentinel "Cost monitoring absent")
- ⚠️ **Cron Railway** : le mécanisme exact qui appelle `/api/intel/cron` à intervalles réguliers n'est pas documenté côté code — à clarifier (Railway cron job ? Worker polling ?)
- ⚠️ Conférences `accept`/`reject` : pas de feedback loop pour améliorer la pertinence future (Claude ne sait pas si la suggestion était bonne)
- ⚠️ Pas d'export PDF/CSV des results pour partage hors-app
- ⚠️ Régions hardcodées (5 valeurs default) — pas extensible UI
- ⚠️ Sources affichées (icons) limitées à 10 — si Claude renvoie une source autre, fallback générique
- 🟡 **Prompts pré-remplis mentionnent "Galaktika Pay"** (cf. `news_mentions` subcategory) qui n'est pas une entité actuelle du groupe. À auditer avec les autres références `Galaktika` dans le code (cf. backlog Finance — entité `galaktika` toujours hardcodée dans `src/components/finance/constants.ts`). Probablement un legacy de la phase de naming initiale, à mettre à jour avec la liste réelle (Escrowfy GmbH, Escrowfy Ltd, Neural ID Pay, Arventis Labs, Green Nation SARL, Lapki Digital Pay).
- 🟡 Pas de TODO visible dans le code

---

### 10. Conferences

**Objectif** : Gestion complète des conférences professionnelles fréquentées par Oxen — calendrier visuel, attendees multi-employés, tracking ROI (coûts vs contacts collectés), rapports post-event publiables dans Wiki, et bridge avec le module Intel pour découverte automatique de conférences pertinentes.

**Audience principale** : Andy (event sales) + Vernon (stratégie + ROI)

**Statut global** : ✅ Mature

**URL principale** : `/conferences`

**Pages** : `/conferences` (vue principale, 1426 lignes) + `/conferences/[id]` (détail conférence)

**Sub-modules** : 3 (Calendar / Intel / Reports)

#### Vue d'ensemble

Le module Conferences trace tout le cycle de vie d'un événement : découverte (via Intel), planification (dates, attendees, budget), exécution (contacts collectés on-site), et post-event (rapport structuré + ROI calculé + publication Wiki). Les conférences ont un système de couleurs visuel (palette de 8 couleurs cycliques `CONF_COLORS`) pour distinguer les events sur la vue calendrier.

**Roles attendees** : `Speaker`, `Attendee`, `Booth`, `Networking` (`ATTENDEE_ROLES` constant)

---

#### Sub-module 10.1 — Calendar (tab `calendar`)

**Objectif** : Vue agenda des conférences passées et à venir avec navigation multi-échelle.

**Features** :
- **4 view modes** : `day` / `week` / `month` (default) / `year`
- Création conférence via "+ New Conference" → modal avec champs : `name`, `location`, `country`, `startDate`, `endDate`, `website`, `description`, `color` (palette 8), `status`, `source`
- **Auto-fill par URL** : input URL → `POST /api/conferences/auto-fill` → Claude scrape la page (fetch HTML directe avec User-Agent custom) et pré-remplit name, dates, location, description
- Navigation : flèches `<` `>` adaptées au view mode (jour / semaine / mois / année)
- Conférences positionnées sur la grille avec span multi-jours
- Click sur conf → ouvre `/conferences/[id]` (page détail)

**Données affichées par card calendrier** :
- Name + location
- Date range formatée (ex: `Mar 12 – Mar 14, 2026` via `formatDateRange`)
- Couleur custom ou cyclique (8 couleurs CONF_COLORS)
- Indicateurs : count attendees, count contacts collectés (via `_count.collectedContacts`)

**Routes API** :
- `GET/POST /api/conferences` : liste + création
- `GET/PATCH/DELETE /api/conferences/[id]` : CRUD
- `POST /api/conferences/auto-fill` : auto-fill via Claude (utilise `Anthropic` SDK + fetch HTML directe)
- `POST /api/conferences/check-overdue` : marque les conférences passées sans rapport

**Models** : `Conference`

---

#### Sub-module 10.2 — Intel (tab `intel`)

**Objectif** : Liste des suggestions de conférences détectées par le module **Intel top-level** (catégorie `conferences`). Gateway pour transformer une suggestion en `Conference` réelle.

**Features** :
- Liste des `IntelResult` filtrés sur `category: conferences` non-acceptés/rejetés
- Pour chaque suggestion affichée : title, summary, source URL, relevance, createdAt
- **Accept** → bouton transforme l'IntelResult en `Conference` (`POST /api/conferences/from-intel/[intelResultId]`) puis ouvre la modal d'édition pré-remplie
- **Reject** → marque l'IntelResult comme dismissed (`POST /api/intel/conferences/[resultId]/reject`)
- **Bridge bidirectionnel Intel↔Conferences** : si Intel détecte 5 conférences → 5 cards ici, l'user peut accepter sélectivement

**Routes API** :
- `GET /api/intel/results?category=conferences` : alimente la liste
- `POST /api/conferences/from-intel/[intelResultId]` : crée une `Conference` depuis un `IntelResult`
- `POST /api/intel/conferences/[resultId]/accept` : marque accepted
- `POST /api/intel/conferences/[resultId]/reject` : marque rejected

**Models** : `IntelResult` (lecture) + `Conference` (création)

---

#### Sub-module 10.3 — Reports (tab `reports`)

**Objectif** : Rapports post-conférence structurés avec ROI quantitatif et publication automatique dans Wiki.

**Features** :
- Liste des conférences passées avec status du rapport : `pending` / `submitted` / `approved` / `archived`
- **Génération de rapport** : modal avec champs structurés :
  - `summary` (text)
  - `keyTakeaways` (array)
  - `marketInsights` (text)
  - `competitorSightings` (text)
  - `opportunities` (text)
  - `recommendations` (text)
  - `rating` (1-5)
- **Auto-publication Wiki** : à la soumission du rapport, conversion en TipTap doc structuré et publication comme `WikiPage` (avec slug auto-généré via `generateSlug`)
- **Notification Telegram** : `sendTelegramNotification` envoie un brief à l'équipe quand un rapport est soumis

**ROI calculator (`/api/conferences/[id]/roi`)** :
- **Costs** : aggregation des `ticketCost`, `hotelCost`, `flightCost`, `taxiCost`, `mealsCost`, `otherCost` sur tous les attendees (`Decimal(19,4)` via `serializeMoney` + `sumDecimals`)
- **Contacts collectés** : count + valeur potentielle pipeline (via `collectedContacts` relation)
- **ROI ratio** calculé

**Routes API** :
- `GET/POST /api/conferences/[id]/report` : récupérer / créer rapport (publie aussi en Wiki)
- `GET /api/conferences/[id]/roi` : calcul ROI structuré

**Models** : `ConferenceReport`, `WikiPage` (création cross-module), `Conference`

---

#### Attendees & Contacts collectés (transverse au module)

**Attendees** — qui de l'équipe Oxen va à la conférence :
- `GET/POST /api/conferences/[id]/attendees` + `/[attendeeId]` : CRUD
- Champs : `employeeId`, `role` (Speaker / Attendee / Booth / Networking), 6 cost fields (ticket, hotel, flight, taxi, meals, other)
- **Models** : `ConferenceAttendee`

**Contacts collectés** — leads rencontrés sur place :
- `GET/POST /api/conferences/[id]/contacts` + `/[contactId]` : CRUD
- `POST /api/conferences/[id]/contacts/[contactId]/push-crm` : push individuel vers CRM (crée `CrmContact`)
- `POST /api/conferences/[id]/contacts/push-all` : push bulk
- **Models** : `ConferenceContact` → `CrmContact` (lien)

#### Intégrations externes

- **Anthropic Claude** : auto-fill par URL (scraping + extraction structurée)
- **Telegram bot** : notifications quand rapport soumis (`sendTelegramNotification`)
- **Wiki module** : publication automatique du rapport comme `WikiPage`

#### Workflow type — Découvrir → exécuter → rapporter une conférence

1. Module Intel `category: conferences` détecte SiGMA Malta 2026 via Claude (cron weekly)
2. Vernon ouvre `/conferences` → tab Intel → voit la suggestion
3. Click "Accept" → `POST /api/conferences/from-intel/[intelResultId]` crée `Conference` + ouvre modal pré-remplie
4. Vernon édite : ajoute attendees (Andy + lui-même, role Booth + Networking), ajoute coûts estimés (6 fields)
5. Conférence apparaît sur tab Calendar (vue month) avec couleur dédiée
6. Pendant l'event : Andy ajoute contacts collectés via `/conferences/[id]` → bouton "Add Contact"
7. Post-event : Andy clique "Push to CRM" → contacts deviennent `CrmContact` lifecycle `new_lead`
8. Andy soumet rapport tab Reports → champs structurés (summary, keyTakeaways, etc.)
9. `POST /api/conferences/[id]/report` → rapport publié en Wiki (`buildWikiContent` génère TipTap structure) + Telegram brief envoyé à l'équipe
10. ROI visible : coûts totaux vs contacts pushed CRM vs deals générés (calculé via `/api/conferences/[id]/roi`)

#### Backlog identifié pour Conferences

- ⚠️ **Multi-currency** : 6 cost fields stockés mais pas de conversion (assume EUR ou stocke devise unique par event via `Conference.currency`)
- ⚠️ **Pas de tracking d'attribution** : un deal généré 6 mois après une conférence n'est pas automatiquement crédité au ROI de cette conférence (pas de chaînage `Deal.sourceConferenceId`)
- ⚠️ **Auto-fill Claude pas de cache** : un même URL re-scrapé 5 fois = 5 calls Claude (coût)
- ⚠️ **Pas d'export iCal** des conférences (synchronisation calendrier perso impossible)
- ⚠️ **Feedback loop** : pas de retour vers Intel "cette conférence était pertinente" pour améliorer les suggestions futures
- 🟡 Pas de TODO visible dans le code

---

### 11. Support

**Objectif** : Helpdesk multi-canal pour le support clients Oxen — tickets centralisés (Telegram, email, WhatsApp, phone, live chat), workflow de résolution, et reporting de SLA / response times.

**Audience principale** : Vernon + équipe Customer Support

**Statut global** : ⚠️ Stable mais limité

**URL principale** : `/support`

**Pages** : `/support` (vue principale) + `/support/[id]` (détail ticket avec messages)

**Sub-modules** : 3 (Overview / Tickets / Reports)

#### Vue d'ensemble

Module helpdesk classique avec workflow `open → in_progress → resolved/closed` et étape spéciale `waiting_client`. Pas d'intégration native chat live (pas de widget embarquable côté `oxen.finance`), mais réception de tickets via webhook formulaire site (`/api/support/webhooks/website-form`).

**5 canaux supportés** (`CHANNELS` constant) :
- `telegram` (✈, color #26A5E4)
- `email` (✉, color #818CF8 indigo)
- `whatsapp` (💬, color #25D366)
- `phone` (📞, color amber)
- `live_chat` (💭, color cyan)

**5 statuses** (`STATUSES` constant) :
- `open` (blue)
- `in_progress` (amber)
- `waiting_client` (purple)
- `resolved` (green)
- `closed` (gris)

**4 priorités** : `urgent`, `high`, `medium`, `low` (avec `PRIORITY_ORDER` pour sort)

#### Subtitle dynamique

Header affiche `{N} open · Avg response {duration}` (formaté via `fmtDuration` style `2h 15m` / `45m`).

---

#### Sub-module 11.1 — Overview (tab `overview`)

**Objectif** : Tableau de bord des KPIs Support avec breakdown par canal et tendances 30 jours.

**Composant** : `OverviewTab.tsx`

**Features** :
- **KPIs** (Bellfair counters) : Open count, Resolved this period, Avg Response Time, Avg Resolution Time
- Charts (Recharts) :
  - **BarChart** par canal (volume tickets reçus)
  - **LineChart** : tendance daily (30 jours)
  - **PieChart** : répartition par status courant
- **Sparkline** mini-charts pour tendances rapides

**Routes API** :
- `GET /api/support/stats` : KPIs résumé
- `GET /api/support/stats/daily?days=30` : tendance 30 jours

**Models lus** : `SupportTicket` (agrégation)

---

#### Sub-module 11.2 — Tickets (tab `tickets`)

**Objectif** : Liste opérationnelle des tickets — triable, filtrable, click pour ouvrir le détail.

**Composant** : `TicketsTab.tsx`

**Features** :
- Tableau avec colonnes : `subject`, `clientName`, `status`, `priority`, `channel`, `category`, `assignedTo`, `createdAt`, `updatedAt`
- **Sort** sur 6 clés : `createdAt`, `updatedAt`, `priority`, `status`, `subject`, `clientName`
- **Filtres** : status, priority, channel, category, assignedTo (agent)
- Liste agents distincts calculée depuis tickets
- Click row → navigate `/support/[id]`
- **Création via modal `TicketModal`** : subject, clientName, clientEmail, channel, category, priority, description, assignedTo

**Page détail `/support/[id]`** :
- Conversation thread complète (messages chronologiques)
- Update status / priority / assignedTo inline
- Add message (response interne) via `POST /api/support/tickets/[id]/messages`

**Routes API** :
- `GET /api/support/tickets` : liste
- `POST /api/support/tickets` : créer
- `GET/PATCH/DELETE /api/support/tickets/[id]` : CRUD
- `GET/POST /api/support/tickets/[id]/messages` : messages thread
- `POST /api/support/webhooks/website-form` : webhook entrant depuis formulaire site

**Models** : `SupportTicket`, `SupportMessage`

---

#### Sub-module 11.3 — Reports (tab `reports`)

**Objectif** : Reporting analytique — performance par agent, SLA compliance, breakdown par période custom.

**Composant** : `ReportsTab.tsx`

**Features** :
- **Range presets** : `7` / `30` / `90` jours / `custom`
- Charts (Recharts) :
  - **LineChart** : tickets ouverts vs résolus dans le temps
  - **BarChart** : par catégorie
  - **BarChart** : par agent (volume + avg resolution time)
- **Counter** Bellfair animés pour KPIs récap

#### Auto-routing & support-auto

Helper `src/lib/support-auto.ts` (référencé) — probablement logique de :
- Auto-assignment de l'agent selon catégorie
- Auto-classification des channels entrants
- Templates de réponses standards

#### Liens cross-module

- **Tasks > Customer Support sub-module** : tasks linkées via `task.supportTicketId`
- **Webhook entrant** : `/api/support/webhooks/website-form`
- **Telegram bot** (probable) : tickets via Telegram

#### Intégrations externes

- **Webhook formulaire site** : `oxen.finance` formulaires support → POST `/api/support/webhooks/website-form` → crée `SupportTicket`
- **Telegram** (à confirmer wiring complet) : channel `telegram` suggère réception via bot

#### Workflow type — Ticket entrant via formulaire site

1. Visiteur soumet formulaire support sur `oxen.finance`
2. POST `/api/support/webhooks/website-form` (avec X-Webhook-Secret) → crée `SupportTicket` status `open`, channel `email`
3. Auto-routing (via `support-auto.ts`) assigne un agent selon catégorie
4. Agent ouvre `/support/[id]` → lit le contenu, change status à `in_progress`
5. Réponse via `POST /api/support/tickets/[id]/messages`
6. Si attente client : status `waiting_client`
7. Résolution : status `resolved`, `closed` après 7 jours (via cron ?)
8. Stats Reports tab mise à jour automatiquement

#### Backlog identifié pour Support

- ⚠️ **Surface UI compacte** : 1 page avec 3 tabs pour 6 routes — fonctionnel mais minimal
- ⚠️ **Pas d'intégration native chat widget** côté `oxen.finance` — le canal `live_chat` est listé mais pas branché à un client externe (Intercom, Crisp, etc.)
- ⚠️ **Pas de templates de réponses** (canned responses)
- ⚠️ **Pas de SLA configurable** par priorité avec alertes auto
- ⚠️ **Pas de CSAT survey** post-resolution
- ⚠️ **Email send sortant** : pas évident si l'app envoie des emails de réponse au client
- ⚠️ **`support-auto.ts`** non auditée — logique d'auto-routing à documenter
- 🟡 Pas de TODO visible dans le code

---

### 12. Settings

**Objectif** : Module "carrefour" admin pour la gestion des roles & permissions de l'équipe et préférences générales — point d'entrée critique pour la gouvernance d'Oxen OS.

**Audience principale** : Vernon (super_admin) + autres admins

**Statut global** : ⚠️ Stable mais limité (2 sub-modules basiques, mais fonctionnels)

**URL principale** : `/settings`

**Contrôle d'accès** :
- Page accessible si `roleLevel >= admin` (sinon "Access Denied" affiché)
- Sub-module **Roles & Permissions** : visible **uniquement** si `roleLevel === super_admin`
- Sidebar masque l'entrée Settings si user n'est pas admin

**Sub-modules** : 2 (General + Roles & Permissions)

#### Vue d'ensemble

Settings est un module **compact en surface** mais touche à des préoccupations transverses **critiques** : il manipule la table `Employee.roleLevel` qui contrôle l'accès à **tous** les autres modules d'Oxen OS. C'est aussi la zone où plusieurs endpoints utilitaires/legacy/debug sont rattachés.

**Hiérarchie des roles (4 niveaux, ordre décroissant)** :
1. `super_admin` — accès complet, peut changer les roles
2. `admin` — accès admin pages
3. `manager` — accès intermédiaire
4. `member` — accès de base

**Helpers (`src/lib/permissions.ts`)** :
- `canAccess(userRole, requiredRole)` : check hiérarchique
- `canAccessPage(userRole, dept, pageKey)` : check basé sur règles par page
- `ROLE_LEVELS = ["super_admin", "admin", "manager", "member"]`
- `ROLE_LABELS` + `ROLE_COLORS` (badges visuels)

---

#### Sub-module 12.1 — General (tab `general`)

**Objectif** : Préférences générales de l'organisation et du compte user.

**Statut interne** : 🔴 **Squelette UI** — l'onglet est rendu mais le code complet de la section General n'est pas visible dans la lecture initiale (probablement WIP ou minimal).

**Features anticipées (à confirmer en lecture profonde)** :
- Préférences personnelles (timezone, langue, notifications)
- Settings org-level (logo, nom légal, branding)
- Configuration entités (`OrgEntity`)

**Routes API potentiellement liées** :
- `GET /api/me` : récupère l'employee record courant
- `GET/POST /api/org-entities` + `[id]` : CRUD des entités du groupe

**Models** : `User`, `OrgEntity`

---

#### Sub-module 12.2 — Roles & Permissions (tab `roles`, **super_admin only**)

**Objectif** : Gestion centralisée des roles attribués aux employés. **Le seul endroit** dans Oxen OS où les access levels peuvent être modifiés.

**Visibilité** : Tab **caché** si user n'est pas `super_admin`.

**Features** :
- Tableau "Role Management" avec 4 colonnes : Employee, Department, Current Role, Actions
- **Tri automatique par roleLevel** : super_admin → admin → manager → member
- Per-employee : avatar gradient, nom, email, department, badge role courant
- **Action "Change Role"** : ouvre `confirmModal` avec sélecteur du nouveau roleLevel
- **Garde-fou** : impossible de changer son **propre** role

**Routes API** :
- `GET /api/employees` : liste tous les employees avec roleLevel
- `PATCH /api/employees/[id]/role` : change le roleLevel d'un employee
  - **Auth** : `requireRole("super_admin")`
  - **Validation** : `ROLE_LEVELS.includes(roleLevel)` (sinon 400)
  - **Garde-fou** : cannot self-modify (sinon 400 "Cannot change your own role")
- `GET /api/me` : pour vérifier le role du user courant

**Models** : `Employee` (champs `roleLevel`, `isAdmin`)

---

#### Models touchés par Settings (transverse — module carrefour)

- **`User`** — table NextAuth (email, name, image, sessions)
- **`Account`** — providers OAuth (Google) avec **tokens encrypted (Sprint 1.3 AES-256-GCM)**
- **`Session`** — sessions DB-stored (NextAuth strategy = database)
- **`Employee`** — table métier liée à User par email
- **`OrgEntity`** — entités juridiques du groupe
- **`AuditLog`** — log de toutes mutations sensibles
- **`ActivityLog`** — log d'activité générale

#### Endpoints à auditer pour suppression future

- 🟡 **`GET /api/debug/drive-scope`** (`force-dynamic`)
  - Diagnostic Google Drive scope du user courant
  - **Recommandation** : guarder par `roleLevel === "super_admin"` ou supprimer en prod

- 🟡 **`GET /api/migrate-avatars`**
  - Endpoint one-shot : migration historique avatarColor
  - **Recommandation** : supprimer après vérification

- 🟡 **Routes legacy 410 dépréciées** : `/api/contacts`, `/api/deals`, `/api/agents/*` (suppression définitive après vérification logs)

- 🟡 **Pages seed** (Sprint 0 hardened) : NODE_ENV-guarded, sécurité OK mais retrait possible en prod

#### Workflow type — Promotion d'un member vers admin

1. Vernon (super_admin) ouvre `/settings` → tab Roles
2. Tableau affiche tous les employees triés par role
3. Trouve "Aleks Smith" (manager → admin)
4. Click "Change Role" → `confirmModal` ouvert avec sélecteur
5. Sélectionne `admin`, confirme
6. PATCH `/api/employees/[id]/role` avec body `{ roleLevel: "admin" }`
7. `requireRole("super_admin")` validate
8. Garde-fou : Vernon n'est pas en train de modifier son propre id → OK
9. `Employee.roleLevel` updated en DB
10. Aleks doit refresh sa session pour voir la sidebar avec les nouveaux modules accessibles

#### ⚠️ Dette technique signalée

> **Tab General incomplet** : L'onglet est rendu dans la sub-nav mais le code de la section General est minimal/vide. Trois hypothèses possibles : squelette WIP, désactivé temporairement, volontairement minimal. **À trancher avec Vernon** dans un sprint cleanup.

#### Backlog identifié pour Settings

- 🔴 **Tab General incomplet**
- ⚠️ Pas de history des changements de role affichée dans l'UI
- ⚠️ Pas de bulk role change
- ⚠️ Pas de gestion des permissions custom par module via UI
- ⚠️ Pas de management OrgEntity dans Settings
- ⚠️ `/api/debug/drive-scope` reste accessible en prod
- ⚠️ Pas de 2FA / MFA
- ⚠️ Pas de logs de sessions actives affichés
- ⚠️ Pas de session revocation
- 🟡 Endpoints legacy/debug à auditer

---

### 13. Organigramme

**Objectif** : Visualisation hiérarchique du groupe Oxen — structure parent/enfant des entités juridiques + employés rattachés.

**Audience principale** : Vernon + PM + équipe ops

**Statut global** : ⚠️ Limité (1 page lecture, pas de CRUD UI complet)

**URL principale** : `/org`

**Sub-modules** : 0

#### Vue d'ensemble

Module de visualisation hiérarchique des entités juridiques du groupe Oxen — affiche la structure d'arbre parent/enfant via le model `OrgEntity` (champs `children`/`parent` pour la relation auto-référencée). Chaque entity affiche les employés rattachés (preview de 5, ordré par `Employee.order`).

#### Features

- Page `/org` avec vue arbre des entités
- Pour chaque entity affichée :
  - Nom (`OrgEntity.name`)
  - Liste des employés rattachés (max 5 preview avec avatar gradient + initials + icon)
  - Compteur total employés (`_count.employees`)
  - Children (sous-entités si applicable)
- Données pré-chargées via `GET /api/org-entities` au mount

#### Routes API

- `GET /api/org-entities` : liste flat de toutes les entités avec inclusions (`children`, `parent`, `employees` limit 5, `_count.employees`)
- `GET/POST /api/org-entities/[id]` : CRUD individuel (création/édition/suppression)

#### Models Prisma

- **`OrgEntity`** : id, name, parentId (FK auto-référencée), order, employees relation
- **`Employee.entityId`** : FK directe vers `OrgEntity` (relation Prisma standard `Employee.orgEntity`). `migrate-avatars` était une migration one-shot dev-only pour migrer les anciens employees qui avaient `entity` en string vers `entityId` (FK), pas le mécanisme actuel.

#### Lien cross-module

- **Settings > Roles** : modifier le `roleLevel` d'un employé (mais pas son `entityId` depuis Settings)
- **Team** (`/team`) : éditer les détails d'un employé (avatar, role, department, telegramChatId)
- **Compliance > Policies** : chaque policy peut être rattachée à une `OrgEntity` (champ `entityId`)
- **Finance** : 4 entités hardcodées dans `constants.ts` désalignées avec OrgEntity (cf. backlog Finance)

#### Backlog identifié pour Organigramme

- 🔴 **Désalignement avec Finance entities** : la liste réelle (Escrowfy GmbH, Ltd, Neural ID Pay, Arventis, Green Nation, Lapki Digital) doit être créée dans `OrgEntity` pour devenir source de vérité (cf. backlog Finance)
- ⚠️ **Pas de CRUD UI complet** : la page est principalement de la visualisation, pas évident que Vernon puisse créer/éditer une entité depuis `/org` (à confirmer en lecture détaillée)
- ⚠️ **Pas de drag & drop** pour réorganiser hiérarchie
- ⚠️ **Pas de visualisation graphique** type org chart (juste un tree text-based)
- 🟡 Pas de TODO visible

---

### 14. Team

**Objectif** : Annuaire de l'équipe — détails des employés Oxen avec avatar custom, role, department, telegram chat ID.

**Audience principale** : Tous (lecture) + admins (édition)

**Statut global** : ✅ Mature

**URL principale** : `/team`

**Sub-modules** : 0

#### Vue d'ensemble

Page liste des employés avec édition inline. Source de vérité des `Employee` records (table métier, distincte de `User` NextAuth). Chaque employé a un avatar gradient custom (palette de themes via `getAvatarGradient`), des initials, un icon optionnel, un department, un role textuel, un roleLevel hiérarchique, et optionnellement un `telegramChatId`.

#### Features

- Liste de cards employees avec : avatar gradient + initials/icon, name, email, role, department, entity (via OrgEntity FK)
- Edit inline (probablement pour admins)
- Avatar themes : palette définie dans `src/lib/avatar.ts` (`AVATAR_THEME_NAMES`)
- Department et role en string (pas enum)

#### Routes API

- `GET /api/employees` : liste tous les employees
- `POST /api/employees` : créer
- `GET/PATCH/DELETE /api/employees/[id]` : CRUD
- `PATCH /api/employees/[id]/role` : change roleLevel (super_admin only — cf. Settings)
- `POST /api/employees/seed` : seed initial (NODE_ENV-guarded)
- `GET /api/team` : alias léger pour récupérer les employees (utilisé partout pour assignment dropdowns)

#### Models Prisma

- **`Employee`** : id, name, email, role, department, entityId (FK OrgEntity), roleLevel, isAdmin, avatarColor, icon, initials, order, telegramChatId, createdAt

#### Lien cross-module

- **Settings > Roles** : change roleLevel
- **Tasks** : alimente le dropdown assignee
- **CRM Deals** : `dealOwner` est un Employee.name string (cf. backlog cross-module — désalignement potentiel avec FK)
- **Calendar** : `/api/calendar/owners` filtre par employees avec calendrier connecté
- **Marketing** : access control via `department === "marketing"`
- **Finance** : access via `department === "finance"`
- **Telegram bot** : `telegramChatId` lie un employé à son chat Telegram personnel
- **Absences** : chaque `LeaveRequest.employeeId` pointe vers un Employee

#### Backlog identifié pour Team

- ⚠️ **`dealOwner` est un string** dans `CrmContact` / `Deal` (Andy / Paul Louis / Vernon hardcodé) au lieu d'une FK vers `Employee` — fragilise les renames
- ⚠️ Pas de **profil détaillé** par employé (pas de page `/team/[id]`)
- ⚠️ **Onboarding/offboarding** : pas de workflow structuré (création account, attribution roles, assignation tâches initiales)
- 🟡 Pas de TODO visible

---

### 15. Wiki

**Objectif** : Documentation interne d'Oxen — knowledge base TipTap/ProseMirror avec versioning, raccourcis Drive, et Q&A AI.

**Audience principale** : Tous

**Statut global** : ✅ Mature

**URL principale** : `/wiki`

**Pages** : `/wiki` (liste) + `/wiki/[slug]` (détail) + `/wiki/[slug]/edit` (éditeur) + `/wiki/new` (création)

**Sub-modules** : 2 (Pages / Drive)

#### Vue d'ensemble

Wiki classique avec arbre de pages, éditeur riche TipTap (ProseMirror sous le capot), versioning automatique (chaque save crée un `WikiVersion`), restore d'une ancienne version, et **Q&A IA** ("Ask the Wiki" — pose une question, Claude cherche dans le contenu et répond).

Pages organisées par `category` + `pinned` flag + `order` pour tri custom. Slug auto-généré ou manuel.

---

#### Sub-module 15.1 — Pages (`/wiki`, `/wiki/[slug]`, `/wiki/[slug]/edit`, `/wiki/new`)

**Objectif** : CRUD pages wiki avec édition rich text + versioning + AI Q&A.

**Features** :
- **Liste** : sidebar avec arbre des pages, search, pinned section en haut
- **Création** : `/wiki/new` ouvre l'éditeur avec template vide
- **Édition** : `/wiki/[slug]/edit` avec TipTap toolbar (heading, list, blockquote, link, image, code block)
- **Detail** : `/wiki/[slug]` lecture seule + bouton "Edit"
- **Versioning** : chaque save crée un `WikiVersion`. Page `/api/wiki/[slug]/versions` liste l'historique
- **Restore** : `/api/wiki/[slug]/restore` rollback à une version antérieure
- **Reorder** : `/api/wiki/reorder` drag & drop des pages dans la sidebar
- **AI Q&A** : `/api/wiki/ask` — pose une question, Claude répond en s'appuyant sur les WikiPage contents
- **Categories** : groupement par `category` field (string libre)
- **Pinned** : pages épinglées en haut

**Routes API** :
- `GET /api/wiki` : liste de toutes les pages (light)
- `POST /api/wiki` : créer (avec content TipTap JSON)
- `GET/PATCH/DELETE /api/wiki/[slug]` : CRUD individuel
- `GET /api/wiki/[slug]/versions` : historique versions
- `POST /api/wiki/[slug]/restore` : restore version
- `POST /api/wiki/reorder` : reorder pages
- `POST /api/wiki/ask` : Q&A AI sur le contenu wiki
- `POST /api/wiki/seed` : seed initial (NODE_ENV-guarded + auth required)

**Models** : `WikiPage`, `WikiVersion`

---

#### Sub-module 15.2 — Drive (browser inline Google Drive)

**Objectif** : Browser intégré Google Drive de l'équipe Oxen pour piocher des fichiers à intégrer dans le wiki.

**Features** :
- Vue inline du Google Drive (folders + files)
- Pages : Recent, Starred
- Search par query
- Click sur fichier → preview ou extraction du contenu (`/api/drive/read/[fileId]`)
- **Drive Links** : raccourcis sauvegardés vers fichiers fréquents (model `DriveLink`)

**Routes API (transverses, cf. T6)** :
- `GET /api/drive/files?folderId=...&q=...` : liste fichiers
- `GET /api/drive/files/[fileId]` : détail
- `GET /api/drive/recent` : modifiés récemment
- `GET /api/drive/starred` : starred
- `GET /api/drive/read/[fileId]` : contenu texte
- `GET/POST /api/drive/links` + `[id]` : raccourcis

**Models** : `DriveLink`

---

#### Intégrations externes

- **Google Drive API** (scope `drive.readonly`)
- **Anthropic Claude** : Q&A AI sur contenu wiki
- **Conferences module** : auto-publication des `ConferenceReport` comme `WikiPage` (cf. Conferences sub-module 10.3)

#### Workflow type — Documenter une procédure

1. User va sur `/wiki/new`
2. Renseigne title, slug (auto), category, pinned bool
3. Édite le contenu via TipTap (rich text)
4. Save → `POST /api/wiki` crée `WikiPage` + premier `WikiVersion`
5. Plus tard, modification → `PATCH /api/wiki/[slug]` crée nouvelle version
6. Si erreur : `/wiki/[slug]/versions` → click sur ancienne version → restore
7. Pour question rapide : "Ask the Wiki" → Claude répond en citant les pages pertinentes

#### Backlog identifié pour Wiki

- ⚠️ **Pas de partage externe** (lien public read-only)
- ⚠️ **Pas de tags** (juste category + pinned)
- ⚠️ **Pas de mentions @user** dans les pages
- ⚠️ **Pas de comments** sur les pages
- ⚠️ **Wiki AI Ask** : pas de citation des pages source (à confirmer si Claude renvoie les sources)
- ⚠️ **Drive sub-module** : si user révoque scope drive, l'app ne le détecte pas proactivement
- 🟡 Pas de TODO visible

---

### 16. Absences

**Objectif** : Gestion des congés / absences de l'équipe — calendrier visuel, demandes individuelles, règles configurables, et workflow d'approbation admin.

**Audience principale** : Tous (lecture/demande) + admins (approbation/rules)

**Statut global** : ✅ Mature

**URL principale** : `/absences`

**Sub-modules** : 4 (Calendar / My Leaves / Rules / Admin)

#### Vue d'ensemble

Module RH léger qui couvre le cycle complet : configuration des règles (jours de congé par type, par year), demande individuelle, approbation admin, et visualisation calendrier équipe. Les absences approuvées apparaissent en filigrane sur le module Calendar (cf. Calendar sub-module).

**Types d'absence** typiques (depuis le code) :
- Vacation
- Sick leave
- Personal day
- Maternity / Paternity
- Other

---

#### Sub-module 16.1 — Calendar (vue agenda d'équipe)

**Objectif** : Vue calendrier de toutes les absences approuvées de l'équipe.

**Features** :
- Affiche les `LeaveRequest` avec status `approved`
- Distinction par employé (avatar/initials) et type (couleur)
- Filtres : période, employee, type
- Vue mois ou agenda

**Route API** : `GET /api/leaves?all=true&status=approved&startDate=...&endDate=...`

---

#### Sub-module 16.2 — My Leaves (vue personnelle)

**Objectif** : Demandes de congé du user courant + balance restant.

**Features** :
- Liste des `LeaveRequest` du user (toutes statuses)
- **Balance** : jours restants par type via `LeaveBalance` model
- **Création de demande** : modal avec startDate, endDate, type, reason
- **Edition** : possible si status `pending` (sinon read-only)
- **Cancel** : possible si status `pending`

**Routes API** :
- `GET /api/leaves` : liste user courant
- `POST /api/leaves` : créer demande
- `GET/PATCH/DELETE /api/leaves/[id]` : CRUD
- `GET /api/leaves/balance/[employeeId]` : balance par employé
- `POST /api/leaves/balance/init` : initialise balances pour un employé
- `GET /api/leaves/who-is-out` : qui est en off aujourd'hui (utilisé par Tasks pour le badge ⚠ on leave)

**Models** : `LeaveRequest`, `LeaveBalance`

---

#### Sub-module 16.3 — Rules (admin, configuration)

**Objectif** : Configuration des règles globales de congés (jours par type, accruals, carryover).

**Features** :
- CRUD règles via `LeaveRules` model
- Définition par type : `daysAllowed`, `accrual` (mensuel/annuel), `carryover` (max reportable d'année à année)

**Route API** : `GET/POST /api/leaves/rules`

**Models** : `LeaveRules`

---

#### Sub-module 16.4 — Admin (workflow d'approbation)

**Objectif** : Vue admin pour approuver / rejeter les demandes en attente.

**Features** :
- Liste des `LeaveRequest` status `pending` cross-team
- Actions : approve / reject / request more info
- Bulk approval possible
- **Manual entry** : `/api/leaves/manual` pour saisir une absence rétroactivement (admin)
- **Bulk import** : `/api/leaves/bulk-import` (probablement CSV)
- **Export** : `/api/leaves/export`

**Routes API** :
- `GET /api/leaves?all=true` : toutes les demandes (admin)
- `PATCH /api/leaves/[id]` : approve / reject (status update)
- `POST /api/leaves/manual` : saisie manuelle admin
- `POST /api/leaves/bulk-import` : import bulk
- `GET /api/leaves/export` : export CSV

---

#### Lien cross-module

- **Calendar** : absences approuvées affichées en filigrane (`fetch /api/leaves?all=true&status=approved`)
- **Tasks** : `/api/leaves/who-is-out` alimente le badge ⚠ on leave à côté du nom assignee
- **Team** : chaque `LeaveRequest.employeeId` pointe vers `Employee`

#### Backlog identifié pour Absences

- ⚠️ **Pas de notifications** automatiques (employé demande → admin notifié, admin approuve → employé notifié)
- ⚠️ **Pas d'intégration Slack/Telegram** pour les notifs
- ⚠️ **Pas de calcul automatique des jours ouvrés** (week-ends + jours fériés)
- ⚠️ **Pas de jours fériés configurables** par pays (Switzerland holidays vs UK vs UAE)
- ⚠️ **Pas d'auto-decrement balance** post-approbation (à confirmer logique)
- 🟡 Pas de TODO visible

---

## Architecture transverse

Les transverses sont des composants **infrastructurels** qui traversent plusieurs modules d'Oxen OS. Ils n'apparaissent pas dans la sidebar (sauf Auth via la page `/login`), mais leur fonctionnement est critique.

### T1. Webhooks entrants

**Objectif** : Points d'entrée HTTP pour les intégrations tierces qui poussent des données vers Oxen OS — enrichissement contacts, events outreach, automation N8N, leads inbound.

**6 endpoints exposés** :

| Endpoint | Source | Authentification |
|---|---|---|
| `POST /api/webhooks/clay` | Clay (intent signals enrichment) | `requireWebhookSecret` (CLAY_WEBHOOK_SECRET, timingSafeEqual) |
| `POST /api/webhooks/lemlist` | Lemlist (campaign events) | HMAC SHA-256 multi-headers + fail-closed env guard |
| `POST /api/webhooks/trigify` | Trigify (job-change signals) | `requireWebhookSecret` (TRIGIFY_WEBHOOK_SECRET) |
| `POST /api/webhooks/n8n` | N8N (automations génériques) | `requireWebhookSecret` (N8N_WEBHOOK_SECRET) |
| `POST /api/crm/webhooks/inbound-lead` | Formulaire site `oxen.finance` | Probablement secret partagé (à confirmer) |
| `POST /api/support/webhooks/website-form` | Formulaire support `oxen.finance` | Idem (à confirmer) |

#### Couverture

- **CRM Contacts** : enrichissement automatique via Clay + Trigify (alimente `IntentSignal` model)
- **Outreach (CRM)** : Lemlist webhook met à jour `lifecycleStage`, `lemlistStatus`, `lemlistStep`, et incrémente les compteurs `OutreachCampaign`
- **Support** : tickets entrants via formulaire site
- **CRM Inbound** : leads entrants → création `CrmContact` + auto-assignment via `getOwnerForGeo`
- **N8N** : 3 actions supportées (`create_signal`, `update_contact`, `create_interaction`) → manipulation flexible

#### Models impactés

`IntentSignal`, `CrmContact`, `Activity`, `OutreachCampaign`, `SupportTicket`

#### Intégrations externes

- **Clay** (data enrichment platform)
- **Lemlist** (cold outreach)
- **Trigify** (job-change tracking)
- **N8N** (automation platform self-hosted ou cloud)
- **Hookdeck** (proxy webhook potentiel — Lemlist supporte plusieurs headers signature)

#### Sécurité applicable

✅ **Sprint 0 (Critical Hotfixes)** :
- `requireWebhookSecret()` helper créé dans `src/lib/webhook-auth.ts` avec `timingSafeEqual` (constant-time compare, anti-timing-attack)
- Pattern vulnérable corrigé sur Clay/Trigify/N8N : ancien `if (env && secret !== env)` → silent passthrough sur env manquant. Nouveau : throw au boot si env absent, 401 si header invalide.
- Lemlist : fail-closed guard ajouté en handler-top (vs module-scope qui crashait le build Next.js)
- Webhook secret jamais loggé en clair

✅ **Sprint 2.4b (Sentry / Logging)** :
- Webhooks loggés via `pino` (PII-safe) avec correlation IDs
- Erreurs trackées dans Sentry

#### Backlog identifié

- ⚠️ **Rate limiting absent** : un attaquant avec le secret pourrait DDoS les webhooks (Sprint 4 prévu — rate limiting général)
- ⚠️ Webhooks `inbound-lead` et `website-form` : pattern de sécurité à auditer (probablement secret simple, pas HMAC)
- ⚠️ Pas de **dead-letter queue** : si un webhook plante, l'event Clay/Lemlist n'est pas rejoué
- ⚠️ Pas de **idempotency** : si Lemlist retry un même event, on incrémente 2× les compteurs `OutreachCampaign`
- ⚠️ Pas de **dashboard observability** : combien de webhooks reçus / heure, erreurs récentes, latence

---

### T2. Workers Railway

**Objectif** : Services Railway séparés (hors monolith Next.js) qui processent les jobs lourds en background — calls Claude API et synchronisations externes.

**Architecture** : 3 services Railway distincts :
- **Monolith** Next.js (l'app principale)
- **`workers/ai-worker/`** : processus Node.js standalone qui poll la table `Job`
- **`workers/sync-worker/`** : processus Node.js standalone idem

Chaque worker a son **propre dossier** `workers/{name}/` avec : `package.json`, `tsconfig.json`, `prisma/` (client généré), `railway.json` (deploy config), `src/index.ts` + `src/lib/`.

#### Job types supportés

**AI Worker** (`AI_WORKER_TYPES`) :
- `ai:score-lead` — scoring d'un lead via Claude
- `ai:generate-article` — génération article SEO via Claude
- `ai:news-scan` — scan + analyse RSS sources
- `ai:keyword-discover` — découverte keywords
- `ai:geo-test` — test prompt GEO (visibilité LLM)
- `ai:score-news` — scoring news items

**Sync Worker** (`SYNC_WORKER_TYPES`) :
- `sync:email` — pull Gmail messages d'un user, alimente `Email` model
- `sync:calendar` — pull Google Calendar events

#### Configuration

Centralisée dans `src/lib/worker-config.ts` :
- `ENABLE_WORKERS` : feature flag (env `ENABLE_WORKERS=true`). Si `false` → traitement **inline** dans les routes API (comportement legacy)
- `AI_POLL_INTERVAL_MS = 5000` (5s)
- `SYNC_POLL_INTERVAL_MS = 10000` (10s)
- `MAX_RETRIES = 3`
- `STALE_JOB_TIMEOUT_MS = 300000` (5 min — reset les jobs bloqués en "processing")
- `HEARTBEAT_INTERVAL_MS = 30000` (30s)

#### Mécanisme de claim atomique

`claimJob()` dans `src/lib/job-queue.ts` utilise du **raw SQL atomique** pour éviter les race conditions entre workers (deux workers qui pourraient claim le même job).

#### Couverture

- **CRM AI** (Sentinel insights, lead scoring, deal health) : si `ENABLE_WORKERS=true`, queued en background
- **Marketing SEO/GEO** : génération articles + keyword discovery + GEO tests via AI worker
- **Calendar/Email sync** : sync-worker pull events + emails périodiquement

#### Models Prisma

- **`Job`** : id, type, status (`pending` / `processing` / `completed` / `failed`), payload (Json), result (Json?), error (Text?), attempts, maxAttempts, priority, createdBy, processedBy (worker ID), startedAt, completedAt

#### Intégrations externes

- **Anthropic Claude** (AI worker)
- **Google APIs** : Gmail + Calendar (sync worker)
- **Railway** (hébergement, scheduling, restart)

#### Sécurité applicable

✅ **Sprint 2.4b (Sentry)** : workers initialisent Sentry au boot avec `sentryBeforeSend` PII-safe filter
✅ **Sprint 2.4** (logging structuré) : pino logger child component (`logger.child({ component: ... })`)
✅ **Sprint 1.3** (token encryption) : workers lisent les `Account.access_token` / `refresh_token` déjà déchiffrés via Prisma extension AES-256-GCM
✅ Workers ont leur **propre DATABASE_URL** Railway et leur propre Prisma client compilé (cf. `workers/{name}/prisma/`)

#### Backlog identifié

- ⚠️ **`ENABLE_WORKERS` flag** : statut actuel à confirmer — si `false`, le code workers est dead code et tous les calls Claude sont inline (donc bloquants en API)
- ⚠️ Pas de **dashboard d'observabilité** des jobs (combien en queue / processing / failed)
- ⚠️ Pas de **retry exponential backoff** (juste `MAX_RETRIES = 3` linéaire)
- ⚠️ Pas de **prioritization complexe** (juste un int `priority`, pas de SLA)
- ⚠️ **Workers schema isolés** : chaque worker a son `prisma/schema.prisma` propre — risque de drift si schema principal modifié sans repropager

---

### T3. AI insights cross-module (Sentinel surfacé partout)

**Objectif** : Sentinel n'est pas un module isolé — c'est un fil rouge qui injecte de l'intelligence Claude dans plusieurs modules existants.

#### Couverture (où Sentinel apparaît hors `/ai`)

| Module | Surface AI | Endpoint |
|---|---|---|
| **Dashboard** (`/`) | Activity feed type `sentinel_insight` | `GET /api/dashboard` (lit AIInsight) |
| **CRM Contacts** (`/crm/contacts/[id]`) | Lead scoring inline + summary | `POST /api/crm/ai/score-lead/[contactId]`, `POST /api/crm/ai/summarize/[contactId]` |
| **CRM Deals** (`/crm/[id]`) | Deal health avec signaux risque/opportunité | `GET /api/crm/ai/deal-health/[dealId]`, `POST /api/crm/ai/health-check-all` |
| **CRM Inbox** (`/crm/inbox`) | Follow-ups suggérés | `GET/POST /api/crm/ai/followups`, `POST /api/crm/ai/check-followups` |
| **CRM (transverse)** | Compute relationship scores | `POST /api/crm/ai/compute-relationships` |
| **Marketing > Compliance Check** | Analyse de conformité contenu | `POST /api/marketing/compliance-check` |
| **Marketing > SEO/GEO Blog Writer** | Génération articles | `POST /api/seo/articles/generate` |
| **Marketing > SEO/GEO Keywords** | Découverte keywords | `POST /api/seo/keywords/discover` |
| **Marketing > SEO/GEO News Scan** | Analyse RSS sources | `POST /api/seo/news/scan` |
| **Marketing > SEO/GEO GEO Tests** | Test prompts LLM | `POST /api/seo/geo/run-test/[promptId]` |
| **Calendar > Call Notes** | Génération HTML autonome | `POST /api/call-notes/generate` |
| **Sentinel > Briefs** | Brief meeting | `POST /api/ai/brief` |
| **Sentinel > Insights** | Auto-insights | `POST /api/ai/auto-insights` |
| **Sentinel > Daily Digest** | Résumé quotidien | `POST /api/ai/digest` |
| **Sentinel > Chat** | Chat conversationnel | `POST /api/ai/chat` |
| **Intel** (`/intel`) | Recherches AI cron + run | `GET /api/intel/cron`, `POST /api/intel/run/[id]` |
| **Conferences** (`/conferences`) | Auto-fill par URL | `POST /api/conferences/auto-fill` |
| **Wiki** (`/wiki`) | AI Q&A | `POST /api/wiki/ask` |

**Total : ~20 surfaces AI** à travers 9 modules différents.

#### Models impactés

`AIInsight`, `AIFollowUp`, `AIConversation`, `MeetingBrief`, `CallNote`, `IntelResult`, `Article`, `Keyword`, `NewsItem`, `GeoTestResult`, `ContentComplianceCheck`

#### Intégration externe centrale

- **Anthropic Claude API** (`@anthropic-ai/sdk`)
- **Model utilisé** : `claude-sonnet-4-20250514` (cf. `CLAUDE.md`)
- **Prompts centralisés** : `src/lib/claude.ts`
- Certaines routes utilisent `Anthropic` directement (ex: `/api/intel/run/[id]`, `/api/intel/cron`, `/api/conferences/auto-fill`, `/api/call-notes/generate`)

#### Sécurité applicable

✅ **Token encryption** (Sprint 1.3) : `ANTHROPIC_API_KEY` dans env Railway, jamais en code
⚠️ **Rate limiting absent** sur **toutes** les routes AI (Sprint 4 prévu)
⚠️ **Cost monitoring absent** (cf. backlog Sentinel) — pas de tracking par feature, par user, par mois
✅ **Job queue offload** disponible via `ENABLE_WORKERS=true` (cf. T2)

#### Backlog identifié

- 🔴 **Coût Anthropic** : risque budget si usage explose, aucune visibilité granulaire
- 🔴 **Rate limiting** : un user pourrait spammer `/api/intel/run/[id]` ou `/api/ai/auto-insights`
- ⚠️ **Pas de cache** : 2 calls identiques = 2× le coût (ex: 2 users qui demandent un summary du même contact dans la même heure)
- ⚠️ **Prompt versioning absent** : si un prompt dans `claude.ts` est modifié, pas d'historique des versions, pas de A/B test
- ⚠️ **Modèle hardcodé** (`claude-sonnet-4-20250514`) : pas de fallback si déprécié, pas de switch Haiku/Opus selon coût/qualité voulus
- ⚠️ **Pas de feedback loop** : user ne peut pas marquer un insight "utile" / "inutile" pour améliorer les prompts

---

### T4. Authentification (NextAuth v5)

**Objectif** : Authentification + session management pour tout Oxen OS — uniquement via Google OAuth, restricted aux domaines internes.

#### Couverture

**Tous les modules** d'Oxen OS — toute route API utilise `auth()` ou `requirePageAccess()` ou `requireRole()` pour vérifier la session.

#### Routes exposées

- `GET/POST /api/auth/[...nextauth]` : handlers NextAuth (signin, signout, callback OAuth, session)
- Page : `/login` — page de connexion (seul point public d'Oxen OS)

#### Configuration (`src/lib/auth.ts`)

- **Provider** : Google OAuth uniquement
- **Adapter** : `PrismaAdapter` (sessions DB-stored, pas JWT)
- **Domaine restriction** : `signIn` callback rejette tout email qui ne finit pas par `@oxen.finance`
- **Scopes Google** : `openid email profile` + `calendar` + `gmail.readonly` + `drive.readonly`
- **`access_type: "offline"` + `prompt: "consent"`** : force la récupération d'un refresh token à chaque login
- **Force-update tokens** : à chaque re-login, l'`Account` est mis à jour avec les nouveaux tokens + scopes
- **Cookies** : 4 cookies custom (pkceCodeVerifier, state, callbackUrl, sessionToken) avec `secure` conditionnel
- **`trustHost: true`** : nécessaire derrière reverse proxy Railway

#### Helpers (`src/lib/admin.ts`, `src/lib/permissions.ts`)

- `auth()` : récupère session côté server
- `requirePageAccess(pageKey)` : check role + dept pour une page
- `requireRole(level)` : check minimum role
- `getUserRole()` : helper pour récupérer `roleLevel`
- `canAccess(userRole, requiredRole)` : check hiérarchique
- `canAccessPage(userRole, dept, pageKey)` : check par règles métier

#### Models Prisma (NextAuth standard + extension)

- `User` (NextAuth)
- `Account` (NextAuth — providers OAuth, **tokens encrypted Sprint 1.3**)
- `Session` (NextAuth — DB-stored)
- `VerificationToken` (NextAuth — non utilisé sans email magic link)
- `Employee` — table métier liée à `User` par email

#### Middleware

`src/middleware.ts` (en chemin de migration vers `proxy.ts` Next.js 16) :
- Whitelist : `/api/auth`, `/api/telegram`, `/api/webhooks`, `/login`, `/_next`, `/favicon`
- Tout le reste : redirect `/login?callbackUrl=...` si pas de session cookie

#### Sécurité applicable

✅ **Sprint 0 (#C5)** : `debug: process.env.NODE_ENV !== "production"`
✅ **Sprint 0 (#C4)** : seed routes retirées du whitelist middleware → require auth
✅ **Sprint 1.3** : `Account.access_token` + `refresh_token` chiffrés AES-256-GCM via Prisma extension
✅ **Sprint 2.4** : security headers HSTS + autres (forcés en prod)
✅ Cookies `httpOnly`, `sameSite: lax`, `secure` conditionnel

#### Backlog identifié

- ⚠️ **`@escrowfy.ch` non whitelisted** : seul `@oxen.finance` actuellement
- ⚠️ **Pas de 2FA** application-level (délégué à Google)
- ⚠️ **Pas de session list / revocation** dans Settings
- ⚠️ **`middleware.ts` deprecated** : Next.js 16 demande migration vers `proxy.ts`
- ⚠️ **Refresh token rotation** : pas d'invalidation des anciens tokens

---

### T5. Telegram bot

**Objectif** : Bot Telegram bi-directionnel — envoie briefs, digests, alertes aux employés (1-to-1 chat ID), et reçoit commandes / questions via webhook avec parsing IA.

#### Routes exposées

| Route | Méthode | Description |
|---|---|---|
| `POST /api/telegram/webhook` | Webhook entrant | Reçoit messages Telegram, parse via Anthropic Claude |
| `POST /api/telegram/setup` | One-shot setup | Configure le webhook URL côté Telegram via API (auth required) |
| `POST /api/telegram/register` | Registration | Lie un `telegramChatId` à un Employee |
| `POST /api/telegram/send-brief` | Trigger | Envoie un `MeetingBrief` formaté au chatId de l'owner |
| `POST /api/telegram/check-upcoming` | Cron | Notifie les employés des meetings à venir (≤ 1h ?) |
| `POST /api/telegram/weekly-digest` | Cron (Mon/Fri) | Digest hebdo : Monday (week ahead) + Friday (week recap), called by sync worker cron |

#### Couverture

- **Sentinel** : daily digest peut être envoyé via Telegram (à confirmer wiring)
- **CRM Briefs** : `POST /api/ai/brief` peut chaîner `POST /api/telegram/send-brief`
- **Calendar** : reminders de meetings via `check-upcoming`
- **Conferences** : notification quand un rapport est soumis (cf. Conferences sub-module 10.3)
- **Absences** (potentiel) : notif admin de pending requests (à confirmer)
- **Support** : channel `telegram` listé dans `CHANNELS` — réception probable via webhook

#### Library (`src/lib/telegram.ts`)

- `sendTelegramMessage(chatId, text)`
- `sendTelegramNotification(...)` (utilisé par Conferences post-rapport)
- `formatBriefForTelegram(brief)` — formatte un MeetingBrief en Markdown Telegram
- `setWebhook(url, secret)` — configure le webhook côté Telegram

#### Models impactés

- `Employee.telegramChatId` (string optionnel)
- Pas de model dédié pour les messages Telegram entrants (parsing inline + dispatch)

#### Intégrations externes

- **Telegram Bot API** (HTTP)
- **Anthropic Claude** (parsing des messages entrants pour comprendre les commandes en langage naturel)

#### Sécurité applicable

✅ **TELEGRAM_WEBHOOK_SECRET** : env var requise, le `setup` route refuse si absente
✅ **`requireWebhookSecret`** : webhook entrant utilise le helper Sprint 0
✅ **Pas de PII loggé** : pino logger PII-safe
✅ **Pattern `sendTelegramNotification`** : centralisé pour cohérence

#### Backlog identifié

- ⚠️ **`weekly-digest`** route a commentaire `// No auth required — called by sync worker cron` : si quelqu'un appelle cette route directement, peut spam tous les employés. À sécuriser par secret partagé worker → API.
- ⚠️ **Parser Claude** sur webhook : coût Anthropic à chaque message reçu (si bot est ajouté à un group, peut exploser)
- ⚠️ **Pas de rate limiting** sur webhook entrant
- ⚠️ **Pas de fallback** si Telegram API down (les notifications sont silently failed)
- ⚠️ **`telegramChatId`** : chaque employé doit le configurer manuellement

---

### T6. Google Drive integration

**Objectif** : Browser inline Google Drive de l'équipe Oxen + extraction de contenu de fichiers Drive pour intégration AI/wiki.

#### Routes exposées

- `GET /api/drive/files?folderId=...&q=...` : liste fichiers (Drive API)
- `GET /api/drive/files/[fileId]` : détail fichier
- `GET /api/drive/recent` : modifiés récemment
- `GET /api/drive/starred` : starred
- `GET /api/drive/read/[fileId]` : extraction du **contenu texte** (pour AI / preview)
- `GET/POST /api/drive/links` + `/api/drive/links/[id]` : raccourcis sauvegardés vers fichiers fréquents

#### Couverture

- **Wiki > Drive sub-module** : browser inline (cf. Wiki sub-module 15.2)
- **CRM Contacts** : possibilité d'attacher des `DriveLink` à un contact (timeline)
- **Wiki AI Ask** : potentiellement extrait contenu via `/api/drive/read/[fileId]` pour répondre

#### Library

`src/lib/google-drive.ts` (helpers d'auth + appels Drive API)

#### Models Prisma

- `DriveLink` : id, contactId/wikiPageId optionnel, fileId, name, mimeType, createdBy

#### Intégration externe

- **Google Drive API** (via `googleapis`) — scope `https://www.googleapis.com/auth/drive.readonly`

#### Sécurité applicable

✅ **Sprint 1.3** : tokens Google encrypted at rest
✅ **Scope readonly** : pas d'écriture possible (lecture seule)
⚠️ **Debug route** : `/api/debug/drive-scope` `force-dynamic` est encore en prod — diagnostic des scopes Google d'un user

#### Backlog identifié

- ⚠️ **`/api/debug/drive-scope`** à supprimer ou guarder par super_admin
- ⚠️ **Pas de rate limiting** : une boucle de fetches peut épuiser le quota Google Drive API
- ⚠️ **Si user révoque le scope drive** : pas de détection proactive — juste 401/403 silencieux
- ⚠️ **Pas de cache** : chaque navigation folder = nouvel appel Drive
- ⚠️ **`/api/drive/read/[fileId]`** : peut retourner gros volumes (PDF de 100 pages) — pas de truncation visible

---

### T7. Google Email sync

**Objectif** : Synchronisation Gmail des employés vers la base — alimentation du **timeline** des `CrmContact` (emails envoyés/reçus avec un contact).

#### Routes exposées

- `POST /api/email/sync` : déclenche un sync pour le user courant (queue un `sync:email` job si `ENABLE_WORKERS=true`, sinon inline)
- `GET /api/contacts/[id]/emails?limit=50&offset=0` : liste paginée des emails liés à un `CrmContact`

#### Couverture

- **CRM Contacts > Timeline** : section emails dans la page `/crm/contacts/[id]`
- **Sentinel Briefs** : brief peut référencer les derniers échanges email (lecture du `Email` model)
- **AI insights** : signaux dérivés (silence, fréquence, sentiment) — à confirmer

#### Library

- Logic dans `/api/email/sync/route.ts` (lit `Account.access_token`, refresh si expiré, pull Gmail messages)
- `refreshAccessToken` importé depuis `src/lib/google-calendar.ts` (helper partagé Calendar/Gmail)

#### Models Prisma

- `Email` : id, contactId (FK), threadId, messageId, subject, snippet, body, from, to, cc, date, direction (inbound/outbound), labels[]

#### Intégration externe

- **Gmail API** (via `googleapis`) — scope `https://www.googleapis.com/auth/gmail.readonly`

#### Mécanisme

1. Pull last N messages depuis Gmail API (paginated via `nextPageToken`)
2. Pour chaque message : extract headers (from, to, subject, date), extract body (text) en parcourant les `parts`
3. Match l'email contre `CrmContact.email` (case-insensitive)
4. Si match → upsert dans `Email` table avec `contactId` linké
5. Si `ENABLE_WORKERS=true` : tout ça est queued comme job `sync:email`

#### Sécurité applicable

✅ **Sprint 1.3** : Gmail tokens encrypted
✅ **Scope readonly** : pas d'écriture/envoi
✅ **Auth required** sur `/api/email/sync` (un user ne peut sync que son propre Gmail)

#### Backlog identifié

- ⚠️ **Polling vs push** : pas de Gmail push notifications (Pub/Sub) configurées — sync manuel ou cron
- ⚠️ **Volume** : un Gmail avec 100k emails peut prendre des heures à sync — pas de progress visible côté UI
- ⚠️ **Match par email** : pas de match robuste (alias, plus-addressing pas géré)
- ⚠️ **Pas de filtrage côté Gmail** (label = oxen-crm) : on pull TOUT et on filtre côté Oxen — coûteux en API quota
- ⚠️ **PII dans body** : stockage en clair des emails (Decimal for amounts mais pas pour text content)

---

### T8. Job queue

**Objectif** : Mécanisme central de coordination asynchrone entre le monolith Next.js et les workers Railway — table `Job` avec claim atomique.

#### Routes exposées

- `GET /api/jobs/[jobId]` : status d'un job (auth required)

#### Couverture

**Quand `ENABLE_WORKERS=true`** : tous les calls AI ou sync sont queued plutôt qu'inline.

| Producteur (route Next.js) | Job type | Consommateur |
|---|---|---|
| `/api/ai/auto-insights`, `/api/crm/ai/score-lead/*`, etc. | `ai:score-lead` | AI Worker |
| `/api/seo/articles/generate` | `ai:generate-article` | AI Worker |
| `/api/seo/news/scan` | `ai:news-scan` | AI Worker |
| `/api/seo/keywords/discover` | `ai:keyword-discover` | AI Worker |
| `/api/seo/geo/run-test/[promptId]` | `ai:geo-test` | AI Worker |
| (autre) | `ai:score-news` | AI Worker |
| `/api/email/sync` | `sync:email` | Sync Worker |
| `/api/calendar/sync` | `sync:calendar` | Sync Worker |

#### Library (`src/lib/job-queue.ts`)

- `createJob({ type, payload, createdBy, priority?, maxAttempts? })` : créer un job pending
- `claimJob(types, workerId)` : claim atomique (raw SQL UPDATE) — un worker pour un job
- `completeJob(jobId, result)` : marquer completed
- `failJob(jobId, error)` : marquer failed (incrémente attempts, retry si < maxAttempts)
- `getJobStatus(jobId)` : exposed via API route

#### Models Prisma

`Job` (cf. T2 — schema détaillé)

#### États du job

`pending` → `processing` (claimé par un worker) → `completed` / `failed`

Si `failed` avec `attempts < maxAttempts` → reset à `pending` pour retry (linear backoff)
Si `processing` depuis > `STALE_JOB_TIMEOUT_MS` (5 min) → reset à `pending` (worker probablement crashé)

#### Sécurité applicable

✅ **Auth required** sur `/api/jobs/[jobId]` — un user ne peut voir que ses propres jobs (filtrage par `createdBy` à confirmer)
✅ **Raw SQL atomique** : claim utilise `UPDATE ... WHERE status='pending' RETURNING *` pour éviter race conditions
✅ **Sentry** : workers reportent les erreurs

#### Backlog identifié

- ⚠️ **`/api/jobs/[jobId]`** : pas de filtrage par `createdBy` visible — un user pourrait peut-être lire le status d'un job d'un autre user
- ⚠️ **Pas de UI de monitoring** : pas de page `/admin/jobs` pour voir queue/processing/failed
- ⚠️ **Pas de cleanup** : les jobs `completed` restent en DB indéfiniment (à terme = bloat)
- ⚠️ **`ENABLE_WORKERS=false`** par défaut probable : workers non utilisés en prod actuellement
- ⚠️ **Pas de webhook on-completion** : le client (UI) doit poll `/api/jobs/[jobId]` pour savoir quand le job est fini

---

## Backlog produit identifié

Synthèse des items identifiés à travers tous les modules + transverses, agrégés par priorité.

### Priorité 🔴 critique

Items qui bloquent un workflow ou créent un risque non-trivial. À traiter en priorité dans les prochains sprints.

| # | Module | Item |
|---|---|---|
| 1 | CRM Companies | **Bouton "+ New Company" non fonctionnel** — TODO `companies/page.tsx:119`, modal de création pas branché |
| 2 | Finance | **Désalignement entités** : code liste `oxen / escrowfy / galaktika / lapki` mais réalité business inclut Escrowfy GmbH, Escrowfy Ltd, Neural ID Pay, Arventis Labs, Green Nation SARL, Lapki Digital Pay. Synchroniser avec `OrgEntity` (source de vérité) |
| 3 | Tasks | **Dette technique 2 namespaces** : `Task` model + `/api/tasks/*` coexiste avec `CrmTask` + `/api/crm/tasks/*`. Indice canonique : Sentinel POST vers `/api/tasks` (model `Task`). À trancher |
| 4 | Settings | **Tab General incomplet** — squelette UI mais features réelles manquantes |
| 5 | Organigramme | **Désalignement avec Finance entities** : créer dans `OrgEntity` les 6 entités réelles (cf. backlog Finance) |
| 6 | Sentinel + Intel + AI cross-module | **Coût Anthropic non monitoré** — risque budget si usage explose, aucune visibilité granulaire (par feature, user, mois) |
| 7 | Sentinel + Intel | **Rate limiting absent** sur les routes AI — un user peut spammer `/api/intel/run/[id]` ou `/api/ai/auto-insights` (Sprint 4 prévu) |

### Priorité ⚠️ important

Items qui dégradent l'expérience ou créent une dette technique tangible mais non bloquante.

#### Backend / API

- **Webhooks** : pas de rate limiting, pas de dead-letter queue, pas d'idempotency
- **Webhooks `inbound-lead` et `website-form`** : pattern de sécurité à auditer
- **Workers** : `ENABLE_WORKERS` flag à confirmer en prod (si false, tout est inline donc bloquant)
- **Workers** : pas de dashboard d'observabilité, pas de retry exponential backoff
- **Job queue** : `/api/jobs/[jobId]` filtrage `createdBy` à confirmer (sécurité), pas de cleanup auto, pas de webhook on-completion
- **Routes legacy 410** : `/api/contacts`, `/api/deals`, `/api/agents/*` à supprimer définitivement

#### CRM

- Pas de bulk-edit dans la liste contacts (sauf Lemlist push)
- Pas de custom fields (tout hardcoded dans `CrmContact`)
- Mobile responsive non vérifié (interface dense, optimisée desktop)
- Companies : pas de bulk import CSV (vs Contacts)
- Industries Companies hardcodées (8 valeurs)

#### Marketing

- Surface UI compacte (1 page pour 34 routes)
- Social Media : saisie manuelle uniquement (pas de sync API auto)
- Content : pas de scheduler de publication
- Veille (`MarketingIntel`) vs Intel top-level (`/intel`) : confusion utilisateur potentielle
- Compliance Check : algorithme rules pas auditable depuis l'UI

#### Finance

- Surface UI compacte (1 page pour 15 routes)
- Catégories revenue/expense hardcodées
- Pas de multi-currency conversion
- Format de mapping CSV pas documenté

#### Compliance

- Pas d'intégration Sanctions/PEP API tierce (screening manuel)
- Pas de notifications email/Slack sur incidents critical/high
- Workflow approval Policies pas évident (status `pending_review` mécanisme ?)
- Bulk actions absentes
- Screening intégré au tab Overview (pas de sub-tab dédié) — découvrable uniquement via Overview

#### Sentinel + AI cross-module

- Pas de cache des prompts Claude (2 calls identiques = 2× le coût)
- Daily Digest : pas de scheduled job pour envoi auto
- Conversations `AIConversation` : pas d'export, pas de search
- Action Blocks `action-json` : vocabulaire pas en doc utilisateur
- Prompt versioning absent (pas d'A/B test)
- Modèle hardcodé (`claude-sonnet-4-20250514`) — pas de fallback / switch
- Pas de feedback loop utilisateur

#### Calendar + Tasks + Intel + Conferences

- Calendar : pas de drag & drop reschedule, pas de détection conflits, pas de détection révocation scope Google
- Tasks : pas de subtasks, pas de dépendances, pas de notifications, pas de time tracking, pas de filtres par assignee en vue "all"
- Intel : `/api/intel/cron` mécanisme de cron pas documenté, pas d'export PDF/CSV, régions hardcodées (5)
- Conferences : pas de multi-currency, pas de tracking d'attribution, pas de cache auto-fill Claude, pas d'export iCal, pas de feedback loop vers Intel

#### Support

- Surface UI compacte (1 page / 3 tabs)
- Pas d'intégration native chat widget (live_chat listé mais pas branché)
- Pas de templates de réponses
- Pas de SLA configurable
- Pas de CSAT survey
- Email send sortant pas évident
- `support-auto.ts` non auditée

#### Settings

- Pas de history des changements de role affichée
- Pas de bulk role change
- Pas de gestion permissions custom par module via UI
- Pas de management OrgEntity dans Settings
- `/api/debug/drive-scope` reste accessible en prod
- Pas de 2FA / MFA application-level
- Pas de logs sessions actives, pas de session revocation

#### Organigramme + Team

- Org : pas de CRUD UI complet (juste visualisation), pas de drag & drop, pas de visualisation graphique type org chart
- Team : `dealOwner` est un string (Andy / Paul Louis / Vernon) au lieu d'une FK vers `Employee` — fragilise les renames
- Team : pas de profil détaillé par employé (`/team/[id]`)
- Team : pas de workflow onboarding/offboarding structuré

#### Wiki + Absences

- Wiki : pas de partage externe (lien public read-only), pas de tags, pas de mentions @user, pas de comments
- Wiki AI Ask : pas de citation des pages source (à confirmer)
- Absences : pas de notifications, pas d'intégration Slack/Telegram, pas de calcul automatique jours ouvrés, pas de jours fériés configurables, pas d'auto-decrement balance

#### Auth + Telegram + Drive + Email

- Auth : `@escrowfy.ch` non whitelisted (seul `@oxen.finance`), pas de 2FA, pas de session list/revocation, middleware deprecated (Next.js 16 → proxy.ts)
- Telegram : `weekly-digest` route sans auth (cron), parser Claude coûteux sur webhook, pas de rate limiting, pas de fallback Telegram down
- Drive : pas de rate limiting, pas de cache, `/api/drive/read/[fileId]` pas de truncation (gros volumes)
- Email : polling vs push (pas de Gmail Pub/Sub), volume sync long sans progress UI, match par email pas robuste, pas de filtrage côté Gmail, PII en clair

### Priorité 🟡 nice-to-have

Items mineurs ou améliorations qualité de vie.

- **Dashboard** : pas de personnalisation user des KPIs, activity feed limité à 10 entrées (pagination), pas de filtre temporel
- **CRM** : refactoring page `/crm` (1500+ lignes mélangeant 6 sub-modules)
- **CRM agents** : `/crm/agents/[id]` legacy redirect (concept fusionné dans Contacts)
- **Marketing** : pas de TODO visible
- **Finance** : composants orphelins (`EntriesTab`, `BudgetTab`, `EntryModal`, `ImportModal`) à auditer pour suppression
- **Finance** : route `/api/finance/seed` (NODE_ENV-guarded, retrait possible)
- **Intel** : prompts pré-remplis mentionnent "Galaktika Pay" (entité non actuelle) — legacy de naming initial
- **Intel** : sources reconnues limitées à 10 (icons fallback générique)
- **Settings** : endpoints legacy/debug à auditer (`/api/debug/drive-scope`, `/api/migrate-avatars`, routes 410)
- **Settings** : pages seed (NODE_ENV-guarded) — retrait complet possible en prod (build flag)

---

## Dette technique

> Section séparée du backlog produit. Items qui ne sont pas des features manquantes mais des **incohérences structurelles** dans le code à corriger.

### 1. Tasks — 2 namespaces coexistent (🔴 critique)

**Constat** :
- `Task` model + routes `/api/tasks/*` (utilisé par la page `/tasks`)
- `CrmTask` model + routes `/api/crm/tasks/*` (utilisé par CRM pour tasks deals/contacts)

Les deux models existent en parallèle dans `prisma/schema.prisma`.

**Indice canonique** : Sentinel ("Create Task from Insight" dans `InsightsSection`) fait POST vers `/api/tasks` (model `Task`). C'est un signal que `Task` est probablement le namespace cible — mais **hypothèse à valider avec Vernon**, pas une décision actée.

**Impact si non traité** : double-saisie possible, incohérence entre vues, confusion dev/PM.

**Action** : sprint dédié pour migration `CrmTask` → `Task` + suppression du namespace alternatif + mise à jour des consumers CRM.

---

### 2. Finance — composants orphelins (⚠️ important)

**Constat** : `EntriesTab.tsx`, `BudgetTab.tsx` (singulier), `EntryModal.tsx`, `ImportModal.tsx` existent dans `src/components/finance/` mais **ne sont pas importés** par `page.tsx`.

**Hypothèse** : composants legacy d'une ancienne version (avant la sub-nav actuelle à 5 tabs).

**Action** : audit pour suppression. Si on confirme qu'ils sont morts, supprimer (réduit confusion + bundle size).

---

### 3. Settings — Tab General incomplet (🔴 critique)

**Constat** : L'onglet est rendu dans la sub-nav mais le code de la section General est minimal/vide.

**Hypothèses possibles** :
1. Squelette WIP — features prévues mais pas implémentées
2. Désactivé temporairement — code retiré mais tab non supprimé
3. Volontairement minimal — Vernon utilise actuellement `/org` et `/team` pour les configs

**Action** : trancher avec Vernon dans un sprint cleanup.

---

### 4. Finance — entités hardcodées vs OrgEntity (🔴 critique)

**Constat** : `src/components/finance/constants.ts` liste 4 entités hardcodées (`oxen`, `escrowfy`, `galaktika`, `lapki`) qui ne reflètent pas la réalité business (6 entités : Escrowfy GmbH, Escrowfy Ltd, Neural ID Pay, Arventis Labs, Green Nation SARL, Lapki Digital Pay).

**Action** :
1. Créer dans `OrgEntity` les 6 entités réelles
2. Remplacer la liste hardcodée par un fetch dynamique depuis `OrgEntity`
3. Migrer les `FinanceTransaction.entityId` existants si nécessaire

---

### 5. Routes legacy 410 (🟡 nice-to-have)

**Constat** : `/api/contacts/route.ts`, `/api/deals/route.ts`, `/api/agents/*` retournent HTTP 410 (Gone) avec message de redirection vers les routes `/api/crm/*`. La page `/crm/agents/[id]/page.tsx` est un redirect 4-line vers `/crm/contacts/[id]`.

**Action** : suppression définitive après vérification qu'aucun consumer externe n'appelle ces endpoints (vérifier logs Railway sur 30 jours).

---

### 6. Endpoints debug/migration en prod (⚠️ important)

**Constat** :
- `/api/debug/drive-scope` (`force-dynamic`) — diagnostic Google Drive scope, fuit potentiellement Account record
- `/api/migrate-avatars` — migration one-shot historique avatarColor

**Action** :
- `/api/debug/drive-scope` : guarder par `roleLevel === "super_admin"` ou supprimer en prod
- `/api/migrate-avatars` : supprimer après vérification que tous les employees ont été migrés

---

### 7. Workers — schema isolé (⚠️ important)

**Constat** : Chaque worker a son propre `workers/{name}/prisma/schema.prisma` (compilation isolée). Si le schema principal `prisma/schema.prisma` est modifié sans repropager, les workers peuvent drift.

**Action** : automatiser la copie du schema principal vers les workers au build, ou utiliser un schema partagé (symlink / npm workspace).

---

### 8. Middleware Next.js 16 deprecated (🟡 nice-to-have)

**Constat** : Build warning Next.js 16 : `middleware` file convention deprecated, use `proxy` instead.

**Action** : migrer `src/middleware.ts` → `src/proxy.ts` (cf. spawned task déjà flaggée). Non bloquant mais à traiter avant Next.js 17.

---

### 9. dealOwner string vs FK Employee (⚠️ important)

**Constat** : `Deal.dealOwner` et `CrmContact.dealOwner` sont des champs string (`"Andy"`, `"Paul Louis"`, `"Vernon"`) au lieu de FK vers `Employee.id`.

**Impact** : si on rename "Paul Louis" en "PL Smith", il faut faire un UPDATE SQL massif sur tous les Deals + Contacts. Fragilise les renames.

**Action** : migration vers `Deal.dealOwnerId` FK Employee, avec backfill des string values vers les `Employee.id` correspondants.

---

## Annexes

### Tableau récapitulatif des 16 modules

| # | Module | Sub-modules | Pages UI | Routes API | Models Prisma | Audience | Statut |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard | 0 | 1 | 5 | (lecture multi) | Tous | ✅ Mature |
| 2 | CRM | 6 | 11 | 60+ | 12+ (CrmContact, Deal, Company, etc.) | Andy + PM + Vernon | ✅ Mature (riche) |
| 3 | Marketing | 5 (+ 6 SEO sub-tabs) | 1 | 34 | 11 | Andy + Vernon | ⚠️ Backend riche, UI compacte |
| 4 | Finance | 5 | 1 | 15 | 5 (FinanceTransaction, Budget, Goal, BankAccount, Entry) | Vernon / dept finance | ⚠️ Backend riche, UI compacte |
| 5 | Compliance | 6 (+ Screening intégré) | 3 | 15 | 8 (Policy, Risk, Training, License, Incident, etc.) | Vernon + Veronika | ✅ Mature |
| 6 | Sentinel | 3 (+ cross-module) | 1 | 25 | 5 (AIConversation, AIInsight, etc.) | Tous | ✅ Mature |
| 7 | Calendar | 0 (3 view modes) | 2 | 11 | 3 (CalendarEvent, InternalEvent, CallNote) | Tous | ✅ Mature |
| 8 | Tasks | 3 | 1 | 4 (+4 namespace alt) | 2 (Task + CrmTask — dette) | Tous | ⚠️ Stable + dette technique |
| 9 | Intel | 7 catégories | 1 | 12 | 2 (IntelResearch, IntelResult) | Vernon + PM + Andy | ✅ Mature |
| 10 | Conferences | 3 | 2 | 12 | 4 (Conference, Attendee, Contact, Report) | Andy + Vernon | ✅ Mature |
| 11 | Support | 3 | 2 | 6 | 2 (SupportTicket, SupportMessage) | Vernon + équipe | ⚠️ Stable mais limité |
| 12 | Settings | 2 | 1 | 5 | (carrefour : User, Account, Session, AuditLog, ActivityLog) | Vernon + admins | ⚠️ Stable mais limité |
| 13 | Organigramme | 0 | 1 | 2 | OrgEntity | Vernon + ops | ⚠️ Limité (lecture surtout) |
| 14 | Team | 0 | 1 | 4 | Employee | Tous | ✅ Mature |
| 15 | Wiki | 2 (Pages + Drive) | 4 | 10 | WikiPage, WikiVersion, DriveLink | Tous | ✅ Mature |
| 16 | Absences | 4 (Calendar/My/Rules/Admin) | 1 | 8 | LeaveRequest, LeaveBalance, LeaveRules | Tous + admins | ✅ Mature |

**Total** : 50 sub-modules réels, 34 pages UI, ~206 routes API actives, 70 models Prisma.

**Distribution statuts** : 9× ✅ Mature + 7× ⚠️ Stable mais limité — 0× 🔴 En chantier critique.

---

### Health-check des modules

| Module | Statut | Audience principale | Lien |
|---|---|---|---|
| Dashboard | ✅ | Tous | [#1-dashboard](#1-dashboard) |
| CRM | ✅ | Andy + PM + Vernon | [#2-crm](#2-crm) |
| Marketing | ⚠️ | Andy + Vernon | [#3-marketing](#3-marketing) |
| Finance | ⚠️ | Vernon | [#4-finance](#4-finance) |
| Compliance | ✅ | Vernon + Veronika | [#5-compliance](#5-compliance) |
| Sentinel | ✅ | Tous | [#6-sentinel](#6-sentinel) |
| Calendar | ✅ | Tous | [#7-calendar](#7-calendar) |
| Tasks | ⚠️ | Tous | [#8-tasks](#8-tasks) |
| Intel | ✅ | Vernon + PM + Andy | [#9-intel](#9-intel) |
| Conferences | ✅ | Andy + Vernon | [#10-conferences](#10-conferences) |
| Support | ⚠️ | Vernon + équipe | [#11-support](#11-support) |
| Settings | ⚠️ | Vernon + admins | [#12-settings](#12-settings) |
| Organigramme | ⚠️ | Vernon + ops | [#13-organigramme](#13-organigramme) |
| Team | ✅ | Tous | [#14-team](#14-team) |
| Wiki | ✅ | Tous | [#15-wiki](#15-wiki) |
| Absences | ✅ | Tous + admins | [#16-absences](#16-absences) |

---

### Glossaire

#### Termes Oxen

- **Oxen OS** — l'OS interne d'Oxen Finance / Escrowfy GmbH (cette app)
- **Sentinel** — assistant AI signature d'Oxen OS (`/ai`)
- **Outreach** — campagnes email Lemlist sortantes (sub-module CRM)
- **Veille** — capture manuelle d'observations marketing (sub-module Marketing, **distinct du module Intel top-level**)
- **Intel** — module de veille AI-powered cross-domaine (Claude lance des researches automatiques)
- **GEO** — Generative Engine Optimization — visibilité dans les réponses ChatGPT/Claude (sub-tab SEO)
- **Compliance Check** — validation pré-publication des contenus marketing (rules métier)
- **Playbook** — checklist méthodologique par deal (`PlaybookStep` model)
- **SmartView** — sauvegarde de filtres custom CRM par user
- **Call Notes** — fichier HTML autonome stylé Oxen pour capture meeting (généré par Claude)

#### Termes business / fintech

- **VQF** — SRO suisse de la finance (Self-Regulatory Organization)
- **SEMI** — Small Electronic Money Institution (UK FCA license)
- **VASP** — Virtual Asset Service Provider (Italy)
- **MSB** — Money Service Business (Canada)
- **MFSA** — Malta Financial Services Authority
- **CSSF** — Commission de Surveillance du Secteur Financier (Luxembourg)
- **FINMA** — Swiss Financial Market Supervisory Authority
- **VARA** — Virtual Assets Regulatory Authority (UAE / Dubai)
- **MiCA** — Markets in Crypto-Assets Regulation (EU)
- **PSD3** — Payment Services Directive 3 (EU)
- **DORA** — Digital Operational Resilience Act (EU)
- **OCA** — Oxen Compliance Agent (KYB/KYC system, à confirmer)
- **PEP** — Politically Exposed Person (sanctions screening)
- **AML / KYC / KYB** — Anti-Money Laundering / Know Your Customer / Business

#### Verticals CRM

- **FinTech/Crypto** — startups financières et crypto
- **Family Office** — gestionnaires de patrimoine pour ultra-high-net-worth
- **CSP/Fiduciaries** — Corporate Service Providers / fiduciaires
- **Luxury Assets** — yacht, art, real estate haut de gamme
- **iGaming** — gaming en ligne, paris sportifs
- **Yacht Brokers** — brokers nautiques (sous-vertical Luxury)
- **Import/Export** — commerce international

#### Pipeline stages CRM (9)

`new_lead → sequence_active → replied → meeting_booked → meeting_completed → proposal_sent → negotiation → closed_won / closed_lost`

#### Roles & permissions (4 niveaux)

`super_admin > admin > manager > member` — hiérarchie respectée par `canAccess()`.

#### Statuts modules dans ce doc

- ✅ **Mature** : routes + pages + utilisé activement, sub-nav cohérente
- ⚠️ **Stable mais limité** : structure présente mais sub-modules vides ou TODOs visibles, ou UI compacte vs backend riche
- 🔴 **En chantier** : code commencé mais pas terminé, plusieurs TODOs critiques (aucun module en 🔴 critique actuellement, juste des items 🔴 dans le backlog)
- 🟡 **Legacy / obsolète** : code présent mais peut-être plus utilisé

---

### Maintenance

**Document généré le** : 2026-05-01

**Méthode de génération** : auto-extrait du code via 5 batches Phase 1 (modules détaillés) + Phase 2 (assemblage), avec validation par Vernon à chaque batch.

**Quand mettre à jour ce doc** :
- Après tout sprint qui ajoute / modifie / supprime un module ou sub-module
- Après tout refactor majeur (ex: cleanup dette technique Tasks)
- Tous les 3 mois pour cross-check avec la réalité du code (re-scan complet recommandé)

**Variantes du doc** :
- `FEATURES.md` (master, ce fichier) — vue full Vernon + PM
- `FEATURES_FOR_PM.md` (à générer Phase 3) — full + onboarding 30 jours
- `FEATURES_FOR_ANDY.md` (à générer Phase 3) — Sales/Marketing/CRM only

**Ressources techniques associées** :
- `ARCHITECTURE.md` — stack technique, infra, sécurité
- `MIGRATIONS.md` — pipeline DB
- `README.md` — setup local
- 13 `SPRINT_X_REPORT.md` à la racine — log des sprints récents (Sprint 0 → 3.3)
- `prisma/schema.prisma` — modèle de données complet (70 models)
- `src/lib/crm-config.ts` — conventions CRM centralisées
- `src/lib/permissions.ts` — règles d'accès par module/role
- `src/lib/claude.ts` — prompts Claude centralisés

**Skills à associer** (futur) :
- Si un skill `oxen-os-doc-update` est créé, il doit s'appuyer sur ce doc comme reference d'inventaire et de format.

---

*Fin du document — Oxen OS FEATURES.md v1.0 (2026-05-01)*
