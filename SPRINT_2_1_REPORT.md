# Sprint 2.1 — Rapport d'exécution

**Date** : 2026-04-22
**Scope** : Pipeline CI GitHub Actions + découverte état de santé repo

## Fichiers créés

| Fichier | LOC | Rôle |
|---|---:|---|
| `.github/workflows/ci.yml` | 108 | Pipeline CI : 3 jobs parallèles (lint-typecheck, test, build) |
| `BASELINE_2026-04-22.md` | 95 | Snapshot santé repo pré-CI (tsc/build/vitest/eslint) |
| `SPRINT_2_1_REPORT.md` | — | Ce rapport |

## Fichiers modifiés

| Fichier | Delta | Raison |
|---|---:|---|
| `package.json` | +4 scripts | `ci:typecheck`, `ci:lint`, `ci:test`, `ci:all` pour reproduire la CI en local |
| `README.md` | +2 lignes | Badge de status CI en tête |

## Résultats baseline (synthèse)

Détail complet dans [`BASELINE_2026-04-22.md`](./BASELINE_2026-04-22.md).

| Check | Status | Résumé |
|---|:---:|---|
| `tsc --noEmit` (monolith) | ✅ | 0 error |
| `tsc --noEmit` (sync-worker) | ✅ | 0 error |
| `tsc --noEmit` (ai-worker) | ❌ | 1 erreur pré-existante (Prisma Json type) |
| `next build` | ✅ | 0 error, 1 warning pré-existant (turbopack workspace root) |
| `vitest run` | ✅ | 19/19 tests passing (2 fichiers) |
| `eslint .` | ❌ | 79 errors + 157 warnings (236 pbs) pré-existants |

## CI activée — décisions

Pipeline configurée **en mode progressif** — 4 jobs parallèles (baseline rouge sur 2 checks sur 6) :

| Job CI | Blocant ? | Détail |
|---|:---:|---|
| `typecheck` > TS monolith | ✅ | `npx tsc --noEmit` |
| `typecheck` > TS sync-worker | ✅ | `cd workers/sync-worker && npx tsc --noEmit` |
| `typecheck` > TS ai-worker | ⛔ Commenté | TODO : 1 erreur pré-existante à fixer |
| `lint` (job dédié) | ⚠️ `continue-on-error: true` au niveau du job | Job tile apparaît ❌ rouge si eslint échoue, mais workflow global ✅. Visibilité haute, pas de blocage merge |
| `test` > Vitest | ✅ | `npx vitest run` |
| `build` > Next.js | ✅ | `npm run build` avec env vars factices |

**Pourquoi `lint` en job séparé plutôt qu'un step `continue-on-error` dans `typecheck` ?** Un `continue-on-error` au niveau step affiche ✅ vert pour le job entier même si le step a échoué — personne ne clique dans les logs au bout de 2 semaines. Un job dédié avec `continue-on-error` au niveau job affiche ❌ rouge sur la tuile, visible dans la UI Actions, tout en ne bloquant pas le workflow global. Meilleure visibilité, même effet sur le merge.

**Progression future** : une fois les 2 TODO résolus (ai-worker TS error + lint errors = 0), retirer `continue-on-error` sur le job `lint` (→ strict) et décommenter l'étape ai-worker dans `typecheck`.

## Variables d'environnement factices dans le workflow

Pour transparence — ces valeurs sont **uniquement** utilisées par `next build` pour pré-rendre les pages statiques. Elles ne sont **jamais** utilisées au runtime en production.

| Var | Valeur CI | Valeur réelle |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/db` | Railway (sensible) |
| `NEXTAUTH_SECRET` | `ci-build-secret-not-real` | Railway (sensible) |
| `NEXTAUTH_URL` | `http://localhost:3000` | `https://os.oxen.finance` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `ci-placeholder` | Railway |
| `TOKEN_ENCRYPTION_KEY_V1` | clé base64 de test | Railway (critique — depuis Sprint 1.3) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | `ci-placeholder` | Railway |
| `LEMLIST_*`, `CLAY_*`, `TRIGIFY_*`, `N8N_*`, `SUPPORT_*`, `WEBSITE_*` | `ci-placeholder` | Railway |
| `ANTHROPIC_API_KEY` | `ci-placeholder` | Railway |
| `CRON_SECRET` | `ci-placeholder` | Railway |

## Scripts npm ajoutés

```bash
npm run ci:typecheck   # Identique à ce que la CI lance
npm run ci:test        # Identique à ce que la CI lance
npm run ci:lint        # eslint . (non-bloquant en CI, bloquant en local)
npm run ci:all         # Enchaîne les 4 checks + build
```

⚠️ **Attention** : `npm run ci:all` **échoue actuellement en local** sur `ci:lint` (79 errors pré-existants). La CI GitHub elle passe grâce à `continue-on-error: true` sur le step eslint. C'est volontaire pour maintenir la visibilité locale des problèmes tout en débloquant le flow CI. Une fois le sprint lint cleanup fait, `ci:all` local sera vert et on pourra retirer `continue-on-error`.

## Non-régression Sprint 0 → 1.3

Tous les fixes sécurité tiennent :

| Check | Résultat |
|---|---|
| 4 webhooks (Clay, Trigify, N8N, Telegram) utilisent `requireWebhookSecret` | ✅ |
| HSTS présent dans `next.config.ts` | ✅ |
| Seed routes hors whitelist `src/proxy.ts` | ✅ |
| Format `enc:v1:` dans `token-encryption.ts` | ✅ |
| Tests SHA-256 worker sync passent | ✅ 2/2 |

## Actions manuelles GitHub — à faire par Vernon après le push

### 1. Vérifier que la CI tourne au premier push

Après `git push`, aller sur :
```
https://github.com/EscrowfyVD/Oxen-OS/actions
```
Vérifier que le workflow `CI` apparaît. État attendu :
- `Type check` ✅ vert
- `Lint (non-blocking)` ❌ rouge (79 errors) — **attendu et acceptable**, le workflow global passe quand même grâce au `continue-on-error`
- `Unit tests` ✅ vert
- `Next.js build` ✅ vert
- Workflow global (badge README) : ✅ vert

### 2. Protection de branche `main` (recommandé)

1. Aller sur `https://github.com/EscrowfyVD/Oxen-OS/settings/branches`
2. Cliquer **"Add branch protection rule"**
3. Branch name pattern : `main`
4. Cocher :
   - [x] **Require status checks to pass before merging**
     - Rechercher et ajouter **3 jobs seulement** (pas `Lint (non-blocking)` pour l'instant) :
       - `Type check`
       - `Unit tests`
       - `Next.js build`
     - [x] Require branches to be up to date before merging
   - [x] **Require conversation resolution before merging** (optionnel mais recommandé)
5. Sauvegarder

Effet : impossible de merger sur `main` si un des 3 jobs bloquants est rouge, même pour Vernon. Le job `Lint` reste visible comme indicateur mais n'empêche pas le merge. Désactivable temporairement via le toggle en cas d'override d'urgence.

Une fois le sprint lint cleanup fait : ajouter `Lint (non-blocking)` aux required status checks (et retirer `continue-on-error` du YAML, puis renommer le job `Lint` tout court).

### 3. Badge README — vérification

Le badge en tête du README va afficher :
- Vert si dernier build de `main` OK
- Rouge si échec
- Gris si aucun run encore

Il pointera vers les runs du workflow `ci.yml`.

## Ce sprint ne fait PAS

- ❌ Pas de fix des 79 erreurs lint (→ sprint dédié)
- ❌ Pas de fix de l'erreur TS ai-worker (→ sprint dédié)
- ❌ Pas de refactor du README (→ Sprint 2.2)
- ❌ Pas de pré-commit hooks (husky, lint-staged — hors scope)
- ❌ Pas de Dependabot ou autres workflows bonus
- ❌ Pas de déploiement auto via CI (Railway gère)
