# Sprint 1.1 + 1.2 — Rapport d'exécution

## Fichiers modifiés
- `src/app/api/telegram/webhook/route.ts` (+7 lignes — import + auth check en tête de POST)
- `src/app/api/telegram/setup/route.ts` (+10 −1 — guard env var + passage du secret à `setWebhook`)
- `src/lib/telegram.ts` (+2 −2 — signature de `setWebhook` mise à jour)
- `next.config.ts` (+34 lignes — bloc `async headers()` avec 6 headers de sécurité)

## Fichiers créés
- `SPRINT_1_1_2_REPORT.md`

## Fixes appliqués
- [x] #C2 — Signature webhook Telegram via `TELEGRAM_WEBHOOK_SECRET`
- [x] #C3 — Security headers HTTP (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP report-only)

## Build
- `npx tsc --noEmit` : ✅ (exit 0, zéro erreur)
- `npm run build` : ✅ (exit 0, seul warning pré-existant = turbopack workspace root, non lié à ce sprint)

## Détails des fixes

### #C2 — Signature webhook Telegram
- **Helper `requireWebhookSecret`** : aucune modification, il supportait déjà le paramètre `headerName`.
- **Handler POST** (`src/app/api/telegram/webhook/route.ts`) : `requireWebhookSecret` appelé **avant** le bloc `try/catch` existant. Raison : le catch retourne `{ ok: true }` status 200 pour empêcher Telegram de retry — si le check était dans le try et que l'env var manquait (throw), l'erreur serait masquée en 200. En le plaçant hors du try, un env var manquant remonte correctement en 500.
- **GET handler** : inchangé (healthcheck public comme demandé).
- **`setWebhook(url, secretToken)`** : signature changée pour accepter le secret. Un seul caller (`setup/route.ts:12`) — aucune régression possible ailleurs.
- **Route setup** : guard env var avant l'appel. Si `TELEGRAM_WEBHOOK_SECRET` absent → 500 avec message clair.

### #C3 — Security headers
- Bloc `async headers()` ajouté à `next.config.ts`, config `images` existante préservée.
- Appliqué à toutes les routes via `source: "/:path*"`.
- CSP volontairement en **Report-Only** pour ne rien casser avant validation manuelle.
- `connect-src` inclut : Anthropic, Telegram, Lemlist, OpenAI, Google OAuth, `wss:` pour websockets.

## ⚠️ Actions requises AVANT déploiement

### 1. Railway — Ajouter la variable d'environnement

Sur Railway → service Oxen-OS → Variables, ajouter :

```
TELEGRAM_WEBHOOK_SECRET=<générer avec: openssl rand -hex 32>
```

**Important** : doit contenir uniquement `[A-Za-z0-9_-]`, 1-256 caractères. La commande `openssl rand -hex 32` produit exactement du hex conforme (64 chars `[0-9a-f]`).

### 2. Telegram — Reconfigurer le webhook

**APRÈS** déploiement Railway (pas avant — sinon webhook actif sans secret côté Telegram = 401 sur tous les updates), exécuter :

```bash
# Variables à remplacer
BOT_TOKEN="<TELEGRAM_BOT_TOKEN de Railway>"
WEBHOOK_URL="https://os.oxen.finance/api/telegram/webhook"
SECRET="<TELEGRAM_WEBHOOK_SECRET identique à Railway>"

# Call setWebhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${SECRET}\",
    \"allowed_updates\": [\"message\", \"callback_query\"]
  }"

# Vérifier
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
# Doit afficher has_custom_certificate: false, pending_update_count: 0
```

**Ordre critique** :
1. Push du code (nouveau code actif sur Railway)
2. Ajouter `TELEGRAM_WEBHOOK_SECRET` sur Railway (redéploie)
3. Exécuter `setWebhook` ci-dessus pour synchroniser Telegram
4. Entre (2) et (3), fenêtre de ~1 min où les messages Telegram vers le bot échoueront en 401. C'est normal et acceptable (@Oxen_deal_info_bot est interne).

**Alternative** : la route authentifiée `POST /api/telegram/setup` peut être appelée une fois connecté pour synchroniser Telegram (utilise les mêmes env vars côté serveur).

### 3. CSP — Surveillance post-deploy

Le CSP est en **Report-Only** : il n'empêche rien mais logue les violations dans la console navigateur (DevTools → Console). Pendant 1-2 jours d'usage normal :
- Ouvrir l'OS, naviguer dans chaque module
- Vérifier qu'aucune erreur "Content Security Policy" n'apparaît dans la console
- Si violations : noter les domaines/sources signalés, les ajouter au CSP, puis repasser en enforce

Une fois confirmé clean, remplacer `Content-Security-Policy-Report-Only` par `Content-Security-Policy` dans `next.config.ts`.

### 4. HSTS — Scope volontairement limité au domaine principal

Le header `Strict-Transport-Security` est déployé avec `max-age=63072000` **uniquement** — sans `includeSubDomains` ni `preload`.

**Raison** : `oxen.finance` est un domaine partagé entre Oxen OS (Railway) et d'autres services (site vitrine Cardaq, futurs sous-domaines `api./docs./status./blog./mail.`). Sans inventaire DNS complet de `*.oxen.finance`, activer `includeSubDomains` risquerait de bloquer un sous-domaine pendant 2 ans en cas de page HTTP non-chiffrée (ex: page de maintenance Cardaq).

**Effet actuel** :
- ✅ `os.oxen.finance` forcé en HTTPS pour 2 ans
- ✅ Les autres sous-domaines de `oxen.finance` non impactés
- ✅ Réversible plus facilement si besoin

**Élargissement futur** (ticket de 2 min quand prêt) : ajouter `; includeSubDomains; preload` après avoir :
1. Inventorié tous les enregistrements DNS de `*.oxen.finance`
2. Confirmé que tous les sous-domaines servent du HTTPS valide
3. Mis en place un redirect 301 HTTP→HTTPS systématique sur le root

## À tester post-déploiement

```bash
PROD=https://os.oxen.finance

# Test 1 — Telegram webhook sans header → 401
curl -s -o /dev/null -w "telegram/no-header:    %{http_code}\n" \
  -X POST "$PROD/api/telegram/webhook" \
  -H "Content-Type: application/json" -d '{}'
# Attendu : 401

# Test 2 — Telegram webhook avec mauvais secret → 401
curl -s -o /dev/null -w "telegram/wrong-secret: %{http_code}\n" \
  -X POST "$PROD/api/telegram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: wrong" -d '{}'
# Attendu : 401

# Test 3 — GET healthcheck reste ouvert
curl -s -o /dev/null -w "telegram/GET:          %{http_code}\n" "$PROD/api/telegram/webhook"
# Attendu : 200

# Test 4 — Security headers présents
curl -sI "$PROD/" | grep -iE "strict-transport|x-frame-options|x-content-type|referrer-policy|permissions-policy|content-security"
# Attendu : 6 headers dans la réponse

# Test 5 — Vrai webhook Telegram (après setWebhook) : envoyer un message au bot
# Vérifier dans les logs Railway que l'update passe en 200
```

## Non-régression Sprint 0 (vérifiée localement)
- ✅ Clay / Trigify / N8N utilisent toujours `requireWebhookSecret`
- ✅ Lemlist conserve son guard `LEMLIST_WEBHOOK_SECRET` (4 occurrences dans le fichier)
- ✅ Seed routes absentes du whitelist `src/proxy.ts`
