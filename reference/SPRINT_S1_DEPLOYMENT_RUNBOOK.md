# Sprint S1 — Deployment Runbook

> **Status** : DRAFT for Vernon review. Steps 1–2 are Vernon's exact
> instructions; steps 3+ are **extrapolated** based on Sprint S1 batch
> patterns (the original instruction was truncated mid-Step 3 in
> Vernon's chat — see "Extrapolation note" at the bottom). Edit
> freely before push.

This runbook covers the deployment of **Sprint S1 — Universal Signal
Ingestion** (4 commits local, not yet pushed) :

```
1e231b4  feat(webhooks): Clay enrichment optional signal emission   (Batch 4)
6565351  feat(signal): time decay helpers + cron precompute script  (Batch 3)
af30e11  feat(api): POST /api/signals universal ingestion endpoint  (Batch 2)
a11161a  feat(prisma): universal signal ingestion schema + ...       (Batch 1)
```

The migration `prisma/migrations/20260506114414_add_signal_universal_ingestion/`
is included in commit `a11161a` but **NOT yet applied** to Railway —
it will be applied automatically by Railway when the push triggers
the redeploy (`prisma migrate deploy` runs as part of the build
script).

---

## Pre-deployment checklist

- [ ] **DB Railway backup confirmed** (timestamp : 2026-05-06 ~15:20)
- [ ] Vérifier 0 IntentSignal en prod :
  ```sql
  SELECT COUNT(*) FROM "IntentSignal";
  ```
  Doit retourner `0` (vérifié au baseline Sprint S0). Si > 0, le
  `DROP COLUMN raw, score` de la migration causera perte de données
  → STOP + investiguer avant de pousser.
- [ ] Vérifier que Sprint S0 / S0.5 fonctionnent normalement (smoke
  test rapide) :
  - `/crm/contacts` charge, badges Group/PainTier visibles sur les G1-T1
  - `/crm/companies` charge, cards avec badges Group + PainTier visibles
  - `/crm` tab Companies → "Open Companies →" link fonctionne
- [ ] Confirm que `SIGNALS_INGESTION_SECRET` est défini sur Railway
  (vars env). **Required** : le webhook /api/signals refuse de
  démarrer si la var est absente. Generate via :
  ```bash
  openssl rand -hex 32
  ```
- [ ] Confirm que le secret est sauvegardé dans 1Password / vault
  AVANT de coller dans Railway (Railway ne permet pas la re-lecture).
- [ ] `npm test` local clean : 230 tests passing.
- [ ] `npm run build` local clean.
- [ ] `git log --oneline origin/main -5` pour confirmer le HEAD distant
  (`91366a6`) — on push 4 commits par-dessus.

---

## Deployment sequence

### Step 1 — Push commits to origin/main

```bash
cd /path/to/Oxen-os
git push origin main
```

Cela déclenche Railway redeploy automatique (le service `oxen-os` est
configuré pour rebuild on push to main).

**Range pushé attendu** : `91366a6..1e231b4` (4 commits).

---

### Step 2 — Surveiller Railway build (~3-5 min)

Ouvrir le dashboard Railway → service `oxen-os` → Deployments →
suivre le rollout du nouveau deploy.

Étapes Railway :
- **Build** : `npm install` + `prisma generate` + `next build` (~2-3 min)
- **Migration** : `prisma migrate deploy` applique
  `20260506114414_add_signal_universal_ingestion/migration.sql`
  automatiquement (~5-10 sec)
- **Health check** : Railway probe l'endpoint root jusqu'à ce que le
  serveur réponde
- **Traffic switch** : ancienne instance terminée, nouvelle reçoit
  le trafic

Logs critiques à surveiller dans Railway dashboard (filter par
"prisma" / "ready") :

```
✔ The following migration(s) have been applied:
  20260506114414_add_signal_universal_ingestion

Server is ready on http://0.0.0.0:8080
```

Si la migration **fail** :
- Lire l'erreur Postgres dans les logs Railway
- Le push global laisse le code en place mais sans le schema migré
  → endpoints S1 vont crash au runtime
- Solutions : voir section "Rollback plan" ci-dessous

---

### Step 3 — Run seed canonical (1× post-deploy) **[extrapolated]**

Une fois Railway au vert, run le seed pour créer les 4 SignalTypeRegistry
canonical entries. Sans ce seed, `POST /api/signals` retournera 400
"Unknown signal type code" pour les codes canonical (mais les 3
webhooks legacy continueront à upserter leurs propres placeholders
sans souci).

**Option A — depuis ton laptop (DATABASE_URL pointe Railway prod)** :

```bash
cd /path/to/Oxen-os
source ~/.zshrc
npx tsx scripts/db/seed-signal-types.ts
```

Output attendu :

```
=== SignalTypeRegistry seed (Sprint S1 batch 1) ===

Upserted 7 entries:
  - clay_business_loss
  - clay_director_change
  - linkedin_post_funding
  - market_country_regulation_change
  - clay_legacy_intent
  - trigify_intent_signal
  - n8n_external_signal

=== End ===
```

**Option B — via Railway shell** (si Railway CLI configuré) :

```bash
railway run npx tsx scripts/db/seed-signal-types.ts
```

Le seed est **idempotent** — re-running ne crée pas de doublons et
preserve les valeurs operator-tweaked (l'`update: {}` dans l'upsert
est intentionnel, voir doc en tête de `seed-signal-types.ts`).

---

### Step 4 — Smoke test POST /api/signals **[extrapolated]**

Ingérer un signal de test pour vérifier le bout en bout production.

**Test 1 — scope=market sans contact, signal canonical** :

```bash
SECRET="<your-SIGNALS_INGESTION_SECRET-value>"
curl -X POST https://os.oxen.finance/api/signals \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "market",
    "country": "United Arab Emirates",
    "signalTypeCode": "market_country_regulation_change",
    "metadata": {"smokeTest": true, "deployedAt": "2026-05-06"},
    "notes": "Sprint S1 deploy smoke test — DELETE after verification"
  }'
```

Réponse attendue (200) :

```json
{
  "success": true,
  "scope": "market",
  "signal": {
    "id": "ck...",
    "country": "United Arab Emirates",
    "signalTypeId": "ck...",
    "points": 50,
    "decayedPoints": null,
    "occurredAt": "2026-05-06T...",
    "expiresAt": "2026-11-02T...",  // occurredAt + 180 days
    ...
  }
}
```

**Test 2 — scope=contact avec un G1-T1 existant** :

Choisir un contactId G1-T1 connu (ex: query rapide) :
```sql
SELECT id, "firstName", "lastName" FROM "CrmContact"
WHERE "group" = 'G1' AND "painTier" = 'T1'
LIMIT 1;
```

Puis curl :
```bash
curl -X POST https://os.oxen.finance/api/signals \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "contact",
    "contactId": "<contactId-from-above>",
    "signalTypeCode": "clay_business_loss",
    "metadata": {"smokeTest": true},
    "notes": "Sprint S1 smoke test — contact scope"
  }'
```

Réponse attendue (200) avec `companyId` auto-denormalized.

**Test 3 — auth fail-closed (SANS Bearer)** :

```bash
curl -X POST https://os.oxen.finance/api/signals \
  -H "Content-Type: application/json" \
  -d '{"scope":"market","country":"Cyprus","signalTypeCode":"market_country_regulation_change"}'
```

Réponse attendue : 401 (pas de Bearer + pas de session) OU redirect /login.

**Test 4 — strict registry lookup** :

```bash
curl -X POST https://os.oxen.finance/api/signals \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "market",
    "country": "Cyprus",
    "signalTypeCode": "totally_unknown_typo"
  }'
```

Réponse attendue : 400 "Unknown signal type code".

---

### Step 5 — Cleanup smoke test signals **[extrapolated]**

Pour ne pas polluer la prod avec des signals de test :

```sql
DELETE FROM "MarketSignal" WHERE notes LIKE '%smoke test%';
DELETE FROM "IntentSignal" WHERE notes LIKE '%smoke test%';
```

Vérifier les comptages après :
```sql
SELECT COUNT(*) FROM "IntentSignal";   -- should be 0 (or very small)
SELECT COUNT(*) FROM "MarketSignal";   -- should be 0
SELECT COUNT(*) FROM "SignalTypeRegistry";  -- should be 7
```

---

### Step 6 — Configure decay cron **[extrapolated]**

Voir `docs/signal-decay-cron.md` pour les 3 options de scheduling.
**Reco** : Railway Cron daily 03:00 UTC.

**Option A — Railway Cron** (preferred, si dispo sur ton plan) :

Dans Railway dashboard → service `oxen-os` → Settings → Cron jobs :
```toml
[cron.signal-decay]
schedule = "0 3 * * *"
command = "npx tsx scripts/cron/recompute-signal-decay.ts"
```

**Option B — Skip pour l'instant** :

Au stade actuel (post-Sprint S1, avant Sprint S2 Lemlist signals)
la DB a 0 IntentSignal et 0 MarketSignal hors smoke tests. Le cron
serait un no-op. Configurer le cron au moment où Sprint S2 / S3
commence à ingérer des signaux réels (Lemlist replies, LinkedIn
events).

**Option C — Manuel one-shot** post-deploy pour valider le script :

```bash
npx tsx scripts/cron/recompute-signal-decay.ts
```

Output attendu sur DB fraîche :
```
=== Signal decay recompute ... ===

--- IntentSignal ---
  scanned=0 updated=0 skippedUnchanged=0 skippedTerminal=0

--- MarketSignal ---
  scanned=0 updated=0 skippedUnchanged=0 skippedTerminal=0

=== End ===
```

---

### Step 7 — Final validation **[extrapolated]**

- [ ] Sprint S0 / S0.5 fonctionnent toujours (regression check) :
  - `/crm/contacts` charge, badges G1-T1 visibles
  - `/crm/companies` charge, badges visibles
  - Cmd+K palette fonctionne
- [ ] DB state :
  - `SELECT COUNT(*) FROM "SignalTypeRegistry"` → 7
  - `SELECT COUNT(*) FROM "IntentSignal"` → 0
  - `SELECT COUNT(*) FROM "MarketSignal"` → 0
- [ ] Endpoint `/api/signals` répond 401 sans auth, 200 avec auth
  valid sur scope canonical.
- [ ] Webhook Clay enrichment continue à fonctionner sur Phase 2
  payloads (sans `signals[]`) — lance un curl test contre une
  Company existante.
- [ ] Logs Railway propres (no error spam, no Sentry alerts).

Si tout green, **deploy validé** — annoncer à Andy / Duy que les
nouveaux endpoints sont live et que les intégrations Sprint S2+
peuvent commencer à pousser des signaux.

---

## Rollback plan

Si la migration ou le push cause un problème en prod :

### Scenario A — Migration applied, code crashes

Le code S1 attend le nouveau schema → si bug runtime, on peut soit :
1. **Push hotfix** au-dessus (forward) — préférer si bug isolé.
2. **Revert via git** : `git revert 1e231b4 6565351 af30e11 a11161a`
   et push. Mais la migration `add_signal_universal_ingestion` est
   déjà appliquée → revert du code seul laisserait la DB avec des
   colonnes/tables nouvelles, ce qui est OK (les anciens endpoints
   ne touchent pas aux nouvelles colonnes).
3. **Migration down** (last resort) : pas de support natif Prisma
   pour `migrate down`. Il faudrait écrire un nouveau migration SQL
   inverse `DROP TABLE / DROP COLUMN`. **Ne pas faire sauf urgence**.

### Scenario B — Migration fails to apply

Si Postgres refuse la migration (par ex. `IntentSignal` a des rows
malgré la pré-check), Railway redéploie l'ancien code AVEC l'ancien
schema. Pas de corruption.

Action :
1. Investiguer la cause (logs Postgres dans Railway).
2. Si data trouvée dans `IntentSignal` non-attendue : décider
   data-cleanup vs schema-adjust.
3. Re-pousser après fix.

### Scenario C — Bearer auth bug

Si un attacker brute-force ou si on suspecte secret leak :
1. Generate un nouveau secret : `openssl rand -hex 32`.
2. Update `SIGNALS_INGESTION_SECRET` sur Railway.
3. Update les intégrations server-side (1Password / Vault).
4. Le secret rotation est instantanée — Railway redéploie automatiquement.

---

## Post-deploy follow-ups (not blocking)

- [ ] Update `PRD_001_MAPPING.md` v3.7 → v3.8 si besoin de noter
  "Sprint S1 DEPLOYED 2026-05-XX" avec le timestamp réel.
- [ ] Annoncer à Andy + Duy que `/api/signals` est live + partager
  `SIGNALS_INGESTION_SECRET` (1Password vault).
- [ ] Plan Sprint S2 (Lemlist hardening + signals integration).

---

## Extrapolation note

> **Important pour Vernon** : ton message "GO Batch 5 PHASE 5A"
> contenait la séquence complète des steps 1-2 explicitement, mais
> la phrase au step 3 a été tronquée à "Une fois Railway au vert :"
> dans le chat. J'ai extrapolé les steps 3-7 + rollback + post-deploy
> en me basant sur :
>
> - Les patterns que nous avons établis dans les batches Sprint S1
>   (seed canonical, smoke test patterns, cron config).
> - La doc `docs/signal-decay-cron.md` (Batch 3) pour le scheduling.
> - La doc `docs/clay-setup-guide.md` (Sprint S0 + Batch 4) pour les
>   smoke test patterns.
>
> **Lis attentivement les sections marquées `[extrapolated]`** avant
> de pousser. Édite librement si tu veux des étapes différentes,
> retirer des étapes optionnelles, ou ajouter des étapes spécifiques
> que je n'ai pas pu deviner.
>
> Ce qui est clairement spec'é par Vernon (steps 1-2) reste verbatim.

---

## References

- Sprint S1 commits : `a11161a` `af30e11` `6565351` `1e231b4`
- Migration : `prisma/migrations/20260506114414_add_signal_universal_ingestion/migration.sql`
- Seed script : `scripts/db/seed-signal-types.ts`
- Cron script : `scripts/cron/recompute-signal-decay.ts`
- Cron doc : `docs/signal-decay-cron.md`
- Clay setup guide : `docs/clay-setup-guide.md` §10 (Sprint S1 batch 4 signal emission)
- PRD : `PRD_001_MAPPING.md` v3.7 §11.4
