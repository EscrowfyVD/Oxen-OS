# Sprint 2.4b — Rapport d'exécution

**Date** : 2026-04-23
**Portée** : Sentry error tracking — monolith (Next.js) + 2 workers (Node)

## Fichiers créés

| Fichier | LOC | Rôle |
|---|---:|---|
| `src/lib/sentry.ts` | 147 | `sentryBeforeSend` PII redaction + `captureException` helper + `isSentryEnabled` |
| `src/lib/sentry.test.ts` | 99 | 9 tests unitaires (8 cas redaction + idempotence + no-op) |
| `src/instrumentation.ts` | 72 | Next.js hook — init Node + Edge runtimes, `onRequestError` forwarding |
| `src/instrumentation-client.ts` | 36 | Browser-side Sentry init (strict PII, no replay, no tracing) |
| `workers/sync-worker/src/lib/sentry.ts` | 147 | Copie synchronisée (SHA-256 enforced) |
| `workers/ai-worker/src/lib/sentry.ts` | 69 | Dédié ai-worker (sans `captureException` helper, plus simple) |
| `SPRINT_2_4b_REPORT.md` | — | Ce rapport |

## Fichiers modifiés

| Fichier | Delta |
|---|---|
| `package.json` | +`@sentry/nextjs ^10.49.0`, script `worker:sync-libs` étendu à `sentry.ts` |
| `package-lock.json` | transitives Sentry |
| `workers/sync-worker/package.json` + lockfile | +`@sentry/node ^10.49.0` |
| `workers/ai-worker/package.json` + lockfile | +`@sentry/node ^10.49.0` |
| `workers/sync-worker/src/index.ts` | +`Sentry.init()` bloc en tête (avant imports métier) |
| `workers/ai-worker/src/index.ts` | idem |
| `src/lib/__tests__/worker-sync.test.ts` | +pair `sentry.ts` dans PAIRS |
| `.github/workflows/ci.yml` | +env vars `SENTRY_DSN=""` et `NEXT_PUBLIC_SENTRY_DSN=""` sur le job build |

## Fichiers **PAS modifiés** (vérifiés)

- **`next.config.ts`** — ✅ `git diff --stat` retourne 0. Aucune injection Sentry automatique.
- **`src/proxy.ts`** — ✅ inchangé depuis Sprint 2.4a.
- **Extension Prisma `$extends`** — ✅ bytes identiques Sprint 1.3.
- **Pino core config** — ✅ inchangé depuis Sprint 2.4a.

## Versions alignées

```
monolith  @sentry/nextjs : 10.49.0
sync      @sentry/node   : 10.49.0
ai        @sentry/node   : 10.49.0
```

Les 3 dépendent de `@sentry/core@10.49.0` (transitive). Les types `ErrorEvent` et `EventHint` sont importés depuis `@sentry/core` (neutral), ce qui permet au fichier `sentry.ts` d'être **byte-identique** entre monolith et sync-worker même s'ils utilisent des wrappers différents.

## Guardrails de sécurité

- ✅ **DSN via env var uniquement** — jamais en clair dans le code
- ✅ **`sendDefaultPii: false`** partout (monolith Node + Edge + client + 2 workers)
- ✅ **`tracesSampleRate: 0`** — APM désactivé (décision Q3)
- ✅ **`replaysSessionSampleRate: 0`** + **`replaysOnErrorSampleRate: 0`** — session replay coupé
- ✅ **`beforeSend` custom** — 9 tests vérifient redaction de :
  - `authorization`, `cookie`, `set-cookie`, `x-webhook-secret`, `x-telegram-bot-api-secret-token`
  - `password`, `token`, `secret`, `apiKey`, `api_key`
  - `access_token`, `refresh_token`, `id_token` à tous niveaux de nesting
  - `query_string` redacté intégralement (best-effort)
  - `user` réduit à `{id}` uniquement (pas email, pas ip_address)
  - breadcrumb `data` recursively redacted
- ✅ **Intégrations filtrées** : `Console` et `Http` retirées côté server, `Console` et `BrowserTracing` retirées côté client — réduit surface d'attaque PII dans les breadcrumbs automatiques
- ✅ **`maxBreadcrumbs: 30`** au lieu du défaut 100 — moins de bruit signal
- ✅ **Pas de wizard Sentry** — setup manuel intégral, préserve HSTS + CSP (Sprint 1.2) + CI (Sprint 2.1) + proxy (Sprint 2.4a)
- ✅ **Pas de source maps upload** — ce sprint

## Décisions notables

### `sentry.ts` byte-identique entre monolith et sync-worker

Pour que le fichier soit synchronisé (pattern Sprint 1.3), les imports de types viennent de **`@sentry/core`** (shared). Le `captureException` helper utilise un `import("@sentry/nextjs").catch(() => import("@sentry/node"))` pour résoudre le wrapper approprié au runtime — une seule source de vérité.

### ai-worker avec `sentry.ts` dédié (non synchronisé)

Même pattern que `logger.ts` Sprint 2.4a : le sync-worker partage la complexité Prisma + token-encryption avec le monolith, l'ai-worker non. Son `sentry.ts` est volontairement **plus simple** (pas de `captureException` helper, pas les headers webhook-secret — l'ai-worker ne fait pas de webhook). Pas de test SHA-256.

### Pino → Sentry breadcrumb bridge **skippé**

Le prompt proposait d'ajouter un hook `logger.on("data", ...)` dans `src/lib/logger.ts` pour émettre un breadcrumb Sentry à chaque log pino (info+). **Skippé** : pino 9 n'expose pas `.on("data", ...)` — il faudrait implémenter un custom destination, ce qui refactore l'infrastructure de logging pour un gain marginal (Sentry capture déjà les erreurs via `onRequestError` + `captureException`).

**Impact** : les events Sentry auront moins de contexte pino automatique, mais restent enrichis via :
- Le `requestId` propagé par le proxy (Sprint 2.4a)
- Les appels explicites `captureException(e, { context, userId, tags })`
- Les breadcrumbs Sentry natifs sur les erreurs routes

À reconsidérer dans un sprint futur si le besoin se matérialise.

### Pas de route `/api/test-sentry-error`

Le prompt mentionnait la possibilité d'ajouter une route de test. **Non ajoutée** pour ce sprint :
- Trop facile d'oublier de la supprimer après validation
- Le test manuel se fait mieux via une route réelle qui throw intentionnellement en dev local
- Documenté en Actions Railway ci-dessous pour test post-deploy

## Scope `captureException` — **pas encore ajouté aux catch blocks**

Le helper est prêt, mais **aucun** `captureException(e, ...)` n'a été ajouté dans les catch existants durant ce sprint. Raison : l'instrumentation Next.js (`onRequestError` dans `instrumentation.ts`) capture automatiquement les erreurs non-caught dans les route handlers. Les catch qui font `log.error(...)` et retournent une réponse échouent **proprement** et ne remontent pas à `onRequestError`.

**À faire dans un sprint futur dédié** : audit des catch blocks pour décider quels silent-failures doivent être reportés à Sentry via `captureException` (actuellement ces erreurs sont dans pino uniquement, pas dans Sentry). Liste des points chauds à traiter :
- `src/lib/auth.ts` — signIn callback catch
- 5 webhooks (Clay, Lemlist, Trigify, N8N, inbound-lead) — catches principaux
- `workers/sync-worker/src/index.ts` — job processing catch
- `workers/ai-worker/src/index.ts` — Claude API catch
- Prisma `$on("error")` hook

Pour ce sprint, **Sentry capture toutes les erreurs uncaught** côté Next.js + les uncaught exceptions côté Node worker (via `@sentry/node` default integrations). C'est le 80/20.

## Validation

| Check | Résultat |
|---|---|
| `npx tsc --noEmit` (monolith) | ✅ EXIT 0 |
| `cd workers/sync-worker && npx tsc --noEmit` | ✅ EXIT 0 |
| `cd workers/ai-worker && npx tsc --noEmit` | ⚠️ 1 erreur **pré-existante** Sprint 2.1 (ligne 58 → 73 après ajout Sentry init, même nature) |
| `npx vitest run` | ✅ **49/49** (+9 sentry, +1 SHA-256 sentry.ts) |
| `npm run build` | ✅ EXIT 0 (avec `SENTRY_DSN=""` pour simuler CI) |
| `next.config.ts` intact | ✅ 0 lignes diff |
| DSN leaked dans staged ? | ✅ aucun match `sentry.io|ingest.sentry` |
| SHA-256 workers sync | ✅ 4/4 (sentry + logger + token-encryption + prisma) |
| Non-régression Sprint 0 → 2.4a | ✅ enc:v1, HSTS, seed hors proxy, webhook-auth, validate, pino |

## 🚀 Actions Railway requises (post-push)

### 1. Créer le project Sentry

1. Connexion à https://sentry.io (plan free tier)
2. New Project → Platform: **Next.js** (même si on a 2 workers Node, un seul project est plus simple à gérer)
3. Récupérer la **DSN** : `Settings → Client Keys (DSN)` → copier la valeur
   Format attendu : `https://<publicKey>@o<org>.ingest.<region>.sentry.io/<projectId>`

### 2. Configurer les env vars Railway

**Sur chacun des 3 services :**

| Service | Variable | Valeur |
|---|---|---|
| `oxen-os` | `SENTRY_DSN` | `<DSN copiée ci-dessus>` |
| `oxen-os` | `NEXT_PUBLIC_SENTRY_DSN` | `<même DSN>` (pour bundle client) |
| `sync-worker` | `SENTRY_DSN` | `<même DSN>` |
| `ai-worker` | `SENTRY_DSN` | `<même DSN>` |

Les 3 services peuvent partager la même DSN (un seul project Sentry). L'`environment` tag distinguera déjà `production` vs autres via `NODE_ENV`.

### 3. Configurer les alertes (optionnel mais recommandé)

Dans Sentry UI :
- **Alerts → Create Alert Rule**
- Condition : "An event is seen"
- Filter : `environment:production`
- Action : "Send a notification via Email → <ton email>"
- Fréquence : par défaut (chaque erreur) ou throttled

### 4. Test end-to-end

Créer temporairement une route qui throw :

```ts
// src/app/api/debug/sentry-test/route.ts (TEMPORAIRE — à supprimer après test)
import { NextResponse } from "next/server"
export async function GET() {
  throw new Error("Sprint 2.4b sentry test — 2026-04-23")
  return NextResponse.json({ ok: true }) // unreachable
}
```

Puis :
```bash
curl https://os.oxen.finance/api/debug/sentry-test
# Attendu : 500
```

Vérifier dans Sentry dashboard (moins d'1 min) :
- ✅ L'erreur apparaît
- ✅ Tag `environment: production`
- ✅ Request headers → `authorization` et `cookie` absents ou `[REDACTED]`
- ✅ Pas de `user.email`, pas de `user.ip_address`

**Ensuite, supprimer la route test** dans un commit séparé.

### 5. Surveillance passive

Pendant 24-48h en prod après push :
- Regarder le dashboard Sentry pour repérer les erreurs réelles qu'on ne voyait pas dans les logs pino
- Confirmer que les payloads ne contiennent aucune PII (on peut auditer les events un par un)

## Couverture post-sprint

| Signal | Outil | État |
|---|---|---|
| Logs structurés continus | pino → Railway | ✅ Sprint 2.4a |
| Errors uncaught (route handlers) | Sentry → dashboard | ✅ Sprint 2.4b |
| Errors uncaught (workers) | Sentry → dashboard | ✅ Sprint 2.4b |
| Errors client-side (browser) | Sentry → dashboard | ✅ Sprint 2.4b |
| APM / tracing | — | ❌ Out of scope (décidé Q3) |
| Session replay | — | ❌ Out of scope (PII risk) |
| Source maps upload | — | ❌ Sprint futur nice-to-have |
| `captureException` sur catches silencieux | — | 🟡 Sprint futur audit (helper prêt) |

## Ce sprint ne fait PAS

- ❌ Wizard Sentry automatique (`npx @sentry/wizard`) — setup 100% manuel
- ❌ Modification de `next.config.ts` — vérifié intact
- ❌ APM / tracing / profiling / replay — désactivés explicitement
- ❌ DSN committé — uniquement env vars
- ❌ Audit exhaustif des catch blocks pour `captureException` — helper prêt, application future
- ❌ Pino → Sentry breadcrumb bridge — skippé (pino 9 API incompat)
- ❌ Route `/api/debug/sentry-test` permanente — test manuel local/temporaire seulement
- ❌ Upload de source maps — sprint futur
- ❌ Commit automatique
