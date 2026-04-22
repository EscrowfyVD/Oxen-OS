# Sprint 1.3 — Rapport d'exécution

**Date** : 2026-04-22
**Scope** : #C1 — Chiffrement des tokens OAuth Google au repos (AES-256-GCM, versionné)

## Fichiers créés

| Fichier | LOC | Rôle |
|---|---:|---|
| `src/lib/token-encryption.ts` | 148 | Helper AES-256-GCM + base64url + versionning `enc:v1:` |
| `src/lib/token-encryption.test.ts` | 136 | 17 tests unitaires (round-trip, tampering, key validation…) |
| `src/lib/__tests__/worker-sync.test.ts` | 35 | Test de cohérence SHA-256 entre monolith et sync-worker |
| `workers/sync-worker/src/lib/token-encryption.ts` | 148 | Copie synchronisée (identique au src) |
| `workers/sync-worker/src/lib/prisma.ts` | 138 | Copie synchronisée (identique au src) |
| `scripts/encrypt-oauth-tokens.ts` | 103 | Migration one-shot, idempotent, transactionnelle |
| `SPRINT_1_3_REPORT.md` | — | Ce rapport |

## Fichiers modifiés

| Fichier | Delta | Raison |
|---|---:|---|
| `src/lib/prisma.ts` | +128 / −3 | Extension `$extends` Prisma pour chiffrement transparent Account |
| `workers/sync-worker/src/index.ts` | +1 / −3 | Remplace `new PrismaClient()` par `import { prisma } from "./lib/prisma"` |
| `package.json` | +3 scripts, +1 devDep | `worker:sync-libs`, `test`, `encrypt-tokens`, vitest |
| `package-lock.json` | auto | Installation vitest + transitives |

## Build & tests

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` (monolith) | ✅ exit 0 |
| `cd workers/sync-worker && npx tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 (Proxy Middleware registered) |
| `npx vitest run` | ✅ 19/19 tests (2 files) |

### Détail des tests

**`token-encryption.test.ts`** (17 tests) :
- Round-trip (5) : simple string, IV randomness, empty string, unicode, long tokens
- Idempotence (2) : double-encrypt skip, legacy plaintext passthrough
- isEncrypted detector (3) : valid, plain/future-version, null/undefined
- Nullable helpers (2) : null passthrough, non-null encryption
- Tampering detection (3) : ciphertext modified, auth tag modified, malformed input
- Key validation (2) : missing, wrong length

**`__tests__/worker-sync.test.ts`** (2 tests) :
- SHA-256 hash match `src/lib/token-encryption.ts` ↔ `workers/sync-worker/src/lib/token-encryption.ts`
- SHA-256 hash match `src/lib/prisma.ts` ↔ `workers/sync-worker/src/lib/prisma.ts`

## Non-régression Sprint 0 / 1.1 / 1.2

| Check | Résultat |
|---|---|
| `requireWebhookSecret` dans Clay/Trigify/N8N/Telegram | ✅ 4 fichiers |
| `Strict-Transport-Security` dans `next.config.ts` | ✅ 1 match |
| Seed routes hors whitelist `src/proxy.ts` | ✅ 0 match |

## Décisions architecturales

### Option A retenue — Duplication contrôlée sync-worker

Le sync-worker est déployé comme service Railway séparé et ne peut pas cross-importer depuis `src/`. Trois options évaluées en Phase 0 :
- **A** : Duplication des fichiers lib avec warnings + test de cohérence SHA-256 *(retenue)*
- **B** : Refactor monorepo avec `packages/core/` (hors scope Sprint 1.3)
- **C** : Chirurgie minimale `encrypt()`/`decrypt()` manuels dans le worker (dette technique)

Justification du choix A : rend **impossible** la classe de bug "nouveau dev oublie d'appeler `decrypt()`", préserve l'invariant "le code métier ne voit jamais de ciphertext".

### Mécanisme de synchronisation

```bash
npm run worker:sync-libs
```
Copie `src/lib/token-encryption.ts` + `src/lib/prisma.ts` → `workers/sync-worker/src/lib/`. Le test `src/lib/__tests__/worker-sync.test.ts` échoue si les fichiers divergent. **Règle d'or** : toujours modifier la copie `src/` en premier, puis `npm run worker:sync-libs`.

### Fallback silencieux en lecture

`decryptAccountRecord` utilise un `try/catch` qui log sans throw si le déchiffrement échoue. C'est volontaire pendant la migration — permet au système de fonctionner même si quelques tokens legacy ont échappé au script. **À retirer après validation migration** (Sprint 1.3bis, commit séparé).

## 🔍 Découverte — Autres champs candidats au chiffrement

Scan du schéma Prisma (`prisma/schema.prisma`) pour tous les champs dont le nom contient `token`, `secret`, `password`, `credential`, `apikey`, `api_key`, `webhooksecret`.

| Modèle | Champ | Type | Statut |
|---|---|---|---|
| Account | `access_token` | String? @db.Text | ✅ **Chiffré ce sprint** |
| Account | `refresh_token` | String? @db.Text | ✅ **Chiffré ce sprint** |
| Account | `id_token` | String? @db.Text | ✅ **Chiffré ce sprint** |
| Account | `token_type` | String? | 🟢 Non sensible (valeur publique type "Bearer") |
| Session | `sessionToken` | String @unique | 🟡 **Candidat moyen** — session cookie token, risque d'impersonation si leaked en DB |
| VerificationToken | `token` | String @unique | 🟡 **Candidat moyen** — email/magic link tokens, short-lived mais sensible |

**Aucun champ** `password`, `secret`, `credential`, `apiKey` trouvé dans le schéma — cohérent avec l'architecture (auth via Google OAuth uniquement, pas de password en DB).

### Recommandations

- **Haute priorité** : aucun — les 3 tokens OAuth sont déjà couverts
- **Moyenne priorité** : `Session.sessionToken` et `VerificationToken.token` — même menace (DB leak → impersonation), mais complexité différente (Session géré par NextAuth adapter, pourrait nécessiter un patch de l'adapter ou un champ séparé)
- **Basse priorité** : aucun
- **Hors scope** : données KYC/KYB (chantier dédié avec considérations régulatoires VQF/GDPR Art. 32)

Décision d'un sprint futur pour `Session.sessionToken` / `VerificationToken.token` — **pas ce sprint**.

**Avant de planifier un Sprint 1.4** : exécuter `SELECT COUNT(*) FROM "VerificationToken";` en prod. Si = 0 (cas probable vu l'auth Google exclusive), ce champ sort du scope. Si > 0, à traiter dans un sprint futur.

**Pour `Session.sessionToken`** : l'impersonation requires d'obtenir à la fois le token ET `userId` et l'implémentation NextAuth expire les sessions à 30j. À évaluer dans un sprint data-protection plus large (ensemble avec KYC/KYB), pas en isolation.

**Sprint futur infrastructure/hardening** : pin exact de `@prisma/client` et `prisma` (retirer le caret `^`) sur les 2 package.json pour garantir qu'un `npm install` Railway ne tire jamais une version mineure divergente entre monolith et worker. Coût : 4 caractères modifiés, valeur : élimination d'une classe de bug par drift de version.

## 🚀 Actions de déploiement — ORDRE CRITIQUE

### Étape 1 — Générer la clé de chiffrement

```bash
openssl rand -base64 32
# Copie le résultat — c'est TOKEN_ENCRYPTION_KEY_V1
```

⚠️ **BACKUP IMMÉDIAT** : cette clé dans 1Password/Bitwarden équipe, nommée `Oxen OS — TOKEN_ENCRYPTION_KEY_V1 (Railway prod)`, avec date.

**Si la clé est perdue** : tous les tokens OAuth deviennent illisibles. Conséquence : tous les users devront se reconnecter à Google (flow OAuth complet).

### Étape 2 — Ajouter la clé sur DEUX services Railway

La variable doit être sur :
- **Service Oxen-OS** (Next.js monolithe) — `TOKEN_ENCRYPTION_KEY_V1`
- **Service sync-worker** — `TOKEN_ENCRYPTION_KEY_V1` (même valeur, impérativement)

Si les deux services ont des clés différentes, les tokens chiffrés par l'un seront illisibles par l'autre → panne silencieuse (Google 401 sur les refresh, emails/calendrier plus sync'és).

Le service **ai-worker n'a pas besoin** de la variable (ne touche pas à Account — vérifié par grep : 0 référence à `prisma.account.*`).

**Ne pas redéployer encore — juste ajouter les env vars.**

### Étape 3 — Push du code

```bash
git push origin main
```

Railway détecte le push et redéploie les 2 services. À ce moment :
- Le nouveau code tourne
- La clé est disponible
- **Les données en base sont encore en clair**
- Grâce au fallback silencieux dans `decryptAccountRecord`, tout continue à fonctionner (les tokens en clair sont retournés tels quels via le try/catch, avec un warn log)

### Étape 4 — Lancer la migration

Une fois Railway déployé et healthy sur les 2 services :

**Option A — Depuis ton Mac, connecté à la DB prod** (recommandé) :

```bash
cd ~/Projects/Oxen-OS  # ou l'emplacement local du repo
export DATABASE_URL="<prod URL depuis Railway>"
export TOKEN_ENCRYPTION_KEY_V1="<même valeur que Railway>"
npm run encrypt-tokens
```

**Option B — Depuis Railway CLI** :
```bash
railway run npm run encrypt-tokens
```

### Étape 5 — Vérifier la migration

Le script affiche :
```
[migration] ==== SUMMARY ====
[migration] Total accounts        : N
[migration] Now encrypted         : M
[migration] Already encrypted     : 0  (si première run)
[migration] Null/undefined fields : X
[migration] Errors                : 0
[migration] Done.
```

Attendu : **Errors = 0**. `Now encrypted` = `3 × (comptes avec au moins 1 token)` environ. `Already encrypted = 0` à la première run.

### Étape 6 — Validation fonctionnelle

1. Connecte-toi à `os.oxen.finance` (doit rester connecté sans problème — NextAuth lit/écrit via l'extension, donc aucun changement visible).
2. Vérifie que les intégrations Google marchent toujours (events Calendar, emails, Drive).
3. Check directement en DB (psql via Railway) :
   ```sql
   SELECT id, provider, LEFT(access_token, 10) as preview
   FROM "Account" LIMIT 5;
   ```
   Tu dois voir `enc:v1:...` comme préfixe. **Pas** `ya29.` ou autre format Google.

### Étape 7 — Cleanup post-migration (Sprint 1.3bis, optionnel)

Une fois la migration validée stable (quelques jours d'usage normal) :
- Retirer le fallback silencieux dans `decryptAccountRecord` (try/catch) → convertir en throw dur pour détecter toute régression future
- Commit séparé : `refactor: remove lenient decrypt fallback post-migration`

## En cas de souci

**Symptôme : "TOKEN_ENCRYPTION_KEY_V1 is not defined" dans les logs Railway**
→ La variable manque sur un des 2 services ou le service n'a pas redémarré. Vérifier les 2 services, redéployer depuis Railway.

**Symptôme : users déconnectés massivement après migration**
→ Probablement la clé de migration ≠ clé Railway. Vérifier l'alignement. Si clés différentes et perte de la clé migration : rotation Google forcée (tous les users doivent reconnecter).

**Symptôme : `decrypt()` throw en production**
→ Un token a un format `enc:v1:...` valide mais le déchiffrement échoue (clé mismatch entre services). Vérifier `TOKEN_ENCRYPTION_KEY_V1` sur Oxen-OS vs sync-worker.

**Symptôme : sync-worker logs "Failed to decrypt Account.access_token"**
→ Signe que le fallback silencieux sauve la situation temporairement. Check : la migration a-t-elle tourné ? Les 2 services ont-ils la même clé ?

## Ce sprint ne fait PAS

- ❌ Pas de génération/backup de clé (à faire par Vernon, cf. Étape 1)
- ❌ Pas d'exécution du script (à faire post-deploy, cf. Étape 4)
- ❌ Pas de modification du schéma Prisma (les champs restent `String?`, chiffrement transparent)
- ❌ Pas de chiffrement de `Session.sessionToken` ni `VerificationToken.token` (sprint futur)
- ❌ Pas de retrait du fallback silencieux (Sprint 1.3bis)
- ❌ Pas de migration vers monorepo / `packages/core` (hors scope, évalué en Option B)
- ❌ Pas de commit / push (fait par Vernon après review)
