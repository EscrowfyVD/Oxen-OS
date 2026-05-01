# Oxen OS pour Andy — Sales / Marketing / CRM

> Document préparé pour Andy, Head of Sales.
> Lu en 15-20 min. Vue produit limitée à ce que Andy utilise au quotidien.
> Version 1.0 — 2026-05-01.

---

## C'est quoi Oxen OS ?

Notre OS interne. Il fait office de :

- **HubSpot** (CRM, deals, contacts, companies, pipeline)
- **Lemlist dashboard** (mais avec plus de features et notre brand)
- **Calendar de l'équipe** (synchronisé Google Calendar de tout le monde)
- **Hub marketing** (social media metrics, content calendar, compliance check)
- **Assistant AI Sentinel** (préparation meetings + insights deals)

Tu y connectes avec ton `@oxen.finance` pour : suivre ton pipeline, gérer tes contacts, lancer tes campagnes Outreach, voir tes performances, préparer tes meetings.

---

## Ton parcours quotidien type

1. **Le matin (9h)** :
   - [Dashboard](#dashboard) → tu vois tes meetings du jour, tasks overdue, KPIs (Active Clients, Pipeline Value, Monthly Volume)
   - [Sentinel](#sentinel) → Daily Digest + Insights pour la journée (deals à risque, opportunités)

2. **Avant un meeting** :
   - [Sentinel > Briefs](#sub-module-63--meeting-briefs-section-3) → Generate Brief → Claude prépare un brief client
   - [CRM > Contacts](#sub-module-23--contacts-crmcontacts) → tu cherches le contact, lis ses Activities, ses Notes

3. **Après un meeting** :
   - [Calendar](#calendar) → "Prepare Call Notes" → tu remplis le HTML autonome stylé Oxen
   - [CRM > Pipeline](#sub-module-22--pipeline-crm-sub-nav-pipeline) → tu mets à jour le stage du deal (drag & drop)

4. **Dans la journée — gestion outreach** :
   - [CRM > Outreach](#sub-module-25--outreach-crmoutreach) → tu vérifies les health checks domains, deliverability, bounces
   - [CRM > Contacts](#sub-module-23--contacts-crmcontacts) → "Push to Lemlist" sur les leads sélectionnés

5. **Pour le marketing** :
   - [Marketing > Social Media](#sub-module-31--social-media-tab-social) → KPIs followers/impressions
   - [Marketing > Content](#sub-module-32--content-tab-content) → Kanban des idées de contenu
   - [Marketing > Compliance Check](#sub-module-35--compliance-check-tab-compliance) → valide un post avant publication (claims fintech-réglementé)

6. **Tasks de la journée** :
   - [Tasks](#tasks) (vue My Tasks) → drag-and-drop entre To Do / In Progress / Done

---

## Tes modules

Avec le statut de chacun (✅ Mature, ⚠️ Stable mais limité) :

- ✅ [Dashboard](#dashboard) — vue d'ensemble matinale
- ✅ [CRM](#crm) (6 sub-modules) — pipeline, contacts, companies, outreach, reports
- ⚠️ [Marketing](#marketing) (5 sub-modules) — Social Media + Content + Compliance Check (ton focus), SEO/GEO + Veille (Vernon focus)
- ✅ [Sentinel](#sentinel) (3 sub-modules) — AI assistant pour briefs et insights
- ✅ [Calendar](#calendar) — meetings de l'équipe + call notes
- ⚠️ [Tasks](#tasks) (3 vues) — My Tasks pour ton quotidien

---

## Dashboard

**Objectif** : Vue d'ensemble unifiée de l'activité Oxen Finance pour démarrer la journée — KPIs critiques, agenda du jour, et flux d'activité temps réel à travers tous les modules.

**Statut** : ✅ Mature

**URL** : `/`

### Vue d'ensemble

Le Dashboard est la page d'atterrissage par défaut après login. Il agrège des données provenant de plusieurs modules (CRM, Tasks, Calendar, Sentinel) en une vue compacte. Pas de sub-nav — c'est une page unique avec 4 sections empilées : KPIs, Quick Actions, Recent Activity, et Today's Schedule. L'horloge en temps réel (HH:MM:SS) est affichée dans le header. Equivaut au "morning briefing" — tout ce qu'un user doit savoir en 30 secondes en arrivant.

### Features

- **4 KPI Cards animés** (Bellfair serif, counters animés au load) :
  - Active Clients (count)
  - Pipeline Value (€)
  - Monthly Volume (€)
  - Your Open Tasks (count, scope user-spécifique — donc tes tasks à toi, pas celles de l'équipe)

- **Quick Actions** — boutons d'accès rapide vers les pages principales (CRM, Tasks, etc.)

- **Recent Activity Feed** — flux temps réel des 10 derniers événements à travers Oxen OS, typés et icônisés :
  - `client_onboarded`, `meeting_summary`, `task_completed`, `task_created`
  - `wiki_updated`, `sentinel_insight`, `contact_created`, `callnote_generated`
  - Chaque entrée cliquable renvoie vers la ressource concernée
  - Affichage relatif ("just now", "5 min ago", "yesterday")

- **Today's Schedule** — meetings du jour issus de Google Calendar :
  - Heure de début (24h, tabular-nums)
  - Titre du meeting
  - Avatars des attendees (max 5 + "+N")
  - Lien direct vers `/calendar` (View Full Calendar)

### Backlog

- Dashboard hardcoded à 4 KPIs — pas de personnalisation user
- Activity feed limité à 10 entrées (pas de pagination)
- Pas de filtre temporel (today / this week / this month)

---

## CRM

**Objectif** : Tour de contrôle commercial complet — pipeline de deals (9 stages), base contacts/companies enrichie, séquences Outreach via Lemlist, et reporting. Remplace HubSpot dans Oxen OS.

**Statut** : ✅ Mature (riche)

**URL** : `/crm`

### Vue d'ensemble

Le module CRM est de loin le plus dense d'Oxen OS (60+ routes API, 11 pages, 12+ models de données). Sub-nav officielle : 6 sub-modules (Dashboard, Pipeline, Contacts, Companies, Outreach, Reports). Deux features additionnelles vivent comme pages dédiées hors sub-nav principale : Inbox (`/crm/inbox`) et Forecast (`/crm/forecast`).

**Conventions métier (cf. Glossaire)** :
- 9 stages pipeline
- 7 verticals
- 9 geo zones avec auto-assignment
- 3 deal owners (toi, Paul Louis, Vernon)
- 8 outreach groups (GROUP 1 → GROUP 7B)

---

### Sub-module 2.1 — CRM Dashboard (`/crm`, sub-nav `dashboard`)

**Objectif** : Tableau de bord personnel CRM par owner — état du pipeline du user, deals en aging, relations à entretenir.

**Features** :
- Greeting personnalisé selon l'heure ("Good morning / afternoon / evening, Andy")
- Vue scopée à l'owner courant (toi) — Vernon voit l'agrégé tous owners
- Aging des deals en couleur (vert / amber / rouge selon ancienneté du stage)
- Relations strength indicator (cold / warm / hot)
- Activité récente du portefeuille de l'user

---

### Sub-module 2.2 — Pipeline (`/crm`, sub-nav `pipeline`)

**Objectif** : Visualisation Kanban des deals à travers les 9 stages. Drag & drop pour avancer un deal. **Cœur opérationnel quotidien des sales.**

**Features** :
- 3 view modes : **Kanban** (default), **Table**, **Cards**
- **Drag & drop** d'un deal d'un stage à l'autre — déplace automatiquement
- Filtres : Owner, Vertical (multi-select), Source d'acquisition, Geo Zone, Search texte
- **Lost-deal modal** : si tu déplaces un deal en `closed_lost`, modal pour capturer raison + notes (ne pas skip — utile pour reporting)
- Probabilité pondérée par stage (chaque stage a un % de chance de close)
- Aging visuel sur chaque card (couleur du badge selon temps passé dans le stage — pousse à agir sur les vieux deals)
- Couleur per-owner (toi, Paul Louis, Vernon)
- Indicators : KYC status, Outreach group badge, Vertical pills

**Pages connexes** :
- `/crm/[id]` — détail d'un deal individuel (Playbook, AI deal health, full timeline)
- `/crm/inbox` — Inbox des activités entrantes (50 dernières) : email_received, meeting_calendly, whatsapp_message, clay_sequence_event
- `/crm/forecast` — Forecast mensuel pondéré par win probability, charts par stage et par owner

---

### Sub-module 2.3 — Contacts (`/crm/contacts`)

**Objectif** : Base de contacts enrichie avec lifecycle, scoring AI, et synchronisation Lemlist. **C'est ta base 1000+ contacts.**

**Features** :
- 2 view modes : **List** (table inline-éditable) + **Kanban** (par lifecycle stage)
- Persistance du view mode en `localStorage` (donc ton choix est mémorisé)
- **Filtres riches** : Search, Outreach Group, Lifecycle Stage, Deal Owner, Vertical, Geo Zone, Contact Type, Lemlist Campaign
- **Sort** dynamique sur 10 champs (firstName, company, email, lifecycleStage, contactType, geoZone, dealOwner, lastInteraction, totalInteractions, createdAt)
- Pagination (50 contacts/page)
- **CSV Import Wizard** : import bulk avec mapping de colonnes
- **Push to Lemlist Modal** : enrôler N contacts sélectionnés (ou tous filtrés) dans une campagne Lemlist
- ContactSlideOver : panneau latéral d'édition (sans quitter la liste)
- **Affichage Lemlist en colonne** : campaignName, status, step / totalSteps, enrolledAt
- Page détail `/crm/contacts/[id]` avec timeline complet

### AI Features sur Contacts (Sentinel)

- **Lead scoring** : score automatique calculé par Claude
- **Summary** : résumé du contact en quelques lignes pour briefing rapide

---

### Sub-module 2.4 — Companies (`/crm/companies`)

**Objectif** : Annuaire des entreprises (employer ou client) avec rattachement aux contacts et deals.

**Features** :
- Liste de cards avec : nom, industry, HQ country/city, vertical pills, geo zone, domain, website
- **Stats par company** : nombre de contacts liés, nombre de deals actifs, total revenue (deals `closed_won`)
- Filtres : search, vertical, geo zone, industry (8 industries hardcodés : Financial Services, Technology, Legal, Real Estate, Gaming, Consulting, Logistics, Other)
- Page détail `/crm/companies/[id]` avec contacts/deals/intel rattachés

> ⚠️ **Backlog critique connu** : le bouton "+ New Company" n'est pas encore branché (TODO `companies/page.tsx:119`). Pour créer une nouvelle company aujourd'hui, demande à Vernon ou à un dev — pas faisable depuis l'UI.

---

### Sub-module 2.5 — Outreach (`/crm/outreach`)

**Objectif** : Centre de contrôle des campagnes email Outreach (Lemlist) avec monitoring de la deliverability et gestion de la suppression list.

**Features** : 4 sections internes :

**Domains** — gestion des domaines d'envoi :
- Health check par domain : SPF / DKIM / DMARC valid, tracking domain, blacklist status
- Metrics : open rate, reply rate, bounce rate, spam rate, inbox placement (avec couleurs vert / amber / rouge selon seuils)
- Status : `warmup` / `active` / `paused` / `blacklisted`
- Champ `warmupStartDate` calculé en semaines de chauffe

**Campaigns** — campagnes Lemlist :
- Liste avec : name, vertical, owner, domain rattaché, platform (lemlist), status
- Metrics : totalSent, totalOpened, totalClicked, totalReplied, totalBounced, totalUnsubscribed
- Replies catégorisées : `repliesInterested`, `repliesNotInterested`, `repliesOoo`
- Meetings booked depuis la campagne (compteur)

**Suppression List** — emails à ne plus contacter :
- Sources : unsubscribed, bounced, do_not_contact, spam_complaint, manual
- Bulk add + import + export

**Warmup** — état de chauffe des domaines (calculé)

### Webhook entrant Lemlist

`/api/webhooks/lemlist` reçoit les events Lemlist temps réel et incrémente automatiquement les compteurs de la campagne correspondante (HMAC SHA-256 — sécurisé).

---

### Sub-module 2.6 — Reports (`/crm/reports`)

**Objectif** : Rapports de performance commerciaux — pipeline distribution, revenue par source/vertical, performance par owner.

**Features** :
- **4 KPI principaux** : Total Pipeline, Weighted Pipeline, Total Active Deals, Won This Quarter
- **Charts** :
  - Pipeline by stage (BarChart : count + totalValue + weightedTotal)
  - Revenue by source (breakdown des deals `closed_won` par acquisitionSource)
  - Revenue by vertical (breakdown par vertical)
  - Performance per owner (par toi, Paul Louis, Vernon)

---

### Workflow type — Acquisition d'un nouveau lead

1. Lead arrive via formulaire site (`oxen.finance`) → `CrmContact` créé en `lifecycleStage: "new_lead"`
2. **Auto-assignment owner** via le pays du lead (toi, Paul Louis, ou Vernon selon geo zone)
3. **AI scoring** automatique → `relationshipScore` calculé par Claude
4. Tu **push vers une campagne Lemlist** via `PushToLemlistModal` → `lifecycleStage: "sequence_active"`
5. Webhook Lemlist reçoit `emailsSent` → incrémente `lemlistStep`, alimente Activity timeline
6. Webhook Lemlist reçoit `emailsReplied` → `lifecycleStage: "replied"`, ajoute Activity
7. Tu schedule un meeting → `lifecycleStage: "meeting_booked"`
8. **Deal créé manuellement**, avancé dans le pipeline (Kanban drag & drop)
9. Closed won → `OutreachCampaign.meetingsBooked` incrémenté, AuditLog créé

---

## Marketing

**Objectif** : Hub de pilotage marketing — social media metrics, content calendar, génération SEO/GEO assistée par IA, veille concurrentielle, et compliance check des contenus publiés.

**Ton focus quotidien** : Social Media + Content + Compliance Check
**Vernon focus stratégique** : SEO/GEO + Veille (mentionnés ci-dessous mais moins prioritaires pour toi)

**Statut** : ⚠️ Stable mais limité (1 page UI pour 34 routes API — backend riche, surface UI compacte par tabs)

**URL** : `/marketing`

**Contrôle d'accès** : `super_admin` / `admin` OU département `marketing`. Si tu n'as pas accès, demande à Vernon.

### Vue d'ensemble

Le module Marketing est une seule page avec 5 onglets (Social Media, Content, SEO/GEO, Veille, Compliance Check). Le subtitle dynamique du header affiche : `{X} followers · {Y} impressions this month`.

---

### Sub-module 3.1 — Social Media (tab `social`)

**Objectif** : Tracking des metrics social (LinkedIn, Twitter, etc.) avec saisie manuelle hebdomadaire et visualisation tendances.

**Features** :
- **Overview KPIs** : Total Followers, Monthly Impressions, Engagement, Click-through, Posts (Bellfair counters animés)
- **Charts** : LineChart d'évolution + BarChart par platform
- **Saisie manuelle** : modal pour ajouter une entrée hebdomadaire {platform, date, followers, impressions, engagement, clicks, posts}

**Backlog** :
- Saisie manuelle uniquement — pas de sync auto avec LinkedIn/Twitter/Reddit APIs
- Pas de comparaison période-à-période (M-1 vs M)

---

### Sub-module 3.2 — Content (tab `content`)

**Objectif** : Pipeline éditorial (Kanban) des idées de contenu, avec drag & drop entre statuses et compliance check intégré.

**Features** :
- **Kanban** avec colonnes par status — drag & drop entre colonnes
- Status `rejected` séparé (toggle "Show Rejected")
- Bouton "+ New Idea" → modal de création/édition
- Idée avec : title, platform, status, priority, assignee (employé), description, contentText
- **Compliance Check inline** : icône ShieldCheck sur chaque idée → ouvre modal pour analyser le contenu directement

---

### Sub-module 3.3 — SEO / GEO (tab `seo`) — *plutôt Vernon stratégique*

> Note : ce sub-module est principalement utilisé par Vernon pour la stratégie SEO long-terme. Mentionné ici pour info, pas de focus quotidien Andy.

Mini-module dédié à la SEO traditionnelle + GEO (Generative Engine Optimization — visibilité dans les réponses ChatGPT/Claude). 6 sub-tabs internes : Overview, Keywords, Blog Writer (article generation par Claude), GEO Monitor (test si Oxen est cité dans LLM), News Monitor, Reports. Utilise massivement Anthropic.

---

### Sub-module 3.4 — Veille (tab `intel`) — *plutôt Vernon stratégique*

> Note : pour Andy, la veille pertinente concurrents/marketing passe plutôt par le module Intel top-level (`/intel`) qui est AI-powered. Cette section est pour des observations manuelles ad-hoc.

Capture manuelle d'observations marketing (concurrence, tendances, opportunités).

---

### Sub-module 3.5 — Compliance Check (tab `compliance`)

**Objectif** : Validation pré-publication des contenus marketing par règles métier (claims interdits, terminologie réglementée, etc.) — clé pour une fintech VQF-régulée.

**Important** : avant de publier un post LinkedIn / Twitter / blog, **fais passer le contenu par Compliance Check**. Tu évites de violer un claim réglementé (FINMA, FCA, MFSA) sans le savoir.

**Features** :
- Liste des checks effectués (history)
- Création d'un check : platform, contentType, contentText, optional imageUrl
- Lien direct possible vers un Content Idea du tab Content
- **Résultat** : tableau de **Findings** {rule, status: pass / warning / fail, detail, suggestion}

---

## Sentinel

**Objectif** : Assistant IA intégré à Oxen OS — chat conversationnel intelligent, insights automatiques, briefs de meeting, et call notes. **Fil rouge AI cross-module powered by Claude.**

**Statut** : ✅ Mature

**URL** : `/ai`

### Vue d'ensemble

Sentinel est l'assistant AI signature d'Oxen OS — l'entrée sidebar est mise en évidence avec un effet visuel "pulse" + gradient rose-gold. Page composée de 3 sections principales empilées (Chat, Insights, Briefs) + 1 panneau Intel Highlights latéral + 1 modal Daily Digest déclenchable.

**Tagline officiel** : "Sentinel — your AI-powered sales intelligence engine, powered by Claude"

**Deep-link CRM** : Si tu arrives depuis `/crm/contacts/[id]`, le chat pré-remplit le prompt : "Tell me about [Name] — deal status, recent interactions, risks, and opportunities."

---

### Sub-module 6.1 — Chat (Section 1)

**Objectif** : Interface conversationnelle pour interroger Oxen OS en langage naturel.

**Features** :
- Conversation persistée (tu retrouves tes échanges précédents)
- **Quick Actions pré-définies** pour démarrer rapidement
- Markdown-lite renderer custom (titres, listes, gras)
- **Action Blocks** : Sentinel peut renvoyer des boutons cliquables (ex: "Create Task", "Open Contact")
- Historique scrollable

---

### Sub-module 6.2 — Insights (Section 2)

**Objectif** : Insights AI auto-générés sur le pipeline + base contacts (deals à risque, opportunités, contacts dormants à relancer).

**Features** :
- Liste des insights actifs avec : title, summary, severity (critical / high / medium / low), category
- **Run Analysis** button : déclenche une analyse fraîche
- **Dismiss** : marquer un insight comme traité
- **Create Task from Insight** : génère une Task liée (préfixe `[AI]`) avec priority dérivée de severity. La task apparaît dans `/tasks` sous viewMode `my`.

---

### Sub-module 6.3 — Meeting Briefs (Section 3)

**Objectif** : Génération AI de briefs préparatoires avant chaque meeting Calendar — contexte client, deal status, talking points.

**Features** :
- Liste des briefs générés (history) + meetings à venir sans brief
- **Generate Brief** sur un event : Claude prépare un brief client (contexte deal + activities récentes + intent signals)
- **View Brief** : modal avec brief complet
- **Prepare Call Notes** : génère un fichier HTML autonome avec design system Oxen embedded — tu rempliras pendant le meeting

### Daily Digest (transverse)

Bouton "Daily Digest" en header → Claude renvoie un paragraphe de synthèse quotidienne (état pipeline + activité récente + alertes).

### Workflow type — Préparer un meeting client

1. Tu arrives sur `/ai` (ou directement depuis `/crm/contacts/[id]` avec deep-link)
2. Section Briefs montre le meeting du jour (depuis Google Calendar)
3. Click "Generate Brief" → Claude analyse contexte deal + activities récentes + intent signals
4. Brief créé → tu cliques "View Brief" pour voir les talking points
5. Optionnel : "Prepare Call Notes" → génère un template HTML stylé Oxen
6. Post-meeting : retour sur `/calendar/[id]` pour renseigner les notes
7. Refresh : Sentinel learns de la conversation pour insights futurs

---

## Calendar

**Objectif** : Calendrier d'équipe unifié — synchronisation bidirectionnelle Google Calendar, événements internes, absences agrégées, et préparation/archivage des call notes par meeting.

**Statut** : ✅ Mature

**URL** : `/calendar`

### View modes (3)

- **Week** (default) — grille hebdomadaire 7 jours avec slots horaires
- **Day** — agenda détaillé d'une journée
- **Month** — grille calendaire avec events compacts par cellule, click → drill-down vers Day

Navigation : flèches `<` `>` (avec pas adapté au viewMode : ±1 jour / ±7 jours / ±1 mois) + bouton "Today".

### Features

- **Multi-owner display** : événements de tous les members de l'équipe, filtrables individuellement
- **Color-coding par owner** : palette de 8 couleurs cyclées
- **Absences en filigrane** : congés approuvés affichés en arrière-plan pour visualiser qui est en off
- **Sync Google Calendar** : bouton "Sync All" → pull events des comptes Google de l'équipe
- **Création d'événement interne** : differente des events Google Calendar
- **Edit/View event** selon source : interne (éditable) ou Google (read-only)

### Call Notes (feature transverse)

- **Liste call notes** : panel à droite avec recherche
- **Upload HTML** : tu peux importer un fichier HTML existant comme call note
- **Prepare modal** : génère un template HTML autonome via Claude
- **Page détail** `/calendar/[id]` charge le HTML dans une iframe avec data save-back

### Workflow type — Préparer + capturer un meeting

1. Tu vois ton meeting du jour sur `/calendar` (viewMode `day` ou `week`)
2. Click sur un event → modal détails (attendees, meet link, description)
3. Avant le meeting : click "Prepare Call Notes" → ouvre `CallNotesModal`
4. Claude génère un fichier HTML autonome stylé Oxen (template structuré : agenda, attendees, talking points, action items)
5. Pendant le meeting : tu remplis le HTML directement (form intégré, auto-save)
6. Post-meeting : retour sur `/calendar/[id]` pour consultation/édition de la note

---

## Tasks

**Objectif** : Gestion des tâches d'équipe en Kanban — vue personnelle, vue globale, et vue dédiée au Customer Support.

**Statut** : ⚠️ Stable mais limité (3 vues fonctionnelles, dette technique 2 namespaces — pas ton problème, c'est de la dette dev)

**URL** : `/tasks`

### Vue d'ensemble

Tasks est un Kanban classique avec drag & drop entre colonnes.

**Tags système (7)** : `compliance`, `onboarding`, `tech`, `sales`, `legal`, `finance`, `support` — chacun avec couleur dédiée.

**Priorités (3)** : `high` (rouge), `medium` (amber), `low` (gris).

**Indicators temporels** : `OVERDUE` badge rouge sur les tasks dépassées + `Due Today` / `Due This Week` highlightés.

**Indicator off** : si l'assignee est en leave, badge ⚠ amber affiché à côté du nom.

---

### Vue 8.1 — My Tasks (par défaut pour toi)

**Objectif** : Vue personnelle des tasks dont tu es assignee.

**Features** :
- Filtre auto sur ton nom comme assignee
- Kanban 3 colonnes : To Do (red), In Progress (amber), Done (green)
- Filter pills : `["all", "compliance", "onboarding", "tech", "sales", "legal", "finance", "support"]`
- Tri intra-colonne : par priority desc puis deadline asc
- Click sur card → modal d'édition

---

### Vue 8.2 — All Tasks

**Objectif** : Vue globale toutes équipes — toutes les tasks affichées avec assignee visible.

Permet visibilité cross-team (qui fait quoi). Mêmes 3 colonnes que My Tasks.

---

### Vue 8.3 — Customer Support

**Objectif** : Vue dédiée aux tâches liées aux tickets Support — workflow spécifique avec étape "Waiting Client".

**Features** :
- **4 colonnes** au lieu de 3 : To Do, In Progress, **Waiting Client**, Done
- Tasks affichent le nom du client (depuis ticket Support ou contact CRM) avec icône user en couleur teal
- Lien direct "→ View ticket" qui navigue vers le ticket Support

### Workflow type — Tâche depuis un insight Sentinel

1. Sentinel détecte un insight critical (ex: "Deal X dormant depuis 30 jours")
2. Tu cliques "Create Task" sur l'insight
3. La task est créée avec title `[AI] {insight.title}`, priority dérivée de severity
4. Apparaît dans `/tasks` viewMode `my` (column "To Do")
5. Tu drag-and-drop vers "In Progress" → progress
6. Une fois fini, drag vers "Done" — task fermée

---

## Ce qui te manque actuellement

Backlog filtré sur tes modules (Sales / CRM / Marketing). Items non triviaux qui pourraient améliorer ton quotidien.

### 🔴 Critique (bloquant)

- **CRM Companies — bouton "+ New Company" non fonctionnel** : pour créer une nouvelle company, demande à Vernon ou à un dev. **Sprint prioritaire à venir pour fixer.**
- **Coût Anthropic non monitoré** : si Sentinel devient hyper-utilisé, le budget peut exploser sans qu'on le voie. Pas ton problème direct, mais c'est dans la roadmap Vernon.
- **Rate limiting absent sur AI** : Sprint 4 prévu, pas urgent pour toi.

### ⚠️ Important (friction quotidienne)

**CRM** :
- Pas de **bulk-edit** dans la liste contacts (sélection multi-row absente sauf pour Lemlist push)
- Pas de **custom fields** : tout hardcoded dans le model `CrmContact`
- **Mobile responsive** non vérifié (interface dense, optimisée desktop)
- Companies : pas de **bulk import CSV** (vs Contacts qui en a un)
- Industries Companies hardcodées (8 valeurs)

**Marketing** :
- **Surface UI compacte** : 1 page avec 5 tabs pour 34 routes — beaucoup de features backend non visibles
- Social Media : **saisie manuelle** uniquement (pas de sync API auto avec LinkedIn / Twitter / Reddit)
- Content : pas de **scheduler de publication** (statuses manuels)
- Compliance Check : algorithme exact des "rules" pas auditable depuis l'UI (côté Claude prompt)

**Sentinel** :
- Pas de **cache** des prompts Claude (chaque insight = call API fraîche)
- Daily Digest : pas de **scheduled job** pour envoi auto matinal (Telegram bot existe mais pas wired ici)
- Conversations : pas d'**export**, pas de **search** dans l'historique

**Calendar** :
- Pas de **drag-and-drop** pour reschedule events (uniquement edit via modal)
- Recurring events Google : sync OK mais création récurrente in-app pas évidente
- **Conflits de meetings** (deux events overlap) pas highlightés visuellement

**Tasks** :
- Pas de **subtasks** (checklist intra-task)
- Pas de **dépendances** entre tasks (blocked-by)
- Pas de **notifications** (push / email / Telegram) sur task assignée ou overdue
- Pas d'**estimation de durée** / time tracking
- Filtres par assignee absents en vue "all" (que par tag)

### 🟡 Nice-to-have

- Dashboard : pas de personnalisation user des KPIs, activity feed limité à 10 entrées
- CRM `/crm/agents/[id]` : page legacy redirect (concept "agent" fusionné dans Contacts comme `introducer`)

---

## Comment demander une amélioration

1. **Identifie le module concerné** (cf. modules ci-dessus) — utilise le nom officiel : Dashboard, CRM, Marketing, Sentinel, Calendar, Tasks
2. **Décris le problème en 1-2 phrases** : "Je veux X parce que Y"
3. **Donne la fréquence** : 1× par jour ? 1× par semaine ? Une seule fois mais critique ?
4. **Send à Vernon ou au PM** : ils prioriseront dans le backlog
5. **Si urgent** : Telegram direct à Vernon

**Format suggéré** :
```
Module : CRM > Contacts
Problème : Je veux pouvoir bulk-edit le tag "Vertical" sur 50 contacts en même temps
Fréquence : 1-2× par semaine quand je fais du tagging
Pourquoi : aujourd'hui je dois éditer un par un, ça me prend 20 min
```

---

## Glossaire métier

### Pipeline stages CRM (9, dans l'ordre)

`new_lead` → `sequence_active` → `replied` → `meeting_booked` → `meeting_completed` → `proposal_sent` → `negotiation` → `closed_won` / `closed_lost`

### Verticals (7)

- **FinTech/Crypto** — startups financières et crypto
- **Family Office** — gestionnaires de patrimoine pour ultra-high-net-worth
- **CSP/Fiduciaries** — Corporate Service Providers / fiduciaires
- **Luxury Assets** — yacht, art, real estate haut de gamme
- **iGaming** — gaming en ligne, paris sportifs
- **Yacht Brokers** — brokers nautiques (sous-vertical Luxury)
- **Import/Export** — commerce international

### Deal Owners (3)

- **Andy** (toi)
- **Paul Louis**
- **Vernon**

Auto-assignment via geo zone du lead (`getOwnerForGeo()`).

### Outreach Groups (8)

`GROUP 1` → `GROUP 7B` (7 groupes principaux + sous-groupe 7B). Configurés dans `crm-config.ts`.

### Lemlist (Outreach)

- **Sequence Active** — contact engagé dans une campagne
- **Replied** — a répondu à un email de séquence
- **Meeting Booked / Completed** — étapes du pipeline post-séquence
- **Warmup** — période de chauffe d'un domaine d'envoi avant activation campaigns
- **Inbox Placement** — % d'emails arrivant en inbox (vs spam)
- **Bounce Rate** — % d'emails qui n'ont pas pu être délivrés
- **Reply Rate** — % d'emails qui ont reçu une réponse

### Termes Sentinel / AI

- **Sentinel** — assistant AI signature d'Oxen OS
- **Insight** — alerte automatique générée par Claude (deals à risque, opportunités)
- **Brief** — préparation auto avant un meeting (contexte + talking points)
- **Daily Digest** — synthèse quotidienne en 1 paragraphe
- **Action Block** — bouton cliquable que Sentinel peut renvoyer (ex: "Create Task")
- **Call Notes** — fichier HTML autonome stylé pour capture meeting

### Termes business / fintech (utiles à connaître pour les leads)

- **VQF** — SRO suisse de la finance
- **VASP** — Virtual Asset Service Provider (Italy)
- **MSB** — Money Service Business (Canada)
- **MFSA** — Malta Financial Services Authority
- **FINMA** — Swiss Financial Market Supervisory Authority
- **VARA** — Virtual Assets Regulatory Authority (UAE / Dubai)
- **AML / KYC / KYB** — Anti-Money Laundering / Know Your Customer / Business

---

> **Pour creuser plus loin** : si tu as besoin de la vue complète d'Oxen OS (Compliance, Finance, Conferences, Wiki, etc.), demande à Vernon ou ouvre `FEATURES.md` à la racine du repo.

*Fin du document — Oxen OS pour Andy v1.0 (2026-05-01)*
