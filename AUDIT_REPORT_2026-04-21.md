# Oxen OS — Audit complet
**Date :** 2026-04-21
**Repo :** EscrowfyVD/Oxen-OS
**Auditeur :** Claude Code

---

## 📊 Executive Summary

- **Issues critiques (🔴) :** 6
- **Issues majeures (🟠) :** 12
- **Issues mineures (🟡) :** 10
- **Infos (🔵) :** 7

**Score modularité global :** 4.3/8 moyen sur les modules — **À améliorer**

**Top 5 priorités :**
1. 🔴 OAuth tokens (Gmail/Calendar/Drive) stockés en clair dans PostgreSQL
2. 🔴 Webhook Telegram sans vérification de signature
3. 🔴 Aucun header de sécurité (CSP, HSTS, X-Frame-Options) dans next.config.ts
4. 🔴 28 champs `Float` pour des montants financiers au lieu de `Decimal`
5. 🟠 Aucune validation runtime des inputs API (pas de Zod, rien)

**Verdict global :**
Oxen OS est un monolithe Next.js ambitieux et riche en fonctionnalités — 70 modèles Prisma, 18 modules, 4 intégrations externes, 2 workers. La base de code est fonctionnelle et le design system est cohérent. Cependant, le code a été priorisé pour la vélocité au détriment de la sécurité et de la robustesse. Pour une fintech régulée, **6 failles critiques** (tokens en clair, webhooks non vérifiés, absence de headers de sécurité, types Float pour de l'argent) représentent un risque réglementaire et opérationnel immédiat. L'absence totale de tests, de CI/CD et de validation des inputs API constitue une dette technique qui va s'aggraver exponentiellement avec chaque nouveau module.

**Verdict modularité :**
Un développeur externe qui ouvre ce repo comprendrait la structure globale (app/, components/, lib/, api/) grâce à une convention de nommage cohérente. Cependant, l'absence de README par module, de types isolés, de documentation architecturale et de barrels files rend la compréhension de chaque module individuel difficile. Le CRM et le Support sont les mieux structurés. 8 modules sur 18 manquent de composants dédiés ou de config isolée. Les frontières entre modules sont floues — les intégrations (Lemlist, Telegram) ont une couche d'abstraction dans `lib/` (bien), mais les types et la logique métier restent dispersés dans les composants UI.

---

## 🔴 Issues Critiques

### #C1 — OAuth tokens Gmail/Calendar/Drive stockés en clair dans PostgreSQL

- **Catégorie :** Sécurité
- **Localisation :** `prisma/schema.prisma:18-19`, `src/lib/auth.ts:99-112`, `workers/sync-worker/src/index.ts:108-119`
- **Description :** Les tokens OAuth Google (`access_token`, `refresh_token`, `id_token`) sont stockés directement en texte dans la table `Account` sans aucun chiffrement au repos. Les champs sont de type `String @db.Text`.
- **Impact :** En cas de breach de la base PostgreSQL (Railway), un attaquant obtient immédiatement des tokens OAuth valides donnant accès à Gmail, Google Calendar et Google Drive de tous les utilisateurs Oxen. Pour une fintech régulée, c'est une violation potentielle de GDPR et des obligations de protection des données sensibles.
- **Recommandation :** Chiffrer les tokens au repos avec AES-256-GCM avant stockage. Utiliser une clé de chiffrement séparée dans une variable d'environnement (`TOKEN_ENCRYPTION_KEY`). Wrapper Prisma avec un middleware qui chiffre/déchiffre automatiquement.
- **Extrait code :**
  ```prisma
  // prisma/schema.prisma:18-19
  refresh_token     String? @db.Text  // ⚠️ En clair
  access_token      String? @db.Text  // ⚠️ En clair
  ```

### #C2 — Webhook Telegram sans vérification de signature

- **Catégorie :** Sécurité
- **Localisation :** `src/app/api/telegram/webhook/route.ts:1-43`
- **Description :** L'endpoint POST `/api/telegram/webhook` accepte n'importe quel payload JSON sans vérifier la signature Telegram. Aucun header secret, aucun HMAC, aucune validation que la requête vient réellement de Telegram.
- **Impact :** N'importe qui peut envoyer des mises à jour arbitraires au bot : fausses commandes, spam de tickets support (auto-créés ligne 639-663), injection de données CRM. Le middleware autorise ce path (ligne 10 de `middleware.ts`).
- **Recommandation :** Implémenter la vérification par token secret de Telegram (comparer le hash SHA-256 du token bot avec le `X-Telegram-Bot-Api-Secret-Token` header). Alternative : valider `req.headers['x-telegram-bot-api-secret-token']` configuré via `setWebhook({ secret_token })`.
- **Extrait code :**
  ```ts
  // src/app/api/telegram/webhook/route.ts:10-25
  export async function POST(req: Request) {
    const body = await req.json()  // ⚠️ Aucune vérification de signature
    const update: TelegramUpdate = body
    // ... traitement direct
  ```

### #C3 — Aucun header de sécurité HTTP configuré

- **Catégorie :** Sécurité
- **Localisation :** `next.config.ts:1-14`
- **Description :** `next.config.ts` ne configure aucun header de sécurité. Pas de Content-Security-Policy (CSP), pas de Strict-Transport-Security (HSTS), pas de X-Frame-Options, pas de X-Content-Type-Options, pas de Referrer-Policy, pas de Permissions-Policy.
- **Impact :** L'application est vulnérable au clickjacking (iframe embedding), au MIME sniffing, et ne bénéficie d'aucune politique CSP pour mitiger les XSS. Le domaine `os.oxen.finance` ne force pas HSTS.
- **Recommandation :** Ajouter un bloc `headers()` dans `next.config.ts` :
  ```ts
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; ..." },
    ]}]
  }
  ```

### #C4 — Routes seed accessibles publiquement en production

- **Catégorie :** Sécurité
- **Localisation :** `src/middleware.ts:12-14`, `src/app/api/crm/outreach/seed/route.ts`, `src/app/api/seo/seed/route.ts`, `src/app/api/wiki/seed/route.ts`
- **Description :** Trois routes seed sont explicitement whitelistées dans le middleware (contournent l'authentification). N'importe qui peut appeler GET `/api/crm/outreach/seed` pour insérer des données de démo en production.
- **Impact :** Pollution de la base de données de production avec des données fictives. Potentiel déni de service si appelé en boucle.
- **Recommandation :** Retirer ces routes du whitelist middleware. Protéger avec `requireAdmin()` ou conditionner à `NODE_ENV !== "production"`. Idéalement, les seed routes n'existent pas du tout en production.
- **Extrait code :**
  ```ts
  // src/middleware.ts:12-14
  pathname === "/api/crm/outreach/seed" ||  // ⚠️ Public en prod
  pathname === "/api/seo/seed" ||           // ⚠️ Public en prod
  pathname === "/api/wiki/seed" ||          // ⚠️ Public en prod
  ```

### #C5 — Float utilisé pour tous les montants financiers (28 champs)

- **Catégorie :** Base de Données
- **Localisation :** `prisma/schema.prisma` — lignes 237, 278, 378, 384-385, 507, 523-526, 554, 573, 585, 958-963, 1144
- **Description :** 28 champs monétaires utilisent `Float` au lieu de `Decimal`. Exemples : `Company.totalRevenue`, `Deal.dealValue`, `Deal.weightedValue`, `FinanceEntry.amount`, `FinanceTransaction.amount`, `FinanceTransaction.amountEur`, `BankAccount.currentBalance`, `FinanceBudget.amount`, tous les coûts de conférence (`ticketCost`, `hotelCost`, etc.).
- **Impact :** Erreurs d'arrondi sur les calculs financiers (IEEE 754). Pour une fintech, `0.1 + 0.2 !== 0.3` peut causer des écarts de réconciliation, des erreurs de reporting financier, et des problèmes de conformité.
- **Recommandation :** Migrer tous les champs monétaires vers `Decimal @db.Decimal(19, 4)`. Commencer par `FinanceTransaction.amount`, `BankAccount.currentBalance`, `Deal.dealValue`.
- **Extrait code :**
  ```prisma
  // prisma/schema.prisma
  amount      Float     // ⚠️ FinanceEntry:507
  amount      Float     // ⚠️ FinanceTransaction:523
  amountEur   Float?    // ⚠️ FinanceTransaction:526
  currentBalance Float  // ⚠️ BankAccount:573
  dealValue   Float?    // ⚠️ Deal:378
  ```

### #C6 — NextAuth debug mode activé en production

- **Catégorie :** Sécurité
- **Localisation :** `src/lib/auth.ts:129`
- **Description :** `debug: true` est activé inconditionnellement dans la config NextAuth. En production, cela logue des informations sensibles sur les flows OAuth dans les logs Railway.
- **Impact :** Les logs de production contiennent des détails de session, de callback, et potentiellement des fragments de tokens. Accessible à quiconque a accès aux logs Railway.
- **Recommandation :** Conditionner : `debug: process.env.NODE_ENV !== "production"`.
- **Extrait code :**
  ```ts
  // src/lib/auth.ts:129
  debug: true,  // ⚠️ Activé en production
  ```

---

## 🟠 Issues Majeures

### #M1 — Aucune validation runtime des inputs API (pas de Zod)

- **Catégorie :** Sécurité / Qualité
- **Localisation :** Toutes les routes API sous `src/app/api/`
- **Description :** Zéro instance de `z.object`, `z.string` ou toute autre bibliothèque de validation runtime. Les body JSON et les searchParams sont utilisés directement sans validation de schéma. `zod` est installé comme dépendance transitive mais jamais importé dans le code applicatif.
- **Impact :** Inputs malformés peuvent causer des erreurs runtime non gérées, des insertions de données invalides en base, et potentiellement des injections.
- **Recommandation :** Implémenter Zod sur toutes les routes API. Priorité : routes qui écrivent en base (POST/PUT/PATCH).

### #M2 — 20+ requêtes Prisma sans pagination (findMany sans take)

- **Catégorie :** Performance / Base de Données
- **Localisation :** `src/app/api/crm/health/route.ts`, `src/app/api/crm/forecast/route.ts`, `src/app/api/ai/auto-insights/route.ts`, `src/app/api/crm/deals/route.ts`, `src/app/api/crm/tasks/route.ts`, `src/app/api/leaves/route.ts`, `src/app/api/call-notes/route.ts`, `src/app/api/calendar/owners/route.ts`, et 12+ autres.
- **Description :** Plus de 20 routes utilisent `prisma.*.findMany()` sans `take` ni pagination sur des tables qui vont croître (CrmContact, Deal, Activity, Email, LeaveRequest).
- **Impact :** Au-delà de quelques milliers de contacts/deals, les réponses API vont ralentir exponentiellement, consommer toute la mémoire du serveur, et potentiellement crasher le pod Railway.
- **Recommandation :** Ajouter `take: 50` (ou paramétrable) + cursor-based pagination sur toutes les requêtes `findMany`.

### #M3 — XSS via dangerouslySetInnerHTML sans sanitisation

- **Catégorie :** Sécurité
- **Localisation :** `src/app/wiki/[slug]/page.tsx:219,244`, `src/app/wiki/page.tsx:525,559`, `src/components/seo/BlogWriterTab.tsx:803`
- **Description :** 8 instances de `dangerouslySetInnerHTML`. Les pages Wiki utilisent un remplacement regex naïf (`item.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")`) qui ne sanitise pas les inputs. Le BlogWriter rend du contenu HTML brut depuis la base.
- **Impact :** Si un contenu Wiki ou un article contient du JavaScript malicieux (`<script>` ou attributs `onerror`), il sera exécuté dans le navigateur de tout utilisateur qui consulte la page.
- **Recommandation :** Installer `dompurify` et sanitiser tout HTML avant le rendu : `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}`.
- **Extrait code :**
  ```tsx
  // src/app/wiki/[slug]/page.tsx:219
  <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
  // ⚠️ Pas de sanitisation — input arbitraire rendu en HTML
  ```

### #M4 — Aucun error boundary (loading.tsx, error.tsx, not-found.tsx)

- **Catégorie :** Architecture / UI
- **Localisation :** Aucun fichier `loading.tsx`, `error.tsx` ou `not-found.tsx` trouvé dans tout le repo
- **Description :** Next.js App Router permet des error boundaries et loading states par segment de route. Aucun n'est implémenté. Un seul `layout.tsx` existe à la racine.
- **Impact :** Une erreur dans n'importe quel module crash l'application entière au lieu d'isoler le problème. Pas de fallback loading pendant le chargement des données côté serveur. L'UX en cas d'erreur est un écran blanc.
- **Recommandation :** Créer `loading.tsx` et `error.tsx` au minimum pour : `/crm`, `/finance`, `/compliance`, `/marketing`, `/support`.

### #M5 — Aucune suite de tests et aucun CI/CD

- **Catégorie :** Qualité / DevOps
- **Localisation :** Racine du projet — pas de `jest.config.*`, pas de `vitest.config.*`, pas de `.github/workflows/`, pas de dossier `__tests__/` dans `src/`
- **Description :** Zéro test unitaire, zéro test d'intégration, zéro test E2E. Aucun fichier de configuration de test. Aucune pipeline CI/CD GitHub Actions. Le seul filet de sécurité est `npx next build` avant push (mentionné dans CLAUDE.md mais non automatisé).
- **Impact :** Chaque changement est un risque de régression. Impossible de refactorer avec confiance. Pas de validation automatisée avant merge.
- **Recommandation :** Sprint 1 : configurer Vitest + GitHub Actions (`on: push` → lint + build + test). Sprint 2 : tests sur les routes API critiques (auth, finance, CRM mutations).

### #M6 — README générique, pas de .env.example

- **Catégorie :** DevOps / Documentation
- **Localisation :** `README.md` (template create-next-app), absence de `.env.example`
- **Description :** Le README est le template par défaut de `create-next-app`, mentionnant Vercel et Geist font. Il ne décrit ni l'architecture, ni les modules, ni comment démarrer. Il n'y a pas de fichier `.env.example` — un nouveau développeur ne sait pas quelles variables d'environnement configurer (il y en a 15+).
- **Impact :** Onboarding impossible pour un développeur externe. Variables d'environnement manquantes en local → crash au démarrage.
- **Recommandation :** Réécrire le README avec : description du projet, architecture, liste des modules, instructions de setup. Créer `.env.example` avec toutes les variables référencées dans le code.

### #M7 — Aucun rate limiting sur les endpoints AI

- **Catégorie :** Sécurité / Performance
- **Localisation :** `src/app/api/ai/chat/route.ts`, `src/app/api/wiki/ask/route.ts`, `src/app/api/marketing/compliance-check/route.ts`, `src/app/api/crm/ai/check-followups/route.ts`
- **Description :** CLAUDE.md spécifie "max 10 requests/minute per user" pour les endpoints AI. Ce n'est implémenté nulle part. Aucun middleware de rate limiting n'existe.
- **Impact :** Un utilisateur (ou un script) peut spammer l'API Anthropic sans limite, causant des coûts incontrôlés et un potentiel déni de service.
- **Recommandation :** Implémenter un rate limiter in-memory (ou Redis) sur tous les endpoints `/api/ai/*`. 10 req/min/user comme spécifié.

### #M8 — Webhook Clay : implémentation faible (silent fail)

- **Catégorie :** Sécurité
- **Localisation :** `src/app/api/webhooks/clay/route.ts:5-8`
- **Description :** Si le secret ne matche pas, la route retourne `200 OK` silencieusement au lieu de `401`. De plus, si `CLAY_WEBHOOK_SECRET` n'est pas défini (env var manquante), la condition `process.env.CLAY_WEBHOOK_SECRET && ...` est false, donc **tous les webhooks passent**.
- **Impact :** Un attaquant peut injecter de faux signaux d'enrichissement Clay (intent signals) qui affectent le scoring ICP des contacts CRM.
- **Recommandation :** Retourner `401 Unauthorized` en cas de secret invalide. Rendre `CLAY_WEBHOOK_SECRET` obligatoire (crash au démarrage si absent). Implémenter HMAC-SHA256 (copier le pattern Lemlist).
- **Extrait code :**
  ```ts
  // src/app/api/webhooks/clay/route.ts:5-8
  const secret = req.headers.get("x-webhook-secret")
  if (process.env.CLAY_WEBHOOK_SECRET && secret !== process.env.CLAY_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true })  // ⚠️ Retourne 200 OK même si secret invalide
  }
  ```

### #M9 — 5 patterns N+1 identifiés

- **Catégorie :** Performance
- **Localisation :** `src/app/api/intel/researches/route.ts:74-88`, `src/app/api/kpi/route.ts:13-28`, `src/app/api/finance/reports/route.ts:152-178`, `src/app/api/seo/geo/run-tests/route.ts`, `src/app/api/email/sync/route.ts`
- **Description :** Pattern typique : `findMany` suivi de `Promise.all(results.map(async item => prisma.*.findMany/count(...)))`. L'exemple le plus flagrant est `intel/researches` qui fait 2 `count()` par research dans la boucle.
- **Impact :** Multiplie le nombre de requêtes DB par le nombre d'éléments. 100 researches = 200 requêtes supplémentaires.
- **Recommandation :** Utiliser `include` avec `_count`, ou regrouper les requêtes en batch.

### #M10 — Pas de dossier Prisma migrations — utilisation de `db push` en production

- **Catégorie :** Base de Données / DevOps
- **Localisation :** `prisma/` — pas de dossier `migrations/`, `package.json:10` script `db:push`
- **Description :** Le dossier `prisma/migrations/` n'existe pas. Le script `db:push` utilise `prisma db push`, et CLAUDE.md recommande `prisma db push --accept-data-loss` en production. Il n'y a pas d'historique de migrations.
- **Impact :** Impossible de rollback un changement de schéma. `--accept-data-loss` peut supprimer des colonnes/tables sans avertissement. Aucune traçabilité des changements de schéma.
- **Recommandation :** Migrer vers `prisma migrate dev` en local et `prisma migrate deploy` en production. Committer le dossier `migrations/`.

### #M11 — Logging uniquement via console.log, aucun observability

- **Catégorie :** DevOps
- **Localisation :** Tout le codebase (200+ `console.log`, `console.error`)
- **Description :** Pas de logger structuré (pino, winston). Pas de Sentry ou error tracking. Pas de métriques APM. Les workers et l'app principale utilisent uniquement `console.log`.
- **Impact :** Debugging en production = lire les logs Railway en texte brut. Impossible de tracer une requête à travers les services. Aucune alerte automatique sur les erreurs.
- **Recommandation :** Installer pino pour le logging structuré. Ajouter Sentry pour l'error tracking. Configurer des alertes Railway sur les crashs.

### #M12 — Application non responsive (desktop uniquement)

- **Catégorie :** UI/UX
- **Localisation :** Tout le front-end — 3 occurrences de media queries dans tout le codebase
- **Description :** L'application n'a quasiment aucun breakpoint responsive. Les largeurs sont fixées en pixels (sidebar 220px, modals 620px, etc.). Pas de `@media` queries, pas de breakpoints Tailwind.
- **Impact :** L'application est inutilisable sur mobile et tablette. Les tableaux CRM, les modals et la sidebar débordent.
- **Recommandation :** Prioriser la vue mobile pour les pages critiques : Dashboard, CRM pipeline, Tasks.

---

## 🟡 Issues Mineures

### #m1 — 31 instances de type `any` explicite
**Localisation :** `src/app/api/calendar/events/route.ts:21`, `src/app/api/events/route.ts:25,56`, `src/app/api/dashboard/route.ts:97`, `src/app/api/webhooks/n8n/route.ts:40`, `src/components/finance/ReportsTab.tsx` (10+ instances), `src/components/marketing/OverviewTab.tsx:35,40`
**Impact :** Réduit la type safety. Les `any` dans les composants Recharts (tooltip props) sont justifiés. Les `any` dans les routes API (dynamic `where` objects) ne le sont pas.
**Recommandation :** Remplacer par `Record<string, unknown>` ou interfaces spécifiques.

### #m2 — 20+ fichiers de plus de 500 lignes (10 dépassent 1000 lignes)
**Localisation :** `src/app/intel/page.tsx` (2348), `src/app/compliance/page.tsx` (2017), `src/app/conferences/[id]/page.tsx` (1567), `src/app/conferences/page.tsx` (1426), `src/app/tasks/page.tsx` (1390), `src/components/seo/BlogWriterTab.tsx` (1374), `src/components/crm/CsvImportWizard.tsx` (1331), `src/components/crm/PersonalDashboard.tsx` (1246), `src/app/team/page.tsx` (1175), `src/app/wiki/page.tsx` (1134), `src/app/api/telegram/webhook/route.ts` (938)
**Recommandation :** Extraire les sous-composants. Par exemple, `intel/page.tsx` (2348 lignes) devrait avoir ses sections dans `src/components/intel/`.

### #m3 — Fonts non optimisées (pas de next/font)
**Localisation :** `src/app/layout.tsx`, toutes les pages
**Description :** Bellfair et DM Sans sont chargées via des imports CSS/inline (`fontFamily: "'Bellfair', serif"`) au lieu d'utiliser `next/font/google` qui précharge et optimise les fonts.
**Recommandation :** Utiliser `import { Bellfair, DM_Sans } from 'next/font/google'`.

### #m4 — Accessibilité minimale
**Localisation :** Tout le front-end
**Description :** 2 fichiers avec `aria-label`, 4 occurrences de `htmlFor`, 4 occurrences de `role=`. La grande majorité des inputs, boutons et modals n'ont pas de labels d'accessibilité.
**Recommandation :** Audit WCAG 2.1 AA. Priorité : modals (tab trap, Esc), formulaires (labels), navigation (landmarks).

### #m5 — 69+ fichiers avec couleurs hardcodées au lieu de CSS variables
**Localisation :** `src/components/crm/constants.ts`, `src/components/marketing/constants.ts`, `src/components/support/constants.ts`, `src/components/finance/constants.ts`, `src/components/absences/constants.ts`, et 64+ composants
**Description :** Malgré un système de variables CSS complet dans `globals.css` (150+ variables, dark/light), de nombreux composants utilisent des constantes hardcodées (`#0D0F14`, `rgba(255,255,255,0.06)`, etc.) au lieu de `var(--xxx)`.
**Recommandation :** Migrer progressivement les `constants.ts` de chaque module pour utiliser les CSS variables. Les modals CRM viennent d'être corrigés — appliquer le même pattern aux autres modules.

### #m6 — Worker Telegram : état en mémoire (pendingNotes Map)
**Localisation :** `src/app/api/telegram/webhook/route.ts:28-31`
**Description :** Un `Map<chatId, pendingNote>` en mémoire stocke les notes de réunion en attente d'association à un contact. Perdu au redémarrage du pod.
**Recommandation :** Persister dans la base (table `PendingTelegramNote`) ou utiliser le `Job` queue.

### #m7 — Lemlist webhook accepte tout si secret vide
**Localisation :** `src/app/api/webhooks/lemlist/route.ts:25-26`
**Description :** Si `LEMLIST_WEBHOOK_SECRET` est vide (env var non définie), le webhook accepte toutes les requêtes sans vérification.
**Recommandation :** Rendre le secret obligatoire. Rejeter si non configuré.

### #m8 — Trigify/N8N webhooks : même pattern faible que Clay
**Localisation :** `src/app/api/webhooks/trigify/route.ts:6`, `src/app/api/webhooks/n8n/route.ts:6`
**Description :** Même pattern `if (process.env.XXX_SECRET && secret !== ...)` — si la variable d'env n'est pas définie, tous les webhooks passent.
**Recommandation :** Rendre les secrets obligatoires ou rejeter par défaut.

### #m9 — Pas de révocation de token OAuth au logout
**Localisation :** `src/lib/auth.ts`
**Description :** Le flow de logout NextAuth supprime la session locale mais ne révoque pas les tokens Google côté upstream. Les access/refresh tokens restent valides dans la table Account.
**Recommandation :** Ajouter un événement `signOut` qui appelle l'endpoint de révocation Google : `https://oauth2.googleapis.com/revoke?token=`.

### #m10 — Pas de monitoring des coûts/tokens API Claude
**Localisation :** `workers/ai-worker/src/index.ts`, `src/lib/claude.ts`
**Description :** Aucun tracking du nombre de tokens consommés par requête, par user, ou par mois. Pas de budget ou d'alerte.
**Recommandation :** Logger les `usage.input_tokens` et `usage.output_tokens` de chaque réponse Anthropic. Stocker dans une table `AIUsage` pour monitoring.

---

## 🔵 Infos / Suggestions

### #i1 — Singleton Prisma correctement implémenté ✓
`src/lib/prisma.ts` utilise le pattern `globalForPrisma` recommandé pour éviter les connection leaks en dev mode.

### #i2 — Table AuditLog existante ✓
`prisma/schema.prisma:477-487` — Un modèle `AuditLog` existe avec `entityType`, `entityId`, `action`, `field`, `oldValue`, `newValue`, `performedBy`. Bonne pratique pour une fintech. **À vérifier :** est-il réellement utilisé à chaque mutation ? (Probablement non systématiquement.)

### #i3 — TypeScript strict mode activé ✓
`tsconfig.json:7` — `"strict": true` est activé. Bon.

### #i4 — Zéro @ts-ignore / @ts-expect-error ✓
Aucune instance trouvée. Le code ne contourne pas le type checker.

### #i5 — Couche d'abstraction pour les intégrations dans lib/ ✓
`src/lib/telegram.ts`, `src/lib/lemlist.ts`, `src/lib/google-calendar.ts`, `src/lib/google-drive.ts`, `src/lib/claude.ts` — Les clients d'API externes sont centralisés dans `lib/`. C'est la bonne approche.

### #i6 — Job queue atomique avec FOR UPDATE SKIP LOCKED ✓
`src/lib/job-queue.ts` et `workers/ai-worker/src/index.ts` utilisent `$queryRaw` avec `FOR UPDATE SKIP LOCKED` pour une gestion concurrente des jobs. Pattern solide.

### #i7 — Restriction de domaine email sur l'auth ✓
`src/lib/auth.ts:77` — Seuls les emails `@oxen.finance` peuvent se connecter. Bonne protection.

---

## 🧩 Modularité & Indépendance des modules

### Scorecard d'indépendance (sur 8 critères)

| Module | Dossier dédié | README | Composants isolés | Types isolés | Pas d'import cross-module | Tables préfixées | Intégrations abstraites | Testable isolément | Score |
|---|---|---|---|---|---|---|---|---|---|
| **Dashboard** | ✅ `src/app/page.tsx` | ❌ | ✅ `components/dashboard/` | ❌ | ✅ | N/A (KpiEntry) | ✅ | ❌ | 3/8 |
| **Sentinel AI** | ✅ `src/app/ai/` | ❌ | ✅ `components/ai/` | ❌ | ✅ | ✅ AI* prefix | ✅ `lib/claude.ts` | ❌ | 4/8 |
| **Tasks** | ✅ `src/app/tasks/` | ❌ | ❌ (dans page.tsx) | ❌ | ✅ | ❌ (Task, CrmTask) | N/A | ❌ | 2/8 |
| **Calendar** | ✅ `src/app/calendar/` | ❌ | ✅ `components/calendar/` | ❌ | ✅ | ❌ (CalendarEvent) | ✅ `lib/google-calendar.ts` | ❌ | 4/8 |
| **CRM** | ✅ `src/app/crm/` | ❌ | ✅ `components/crm/` (32 files) | ❌ (dans composants) | ⚠️ (importe Marketing SEO) | ✅ Crm* prefix | ✅ `lib/lemlist.ts` | ❌ | 5/8 |
| **Marketing** | ✅ `src/app/marketing/` | ❌ | ✅ `components/marketing/` | ❌ | ⚠️ (SEO imbriqué) | ❌ (noms mixtes) | N/A | ❌ | 3/8 |
| **Intel** | ✅ `src/app/intel/` | ❌ | ❌ (dans page.tsx 2348L) | ❌ | ✅ | ✅ Intel* prefix | N/A | ❌ | 3/8 |
| **Conferences** | ✅ `src/app/conferences/` | ❌ | ❌ (dans page.tsx) | ❌ | ✅ | ✅ Conference* prefix | N/A | ❌ | 3/8 |
| **Finance** | ✅ `src/app/finance/` | ❌ | ✅ `components/finance/` | ❌ | ✅ | ✅ Finance* prefix | N/A | ❌ | 4/8 |
| **Compliance** | ✅ `src/app/compliance/` | ❌ | ❌ (dans page.tsx 2017L) | ❌ | ✅ | ❌ (Policy, Risk, Training) | N/A | ❌ | 2/8 |
| **Support** | ✅ `src/app/support/` | ❌ | ✅ `components/support/` | ❌ | ✅ | ✅ Support* prefix | N/A | ❌ | 4/8 |
| **Wiki** | ✅ `src/app/wiki/` | ❌ | ✅ `components/wiki/` | ❌ | ✅ | ✅ Wiki* prefix | N/A | ❌ | 4/8 |
| **Team** | ✅ `src/app/team/` | ❌ | ❌ (dans page.tsx 1175L) | ❌ | ✅ | ❌ (Employee) | N/A | ❌ | 2/8 |
| **Organigramme** | ✅ `src/app/org/` | ❌ | ✅ `components/org/` | ❌ | ✅ | ✅ OrgEntity | N/A | ❌ | 4/8 |
| **Absences** | ✅ `src/app/absences/` | ❌ | ✅ `components/absences/` | ❌ | ✅ | ✅ Leave* prefix | N/A | ❌ | 4/8 |
| **Roles** | ❌ (dans lib/) | ❌ | ❌ | ❌ | ✅ | N/A | N/A | ❌ | 1/8 |
| **Telegram Bot** | ❌ (dans api/telegram/) | ❌ | ❌ | ❌ | ⚠️ (accède CRM, Calendar) | N/A | ✅ `lib/telegram.ts` | ❌ | 2/8 |
| **Outreach** | ✅ `src/app/crm/outreach/` | ❌ | ❌ (dans page.tsx) | ❌ | ✅ | ✅ Outreach* prefix | ✅ `lib/lemlist.ts` | ❌ | 4/8 |

**Score moyen : 3.2/8** — **À améliorer**

### Matrice de couplage inter-module

| Module importe → | CRM | Marketing | Finance | Calendar | Telegram | Support | lib/ (shared) |
|---|---|---|---|---|---|---|---|
| **CRM** | - | ⚠️ SEO intégré | ✗ | ✗ | ✗ | ✗ | ✅ auth, prisma, lemlist |
| **Marketing** | ✗ | - | ✗ | ✗ | ✗ | ✗ | ✅ claude |
| **Finance** | ✗ | ✗ | - | ✗ | ✗ | ✗ | ✅ prisma |
| **Compliance** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ prisma |
| **Support** | ✅ contactId | ✗ | ✗ | ✗ | ✗ | - | ✅ prisma, telegram |
| **Calendar** | ✗ | ✗ | ✗ | - | ✗ | ✗ | ✅ google-calendar |
| **Telegram Bot** | ✅ accès CRM | ✗ | ✗ | ✅ accès Calendar | - | ✅ crée tickets | ✅ prisma, telegram |
| **Dashboard** | ✅ lit KPIs | ✗ | ✅ lit FinanceEntry | ✅ lit events | ✗ | ✅ lit tickets | ✅ prisma |

*Le Telegram Bot est le module le plus couplé — il accède directement aux données CRM, Calendar et Support.*

### Top refactors structurels recommandés

1. **Intel page.tsx (2348L)** → Extraire dans `src/components/intel/` — effort : 1 jour
2. **Compliance page.tsx (2017L)** → Extraire dans `src/components/compliance/` — effort : 1 jour
3. **Telegram webhook (938L)** → Découper en handlers par commande dans `src/lib/telegram/commands/` — effort : 2 jours
4. **SEO dans Marketing** → Séparer en module indépendant `src/app/seo/` — effort : 0.5 jour
5. **Ajouter README par module** → 18 fichiers à créer — effort : 1 jour

### Plan de migration vers une structure propre

1. **Phase 1 (immédiat) :** Créer `.env.example`, réécrire README.md, ajouter `ARCHITECTURE.md`
2. **Phase 2 (1 semaine) :** Extraire les pages monolithes (>1000L) en composants — Intel, Compliance, Conferences, Tasks, Team
3. **Phase 3 (2 semaines) :** Créer `README.md` par module, isoler les types dans des fichiers `types.ts` dédiés
4. **Phase 4 (1 mois) :** Découper le Telegram webhook en handlers modulaires, séparer SEO de Marketing
5. **Phase 5 (long terme) :** Ajouter ESLint rules `import/no-internal-modules` pour maintenir les frontières

---

## 📋 Inventaire

### Modules

| Module | Route | Composants | Routes API | Tables Prisma | État |
|---|---|---|---|---|---|
| Dashboard | `/` (page.tsx) | `components/dashboard/` (5) | `/api/dashboard/`, `/api/kpi/` | KpiEntry, ActivityLog | ✅ Complet |
| Sentinel AI | `/ai` | `components/ai/` (5) | `/api/ai/` (5 routes) | AIInsight, AIConversation, CompanyIntel, MeetingBrief, AIFollowUp | ✅ Complet |
| Tasks | `/tasks` | Inline (page.tsx) | `/api/tasks/` | Task, CrmTask | ⚠️ Minimal |
| Calendar | `/calendar` | `components/calendar/` (3) | `/api/calendar/`, `/api/events/`, `/api/call-notes/` | CalendarEvent, InternalEvent, CallNote | ✅ Complet |
| CRM | `/crm` | `components/crm/` (32 files) | `/api/crm/` (15+ routes), `/api/contacts/`, `/api/deals/` | CrmContact, Deal, Company, Activity, PlaybookStep, SmartView, AuditLog | ✅ Complet |
| Marketing | `/marketing` | `components/marketing/` (9) | `/api/marketing/` | SocialMetrics, ContentIdea, ContentComplianceCheck, MarketingIntel | ✅ Complet |
| SEO/GEO | Imbriqué dans Marketing | `components/seo/` (7) | `/api/seo/` (8+ routes) | Keyword, Article, GeoTestPrompt, GeoTestResult, SeoAlert, NewsSource, NewsItem | ✅ Complet |
| Intel | `/intel` | Inline (page.tsx 2348L) | `/api/intel/` | IntelResearch, IntelResult | ⚠️ Fonctionnel |
| Conferences | `/conferences` | Inline (page.tsx) | `/api/conferences/` | Conference, ConferenceAttendee, ConferenceContact, ConferenceReport | ⚠️ Fonctionnel |
| Finance | `/finance` | `components/finance/` (10) | `/api/finance/` | FinanceEntry, FinanceTransaction, FinanceBudget, BankAccount, FinanceGoal | ✅ Complet |
| Compliance | `/compliance` | Inline (page.tsx 2017L) | `/api/compliance/` | Policy, PolicyVersion, Risk, Training, TrainingCompletion, RegulatoryLicense, ComplianceIncident, ScreeningRecord | ⚠️ Fonctionnel |
| Support | `/support` | `components/support/` (5) | `/api/support/` | SupportTicket, SupportMessage | ✅ Complet |
| Wiki | `/wiki` | `components/wiki/` (4) | `/api/wiki/` | WikiPage, WikiVersion | ✅ Complet |
| Team | `/team` | Inline (page.tsx 1175L) | `/api/employees/` | Employee | ⚠️ Fonctionnel |
| Organigramme | `/org` | `components/org/` (2) | `/api/org-entities/` | OrgEntity | ✅ Complet |
| Absences | `/absences` | `components/absences/` (6) | `/api/leaves/` | LeaveRequest, LeaveBalance, LeaveRules | ✅ Complet |
| Outreach | `/crm/outreach` | Inline (page.tsx) | `/api/crm/outreach/` (13 routes) | OutreachDomain, OutreachCampaign, SuppressionEntry, OutreachAlert | ✅ Complet |
| Telegram Bot | N/A (API only) | N/A | `/api/telegram/` (6 routes) | N/A (uses Employee) | ✅ Complet |

### Intégrations

| Intégration | Fichiers clés | Tokens storage | Rate limit | Webhook signature | État |
|---|---|---|---|---|---|
| **Google OAuth** | `lib/auth.ts`, `lib/google-calendar.ts`, `lib/google-drive.ts` | 🔴 Plaintext DB | N/A | N/A | ⚠️ Tokens non chiffrés |
| **Telegram Bot** | `lib/telegram.ts`, `api/telegram/webhook/route.ts` (938L) | env var | ❌ | 🔴 Aucune | ⚠️ Webhook non vérifié |
| **Lemlist** | `lib/lemlist.ts`, `api/webhooks/lemlist/route.ts`, `api/lemlist/sync/route.ts` | env var (Basic auth) | ✅ 200ms delay | ✅ HMAC-SHA256 + timingSafeEqual | ✅ Bien implémenté |
| **Clay** | `api/webhooks/clay/route.ts` | env var | ❌ | 🟠 Header simple + silent fail | ⚠️ Faible |
| **Anthropic Claude** | `lib/claude.ts`, `workers/ai-worker/src/index.ts` | env var | ❌ Aucun | N/A | ⚠️ Pas de rate limit |
| **Trigify** | `api/webhooks/trigify/route.ts` | env var | ❌ | 🟠 Header optionnel | ⚠️ Faible |
| **N8N** | `api/webhooks/n8n/route.ts` | env var | ❌ | 🟠 Header optionnel | ⚠️ Faible |

### Schéma Prisma

- **Nombre de modèles :** 70
- **Modèles avec indexes manquants :** `CrmContact` (pas d'index sur `email` en dehors du `@unique`, manque indexes sur `lifecycleStage`, `dealOwner`, `geoZone`, `companyId`), `Deal` (pas d'index sur `stage`, `dealOwner`, `contactId`), `Activity` (pas d'index sur `contactId`, `dealId`, `createdAt`), `Email` (pas d'index sur `contactId`, `date`)
- **Modèles sans relations :** `KpiEntry`, `ActivityLog`, `FinanceGoal`, `SeoAlert`, `ScreeningRecord` (standalone tables)
- **Tables financières utilisant Float :** FinanceEntry, FinanceTransaction, FinanceBudget, BankAccount, FinanceGoal, Deal, Company, ConferenceAttendee (coûts)

### Variables d'environnement référencées

| Variable | Fichier(s) | Obligatoire | Documentée |
|---|---|---|---|
| `DATABASE_URL` | `prisma/schema.prisma` | ✅ | ❌ |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | `src/lib/auth.ts` | ✅ | ❌ |
| `NEXTAUTH_URL` | `src/lib/auth.ts` | ✅ | ❌ |
| `GOOGLE_CLIENT_ID` | `src/lib/auth.ts`, `src/lib/google-calendar.ts` | ✅ | ❌ |
| `GOOGLE_CLIENT_SECRET` | `src/lib/auth.ts`, `src/lib/google-calendar.ts` | ✅ | ❌ |
| `TELEGRAM_BOT_TOKEN` | `src/lib/telegram.ts`, webhook routes | ✅ | ❌ |
| `TELEGRAM_WEBHOOK_URL` | `src/app/api/telegram/setup/route.ts` | ✅ | ❌ |
| `TELEGRAM_SEO_CHAT_ID` | `src/app/api/seo/articles/` | ❌ | ❌ |
| `LEMLIST_API_KEY` | `src/lib/lemlist.ts`, enroll/remove routes | ✅ | ❌ |
| `LEMLIST_WEBHOOK_SECRET` | `src/app/api/webhooks/lemlist/route.ts` | ✅ | ❌ |
| `CLAY_WEBHOOK_SECRET` | `src/app/api/webhooks/clay/route.ts` | ⚠️ | ❌ |
| `TRIGIFY_WEBHOOK_SECRET` | `src/app/api/webhooks/trigify/route.ts` | ⚠️ | ❌ |
| `N8N_WEBHOOK_SECRET` | `src/app/api/webhooks/n8n/route.ts` | ⚠️ | ❌ |
| `ANTHROPIC_API_KEY` | `src/lib/claude.ts`, wiki/ask, marketing/compliance-check | ✅ | ❌ |
| `CRON_SECRET` | `src/app/api/lemlist/sync/route.ts`, workers | ✅ | ❌ |
| `ENABLE_WORKERS` | `src/lib/worker-config.ts` | ❌ | ❌ |
| `WEBSITE_WEBHOOK_SECRET` | `src/app/api/crm/webhooks/inbound-lead/route.ts` | ✅ | ❌ |
| `SUPPORT_WEBHOOK_SECRET` | `src/app/api/support/webhooks/website-form/route.ts` | ✅ | ❌ |
| `NEXT_PUBLIC_APP_URL` | `src/app/api/crm/ai/check-followups/route.ts` | ❌ | ❌ |
| `AI_POLL_INTERVAL_MS` | `workers/ai-worker/` | ❌ | ❌ |
| `SYNC_POLL_INTERVAL_MS` | `workers/sync-worker/` | ❌ | ❌ |

**Aucune de ces 21 variables n'est documentée dans un `.env.example`.**

---

## 🎯 Plan de remédiation suggéré

### Sprint 1 (1 semaine) — Critiques sécurité

- [ ] **#C1** Chiffrer les OAuth tokens au repos (AES-256-GCM)
- [ ] **#C2** Ajouter vérification de signature sur le webhook Telegram
- [ ] **#C3** Configurer les security headers dans `next.config.ts`
- [ ] **#C4** Protéger les seed routes avec `requireAdmin()` ou supprimer en prod
- [ ] **#C6** Conditionner `debug: true` à `NODE_ENV !== "production"`
- [ ] **#M8** Corriger le webhook Clay (401 au lieu de 200, secret obligatoire)
- [ ] **#m7** Rendre `LEMLIST_WEBHOOK_SECRET` obligatoire
- [ ] **#m8** Corriger Trigify/N8N webhooks (même pattern)

### Sprint 2 (1 semaine) — Fondations qualité

- [ ] **#M5** Configurer Vitest + GitHub Actions CI (lint + build + test)
- [ ] **#M6** Réécrire README.md, créer `.env.example`, créer `ARCHITECTURE.md`
- [ ] **#M1** Implémenter Zod validation sur les 10 routes API les plus critiques (CRM mutations, Finance, Auth-related)
- [ ] **#M4** Créer `loading.tsx` + `error.tsx` pour `/crm`, `/finance`, `/compliance`
- [ ] **#M11** Installer pino pour le structured logging, configurer Sentry

### Sprint 3 (1 semaine) — Base de données

- [ ] **#C5** Migrer les champs Float monétaires vers Decimal (FinanceTransaction, BankAccount, Deal.dealValue en priorité)
- [ ] **#M10** Initialiser `prisma migrate` et committer le dossier `migrations/`
- [ ] **#M2** Ajouter pagination (`take` + cursor) sur les 20+ routes findMany sans limite
- [ ] **#M9** Résoudre les 5 patterns N+1 (utiliser `include` avec `_count`)
- [ ] Ajouter les indexes manquants sur CrmContact, Deal, Activity, Email

### Sprint 4 (1 semaine) — Performance + UX

- [ ] **#M7** Implémenter le rate limiting sur les endpoints AI
- [ ] **#m3** Migrer vers `next/font` pour Bellfair et DM Sans
- [ ] **#m2** Extraire les pages monolithes >1000L en composants (Intel, Compliance, Conferences)
- [ ] **#M12** Ajouter responsive breakpoints sur Dashboard et CRM pipeline (mobile first)

### Backlog

- [ ] **#m1** Remplacer les 31 `any` par des types spécifiques
- [ ] **#m4** Audit d'accessibilité WCAG 2.1 AA
- [ ] **#m5** Migrer les constantes de couleur hardcodées vers CSS variables (69 fichiers restants)
- [ ] **#m6** Persister l'état in-memory du Telegram bot en base
- [ ] **#m9** Implémenter la révocation des tokens OAuth au logout
- [ ] **#m10** Ajouter le monitoring des coûts/tokens Claude
- [ ] Découper le webhook Telegram (938L) en handlers modulaires
- [ ] Séparer le module SEO de Marketing
- [ ] Créer des README par module (18 fichiers)
- [ ] Ajouter des tests sur les routes API Finance et CRM
