# Sprint 2.4a — Rapport d'exécution

**Date** : 2026-04-23
**Portée** : Structured logging (pino) — monolith + 2 workers

## Fichiers créés

| Fichier | LOC | Rôle |
|---|---:|---|
| `src/lib/logger.ts` | 120 | pino config + redaction PII + childLoggerFromRequest + serializeError |
| `src/lib/logger.test.ts` | 102 | 10 tests unitaires (redaction, serializeError, child) |
| `workers/sync-worker/src/lib/logger.ts` | 120 | Copie synchronisée (byte-identique, SHA-256) |
| `workers/ai-worker/src/lib/logger.ts` | 50 | Logger dédié ai-worker (sans duplication synchronisée) |
| `SPRINT_2_4a_REPORT.md` | — | Ce rapport |

## Fichiers modifiés

**Dépendances :**
- `package.json` (+ `pino@9.14.0`, +dev `pino-pretty@13.1.3`, script `worker:sync-libs` étendu)
- `workers/sync-worker/package.json` (+ `pino@9.14.0`, +dev `pino-pretty@13.1.3`)
- `workers/ai-worker/package.json` (+ `pino@9.14.0`, +dev `pino-pretty@13.1.3`)

**Infrastructure :**
- `src/lib/prisma.ts` — slow query hook ajouté via `$on("query" as never, ...)`, extension `$extends` byte-identique Sprint 1.3 préservée
- `workers/sync-worker/src/lib/prisma.ts` — synchronisé via `worker:sync-libs`
- `src/proxy.ts` — propagation `x-request-id` (3 return paths), auth/whitelist logic intacte
- `src/lib/__tests__/worker-sync.test.ts` — ajout `logger.ts` à la liste des paires SHA-256 vérifiées

**Remplacements console.* → logger (priorités 1-4) :**

| Fichier | Consoles → logger |
|---|---:|
| `src/app/api/webhooks/clay/route.ts` | 1 |
| `src/app/api/webhooks/lemlist/route.ts` | 6 |
| `src/app/api/webhooks/trigify/route.ts` | 1 |
| `src/app/api/webhooks/n8n/route.ts` | 1 |
| `src/app/api/crm/webhooks/inbound-lead/route.ts` | 2 |
| `src/lib/auth.ts` | 10 |
| `src/app/api/telegram/webhook/route.ts` | 15 |
| `workers/sync-worker/src/index.ts` | 22 |
| `workers/ai-worker/src/index.ts` | 9 |
| `src/lib/lemlist.ts` | 11 |
| `src/lib/telegram.ts` | 4 |
| `src/lib/google-calendar.ts` | 9 |
| `src/lib/prisma.ts` (decryptAccountRecord fallback) | 1 |
| **Total** | **92** |

## Scan console.* — avant vs après

- **Avant** (Phase 0) : 319 occurrences `console.(log|error|warn|info)` dans code projet
- **Après** : 226 occurrences restantes dans code projet
- **Réduction** : 93 (−29%)
- Les 226 restants sont dans routes non-prioritaires (marketing, wiki, intel, conferences, reports, etc.) et pages React client-side — **hors scope Sprint 2.4a**, à migrer dans un sprint futur

## Décisions notables

### pino-pretty désactivé en test

pino-pretty transport tourne en worker thread qui bypasse `process.stdout.write` → les spies jest/vitest ne capturent rien. Solution : détection `NODE_ENV === "test"` dans `logger.ts` et désactivation du transport (sortie JSON brute sur stdout). Tests utilisent un `Writable` stream custom pour captor.

### Redaction multi-niveaux

pino fast-redact n'accepte que `*` wildcards single-level. Pour couvrir les shapes nested (`{data: {account: {access_token}}}`), j'ai ajouté explicitement les niveaux 2 et 3 pour les secrets les plus sensibles (`access_token`, `refresh_token`, `id_token`, `password`, `secret`). Test unitaire vérifie redaction à profondeur 3.

### ai-worker logger — fichier dédié, pas synchronisé

Le sync-worker partage Prisma + token-encryption avec le monolith (duplication synchronisée Sprint 1.3). L'ai-worker n'a pas ces dépendances — il fait des calls Claude. Son `logger.ts` est volontairement **plus simple** (`service: "ai-worker"` en base, pas de redaction sur les paths de headers Request) et **vit indépendamment**. Pas de test SHA-256 (indépendance assumée).

### Worker lockfiles — first commit (reproducibility)

`workers/sync-worker/package-lock.json` et `workers/ai-worker/package-lock.json` n'existaient pas avant ce sprint. Ils ont été générés comme side-effect de `npm install pino@^9` dans chaque worker dir.

**Vérification de non-drift** (effectuée avant commit) :
```
@prisma/client : 5.22.0 sur les 3 (même hash d'intégrité)
```

Décision : **garder** les lockfiles pour améliorer la reproductibilité des builds workers. Gain effectif uniquement si le build Railway des workers passe à `npm ci` — à confirmer / ajuster dans un sprint infra si pertinent. En l'état, même avec `npm install`, les lockfiles sont présents comme référence locale.

### Prisma slow query hook

- Seuil : `SLOW_QUERY_THRESHOLD_MS` (défaut 500, configurable via env var)
- `$on("query" as never, ...)` cast nécessaire car Prisma 5 types ne matchent pas parfaitement l'API event-based
- Events `error` et `warn` Prisma également routés vers logger
- Extension `$extends` byte-identique Sprint 1.3 (aucune modif de la logique chiffrement)

### Request ID dans proxy

Génération si absent (`crypto.randomUUID()`), réutilisation si le client/proxy l'a déjà set (ex: Cloudflare). Propagé en header sur les 3 return paths (whitelist, login redirect, authenticated pass-through).

## Validation

| Check | Résultat |
|---|---|
| `npx tsc --noEmit` (monolith) | ✅ EXIT 0 |
| `cd workers/sync-worker && npx tsc --noEmit` | ✅ EXIT 0 |
| `cd workers/ai-worker && npx tsc --noEmit` | ⚠️ 1 erreur **pré-existante** (Sprint 2.1 baseline, non-Sprint 2.4a) |
| `npx vitest run` | ✅ **39/39** (4 fichiers : encryption + worker-sync + validate + logger) |
| `npm run build` | ✅ EXIT 0 |
| SHA-256 worker copies | ✅ logger.ts + token-encryption.ts + prisma.ts bit-identiques |
| Non-régression Sprint 0 → 2.3b | ✅ enc:v1 (4), HSTS present, seed hors proxy, 4 webhook helpers |

## 🚀 Actions Railway (optionnelles)

### Variables documentées (pas bloquantes — defaults sûrs)

Sur les 3 services (oxen-os, sync-worker, ai-worker) :

- `LOG_LEVEL` (string, optionnel) — Défaut `info` en prod.
  - Valeurs : `trace`, `debug`, `info`, `warn`, `error`, `fatal`
  - Passer à `debug` temporairement en cas de diagnostic d'incident
- `SLOW_QUERY_THRESHOLD_MS` (number, optionnel) — Défaut 500.
  - Uniquement pertinent sur `oxen-os` + `sync-worker` (services Prisma)
  - Passer à 1000 si log trop bruyant, 200 pour plus strict

### Config Railway par défaut — rien à changer

Les défauts marchent out-of-the-box. Railway ingère automatiquement stdout, donc le JSON pino arrive directement dans le dashboard Logs.

## Smoke tests post-deploy recommandés

```bash
# 1. Déclencher un webhook pour générer des logs avec requestId
PROD=https://os.oxen.finance
curl -s -X POST "$PROD/api/webhooks/clay" \
  -H "x-webhook-secret: wrong" -d '{}'

# 2. Dans Railway dashboard → oxen-os → Logs, chercher :
#    - "webhook":"clay"   → child logger binding confirmé
#    - "requestId":"..."  → propagation header confirmée
#    - PAS de "wrong"      → redaction OK (le secret ne doit pas apparaître)

# 3. Vérifier OAuth tokens non fuités — login Google test :
#    - Dans Railway logs après signIn: "hasAccessToken":true, pas "access_token":"ya29..."
```

## Prochaine étape

**Sprint 2.4b — Sentry** (après cette pause) :
- `@sentry/nextjs` pour monolith
- `@sentry/node` pour les 2 workers
- Config DSN par service (3 variables Railway distinctes ou 1 partagée)
- Breadcrumbs auto pour pino (pino emits → Sentry captures)
- Pas d'APM / tracing dans cette phase (Sentry free tier déjà suffisant pour errors)

## Ce que ce sprint ne fait PAS

- ❌ Sentry (Sprint 2.4b)
- ❌ APM / distributed tracing
- ❌ Log shipping externe (BetterStack, Datadog, Axiom)
- ❌ Remplacement des 226 console.* restants (sprint futur, par module)
- ❌ Logging côté client-side React (hors scope)
- ❌ Modification de logique métier
- ❌ Changement de la couche Zod / webhook-auth / token-encryption
- ❌ Commit automatique
