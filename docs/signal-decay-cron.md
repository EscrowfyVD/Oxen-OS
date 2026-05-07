# Signal decay cron — operator guide

**Sprint S1 batch 3** (logic) **+ Sprint Activate Signal Decay** (HTTP
endpoint, Railway Cron Service). This cron job recomputes the cached
`decayedPoints` field on every active `IntentSignal` and `MarketSignal`
in the database. The scoring engine reads `decayedPoints` (cached)
instead of running the time-decay math on every dashboard query —
this job materializes that cache.

This is the **second cron** activated on Railway, following the same
pattern established by the Conference Brief sprint
(`docs/conference-brief-cron.md` + commit `8b0a785`). Reuses the
shared `CRON_SECRET` for the HTTP variant. The `/api/cron/*` whitelist
is already present in `src/proxy.ts` from that sprint.

---

## TL;DR

| Item | Value |
|---|---|
| HTTP endpoint | `POST /api/cron/signal-decay` |
| CLI script | `npx tsx scripts/cron/recompute-signal-decay.ts` |
| Pure helper | `src/lib/signal-decay.ts` (`calculateDecayedPoints`) |
| Orchestration | `src/lib/signal-decay-runner.ts` (`runSignalDecayRecompute`) |
| Schedule (recommended) | `0 3 * * *` (daily at 03:00 UTC) |
| Auth (HTTP path) | `Authorization: Bearer <CRON_SECRET>` |
| Required env | `DATABASE_URL`, `CRON_SECRET` (HTTP only) |
| Idempotent | **Yes** — re-running produces 0 writes for unchanged rows |
| Expected duration | < 30 s for ~10k signals; chunked at 1000 / batch |

---

## What it does

For every `IntentSignal` and `MarketSignal` row :

1. Reads the row's `points` (immutable original score), the linked
   `SignalTypeRegistry` entry's `decayCurve` + `decayDays`, and the
   anchor timestamp (`createdAt` for IntentSignal — the route handler
   sets that to the real-world event time at insert; `occurredAt` for
   MarketSignal).
2. Calls `calculateDecayedPoints(points, anchor, decayDays, curve, now)`
   → returns the integer current value of the signal (0 ≤ result ≤
   `points`).
3. If the new value **matches** the stored `decayedPoints` → **skip**
   the write (idempotent — no DB churn for unchanged rows).
4. If the row has expired (`expiresAt <= now`) AND its
   `decayedPoints` is already 0 → **skip** via fast path (terminal
   state — recomputing would always yield 0).
5. Otherwise, queue an UPDATE. Updates are flushed in chunks of
   **1000** via `prisma.$transaction(callback, { timeout: 60_000 })`.

The job emits a structured log line at the end with stats per table
(CLI variant):
```
=== Signal decay recompute — 2026-05-06T03:00:00Z ===

--- IntentSignal ---
  scanned=2540 updated=812 skippedUnchanged=1623 skippedTerminal=105

--- MarketSignal ---
  scanned=18 updated=4 skippedUnchanged=14 skippedTerminal=0

Total: scanned=2558 updated=816 durationMs=14238
```

The HTTP variant returns the same data as JSON.

---

## Decay curves

Defined in `SignalTypeRegistry.decayCurve` (Prisma enum
`SignalDecayCurve`). Each curve interpolates from full points at
`occurredAt` to 0 at `occurredAt + decayDays`.

| Curve | Shape | Use case |
|---|---|---|
| `LINEAR` | Straight line, points × (1 − ratio) | Generic intent signals (default for Clay/Trigify legacy) |
| `EXPONENTIAL` | Half-life at `decayDays/2`, sharp early decay + long tail | Time-sensitive signals (funding rounds, hiring announcements) |
| `STEP` | 3 paliers: 100% (< 33%) / 50% (33–66%) / 0% (≥ 66%) | Hard-cliff signals (regulatory changes, where the analyst wants distinct phases) |

Edge cases handled by `calculateDecayedPoints`:

- `originalPoints === 0` → always 0
- `decayDays <= 0` → returns originalPoints (signal is **permanent**, never decays)
- `now < occurredAt` → returns originalPoints (clock drift / backdated insert; signal hasn't started decaying)
- `elapsedDays >= decayDays` → returns 0 (clamp; matches the "expired" semantic)
- All results are clamped to `Math.max(0, …)` and rounded to integers
  (Math.round) — never negative, never fractional.

See `src/lib/signal-decay.test.ts` for 21 unit tests covering all
curves + edge cases.

---

## Railway Cron setup (one-time)

This is the **second cron service** in the Oxen OS Railway project
(after `oxen-os-cron-conference-brief`). Uses the same Option A
pattern (separate service via Railway dashboard) since Railway
Nixpacks doesn't currently support inline `crons[]` arrays in
`railway.json`.

### Steps

1. Open the Railway project → **+ New Service** → **GitHub Repo** →
   pick `EscrowfyVD/Oxen-OS`.
2. Name the service `oxen-os-cron-signal-decay`
   (or `cron-signal-decay`).
3. In **Settings → Build** :
   - Builder : `Nixpacks`
   - Build Command : `npx prisma generate && npm install`
     (skip `migrate deploy` and `next build` — this service doesn't
     serve HTTP, it just runs the script once per cron tick)
4. In **Settings → Deploy** :
   - Start Command : `npx tsx scripts/cron/recompute-signal-decay.ts`
   - **Cron Schedule** : `0 3 * * *`
   - Restart Policy : `Never` (the script exits after a single run)
5. In **Variables** : copy the `DATABASE_URL` from the main `oxen-os`
   service. (`CRON_SECRET` is **NOT** required for the CLI path — only
   the HTTP endpoint uses it.)
6. **Deploy** the service.

After the first successful cron tick, you'll see a Deployment log
with the structured stats output of the script.

### Alternative: HTTP endpoint via external scheduler

If you'd rather centralize all crons on an external scheduler
(e.g. cron-job.org, GitHub Actions, etc.), the HTTP endpoint at
`POST /api/cron/signal-decay` accepts a Bearer token and runs the
same logic as the CLI script. Example with GitHub Actions :

```yaml
# .github/workflows/signal-decay.yml
name: Signal Decay Daily
on:
  schedule:
    - cron: "0 3 * * *"
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -X POST https://os.oxen.finance/api/cron/signal-decay \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -w "\nHTTP %{http_code}\n"
```

The Bearer token is the value of `CRON_SECRET` env var on Railway
(same secret used by `/api/cron/conference-brief` and
`/api/lemlist/sync`).

---

## Manual smoke test

### From your laptop (DATABASE_URL points to Railway prod)

```bash
cd /path/to/Oxen-os
source ~/.zshrc
npx tsx scripts/cron/recompute-signal-decay.ts
```

Expected output on a fresh DB (0 signals — Sprint S0 baseline):

```
=== Signal decay recompute — 2026-05-07T...Z ===

--- IntentSignal ---
  scanned=0 updated=0 skippedUnchanged=0 skippedTerminal=0

--- MarketSignal ---
  scanned=0 updated=0 skippedUnchanged=0 skippedTerminal=0

Total: scanned=0 updated=0 durationMs=12

=== End ===
```

The job is **safe to run any time** — fully idempotent. The dashboard
will show fresher `decayedPoints` after a manual run if any drift had
accumulated since the last automated tick.

### From `curl` against the deployed HTTP endpoint

```bash
SECRET="<CRON_SECRET-from-Railway>"
curl -X POST https://os.oxen.finance/api/cron/signal-decay \
  -H "Authorization: Bearer $SECRET" \
  -w "\nHTTP %{http_code}\n"
```

Expected response (200) on a populated DB :

```json
{
  "success": true,
  "startedAt": "2026-05-07T03:00:00.000Z",
  "finishedAt": "2026-05-07T03:00:14.238Z",
  "durationMs": 14238,
  "intent": {
    "scanned": 2540,
    "updated": 812,
    "skippedUnchanged": 1623,
    "skippedTerminal": 105
  },
  "market": {
    "scanned": 18,
    "updated": 4,
    "skippedUnchanged": 14,
    "skippedTerminal": 0
  },
  "totalScanned": 2558,
  "totalUpdated": 816
}
```

### Auth failure modes

| Request | Status | Body |
|---|---|---|
| No Authorization header | 401 | `{ "error": "Missing bearer token" }` |
| Wrong bearer | 401 | `{ "error": "Invalid bearer token" }` |
| `CRON_SECRET` unset on server | 503 | `{ "error": "Cron secret not configured" }` |

---

## Frequency tuning

The default daily cadence trades off two costs:

- **More frequent** (e.g. hourly): smaller `decayedPoints` lag for
  dashboard reads, but more DB write traffic. For a daily-resolution
  scoring engine this is wasted work.
- **Less frequent** (e.g. weekly): up to 7 days of staleness on
  dashboard reads. For LINEAR/EXPONENTIAL curves this is visible —
  a 90-day-decay signal would be off by ~7.7% (linear) or worse
  (exponential).

**Once per day at 03:00 UTC** is the recommended balance:
- Off-peak window (low-traffic for ops dashboards).
- Sub-1% lag on most curves (90-day LINEAR: 1.1% per day).
- Single-digit MB of DB write traffic per run.

---

## Debugging a signal with wrong `decayedPoints`

If a single signal looks off in the UI :

1. Find the signal id from the UI or via `prisma studio`.
2. Read the row + its registry entry :
   ```sql
   SELECT s.id, s.points, s."decayedPoints", s."createdAt", s."expiresAt",
          r.code, r."decayDays", r."decayCurve"
   FROM "IntentSignal" s
   JOIN "SignalTypeRegistry" r ON r.id = s."signalTypeId"
   WHERE s.id = '<id>';
   ```
3. Re-run the math by hand (or via a Node REPL with the helper) :
   ```js
   const { calculateDecayedPoints } = require("./src/lib/signal-decay")
   calculateDecayedPoints(
     row.points,
     row.createdAt,
     row.decayDays,
     row.decayCurve,
     new Date()
   )
   ```
4. If the manual result differs from the stored `decayedPoints`, the
   cron has not run since the math drifted — kick off a manual run
   (CLI or curl) and re-check.
5. If the manual result matches and the UI is still wrong, the bug is
   downstream of `decayedPoints` (scoring aggregation, UI render,
   etc.) — file a separate ticket.

---

## Deploy checklist (post-Sprint S1 + Sprint Activate Signal Decay)

After `prisma migrate deploy` runs the
`add_signal_universal_ingestion` migration on Railway :

1. **Optional but recommended** — run the registry seed first :
   ```bash
   npx tsx scripts/db/seed-signal-types.ts
   ```
   The legacy webhooks (clay/trigify/n8n) will auto-upsert their own
   placeholders if the seed hasn't run, so this is *not* a hard
   prerequisite for the runtime — but the canonical 4 codes need to
   exist before `POST /api/signals` can ingest them strictly.
2. **Optional** — kick off a one-time manual cron run to materialize
   `decayedPoints` for any existing signals :
   ```bash
   npx tsx scripts/cron/recompute-signal-decay.ts
   ```
   On a fresh Railway DB with 0 IntentSignal rows (verified Sprint
   S0 baseline), this is a no-op and prints `scanned=0 updated=0`.
3. **Configure the recurring cron** — create the Railway Cron Service
   per the steps above so the cache stays fresh going forward.

---

## Refs

- PRD-001 §4.2 Signal Universal Ingestion (Sprint S1)
- `src/lib/signal-decay.ts` — pure helper
- `src/lib/signal-decay.test.ts` — 21 unit tests
- `src/lib/signal-decay-runner.ts` — orchestration (Sprint Activate Signal Decay)
- `src/lib/signal-decay-runner.test.ts` — 11 mocked-Prisma tests
- `src/app/api/cron/signal-decay/route.ts` — HTTP endpoint
- `src/app/api/cron/signal-decay/route.test.ts` — auth + delegate tests
- `scripts/cron/recompute-signal-decay.ts` — CLI script
- `prisma/schema.prisma` — `IntentSignal`, `MarketSignal`, `SignalTypeRegistry`
- Pattern reference : `docs/conference-brief-cron.md` (first cron deployed)
