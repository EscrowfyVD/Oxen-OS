# Sprint 2.2 — Rapport d'exécution

**Date** : 2026-04-22
**Scope** : Documentation — `.env.example`, `README.md`, `ARCHITECTURE.md`

## Fichiers

| Fichier | État | Lignes |
|---|---|---:|
| `.env.example` | Créé (nouveau) | 175 |
| `README.md` | Réécrit (template `create-next-app` remplacé) | 202 |
| `ARCHITECTURE.md` | Créé (nouveau) | 314 |
| `SPRINT_2_2_REPORT.md` | Ce fichier | — |
| `.gitignore` | Modifié (+1 ligne : `!.env.example` exception) | +1 |

**Note sur `.gitignore`** : le pattern `.env*` du template Next.js matchait aussi `.env.example` (caché aux outils `git add`). Ajout d'une exception `!.env.example` pour permettre le commit du template. Modification strictement hors-scope mais nécessaire pour livrer le sprint — la règle "touche à rien en dehors des 3 fichiers + éventuellement quelques fichiers de référence croisés" couvre ce genre de cas.

## Env vars documentées — 25 (+1 fallback)

Extraction exhaustive depuis le code (`grep process.env.*` dans `src/`, `workers/`, `scripts/`, `prisma/`, `next.config.ts` + `grep envVarName` pour les secrets passés au helper `requireWebhookSecret`). `NODE_ENV` système exclue.

| Catégorie | Variables |
|---|---|
| Database | `DATABASE_URL` |
| NextAuth | `NEXTAUTH_URL`, `AUTH_SECRET` (+ fallback `NEXTAUTH_SECRET`) |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Token encryption | `TOKEN_ENCRYPTION_KEY_V1` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_SEO_CHAT_ID` |
| Lemlist | `LEMLIST_API_KEY`, `LEMLIST_WEBHOOK_SECRET` |
| Webhook secrets | `CLAY_WEBHOOK_SECRET`, `TRIGIFY_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`, `WEBSITE_WEBHOOK_SECRET`, `SUPPORT_WEBHOOK_SECRET` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Internal | `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `APP_URL` |
| Workers | `ENABLE_WORKERS`, `AI_POLL_INTERVAL_MS`, `SYNC_POLL_INTERVAL_MS`, `STALE_JOB_TIMEOUT_MS` |

Répartition :
- **[REQUIRED]** : 15 (DB + auth + OAuth + encryption key + Telegram bot/URL/secret + Lemlist + 5 webhook secrets + Anthropic + CRON)
- **[OPTIONAL]** : 6 (Telegram SEO chat, `NEXT_PUBLIC_APP_URL`, `APP_URL`, workers toggle + 3 worker tuning)
- **[PROD]** : 1 (`TELEGRAM_WEBHOOK_URL`)
- **[SHARED]** (monolith + workers) : 3 (`DATABASE_URL`, `TOKEN_ENCRYPTION_KEY_V1`, `ANTHROPIC_API_KEY`)

(Les markers ne sont pas mutuellement exclusifs — une var peut être `[REQUIRED] [SHARED]`.)

## Modules listés dans le README — 15 + Dashboard

Tableau du README extrait 1:1 de `src/app/` (exclus : `api/`, `login/`, `layout.tsx`, `page.tsx` racine, `globals.css`, `favicon.ico`) :

| Module | Route |
|---|---|
| Dashboard | `/` |
| Sentinel AI | `/ai` |
| CRM | `/crm` |
| Calendar | `/calendar` |
| Finance | `/finance` |
| Compliance | `/compliance` |
| Marketing | `/marketing` |
| Support | `/support` |
| Wiki | `/wiki` |
| Intel | `/intel` |
| Tasks | `/tasks` |
| Conferences | `/conferences` |
| Team | `/team` |
| Org | `/org` |
| Absences | `/absences` |
| Settings | `/settings` |

## Données réelles intégrées dans ARCHITECTURE.md

| Donnée | Valeur | Source |
|---|---|---|
| Nombre de modèles Prisma | 70 | `grep -c "^model " prisma/schema.prisma` |
| Nombre de modules user-facing | 15 (+ Dashboard) | `ls src/app/` |
| Nombre de groupes d'API routes | 33 | `ls src/app/api/` |
| Nombre de fichiers `src/lib/` | 22 (21 prod + 1 test) | `ls src/lib/*.ts src/lib/*.tsx` |
| Nombre de workers | 2 (sync + ai) | `ls workers/` |

## Cross-check env vars code ↔ `.env.example`

```
grep process.env.*   in src/ workers/ scripts/ prisma/ next.config.ts
+ grep envVarName     in src/
-> 25 vars (NODE_ENV excluded, system-managed)

grep ^VAR=  in .env.example
-> 25 vars + NEXTAUTH_SECRET as commented fallback
```

**Résultat** : couverture 100%. Les 2 "faux positifs" du diff automatique sont documentés :
- `NEXTAUTH_SECRET` — présent dans `.env.example` comme commentaire fallback (NextAuth v5 accepte `AUTH_SECRET ?? NEXTAUTH_SECRET`)
- `DATABASE_URL` — lu par Prisma via `env("DATABASE_URL")` dans `schema.prisma`, pas `process.env` en TS, donc invisible au grep `process.env.*`

## Notes / clarifications post-review

- **`NEXTAUTH_URL` vs `AUTH_URL`** : **résolu** — `grep` sur le code confirme 3 usages de `NEXTAUTH_URL` (`src/lib/auth.ts:8`, `src/app/api/telegram/webhook/route.ts:254`, `workers/sync-worker/src/index.ts:16`), **zéro** usage de `AUTH_URL`. `.env.example` documente `NEXTAUTH_URL`.
- **`AUTH_SECRET` vs `NEXTAUTH_SECRET`** : **résolu** — le code fait `process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET` (`src/lib/auth.ts:11`), donc AUTH_SECRET gagne. `.env.example` documente **uniquement** `AUTH_SECRET` (la ligne commentée fallback a été retirée pour éviter qu'un dev fille les deux avec des valeurs différentes).
- **SEO module** : **résolu** — `grep` confirme que SEO est monté dans `/marketing` via `import SeoModule from "@/components/seo/SeoModule"` (`src/app/marketing/page.tsx:11`). Documentation mise à jour : ligne `Marketing` du README clarifie "Includes SEO & GEO sub-module", et `ARCHITECTURE.md` précise que les modèles Marketing/SEO sont rendus dans la page `/marketing` via `components/seo/SeoModule.tsx`.
- **Role-based auth granularity** : reste volontairement floue dans `ARCHITECTURE.md` ("granular coverage varies by module and is tracked in the audit for future consolidation"). Pas de précision engagée car sujet à évolution rapide.
- **Numéros de tickets audit** : volontairement omis de `ARCHITECTURE.md` — les catégories suffisent pour un document qui pourrait un jour être lu hors contexte audit interne.

## Validation

| Check | Résultat |
|---|---|
| Toutes les env vars du code → `.env.example` | ✅ 25/25 (via cross-check grep) |
| Non-régression Sprint 0 (seed hors proxy) | ✅ OK |
| Non-régression Sprint 1.1+1.2 (HSTS + webhook auth) | ✅ OK |
| Non-régression Sprint 1.3 (token-encryption) | ✅ 19/19 tests (token-encryption + worker-sync) |
| `npm run ci:typecheck` | ✅ exit 0 |
| `npm run ci:test` | ✅ 19/19 |
| `npm run ci:lint` | ⚠️ 79 errors (baseline pré-existant, non-bloquant) |
| `npm run build` | Non relancé — les 3 fichiers sont purement docs, aucun impact sur le build |

## Ce sprint ne fait PAS

- ❌ Pas de README par module (reporté Sprint 5 modularité)
- ❌ Pas de doc API endpoint par endpoint (hors scope)
- ❌ Pas de `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, PR template
- ❌ Pas de création d'env vars nouvelles dans le code
- ❌ Pas de modification de code métier
- ❌ Pas de `.nvmrc` (CI pinne Node 22, local accepte 20+)
- ❌ Pas de Prettier config (noté dans README comme non-configuré pour l'instant)
