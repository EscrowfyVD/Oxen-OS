# Signal decay cron — operator guide

**Sprint S1 batch 3** (logic) **+ Sprint Activate Signal Decay** (HTTP
endpoint) **+ Sprint Cron Setup via GitHub Actions** (trigger). This
cron job recomputes the cached `decayedPoints` field on every active
`IntentSignal` and `MarketSignal` in the database. The scoring engine
reads `decayedPoints` (cached) instead of running the time-decay math
on every dashboard query — this job materializes that cache.

This is the **second cron** activated, following the same pattern
established by the Conference Brief sprint
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
| Trigger (production) | `.github/workflows/signal-decay.yml` (GitHub Actions) |
| Schedule | `0 3 * * *` (daily at 03:00 UTC) |
| Auth (HTTP path) | `Authorization: Bearer <CRON_SECRET>` |
| Required env (Railway) | `DATABASE_URL`, `CRON_SECRET` (HTTP only) |
| Required secret (GitHub) | `CRON_SECRET` (Settings → Secrets → Actions) |
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

## Scheduling — GitHub Actions (canonical)

The cron is triggered by a GitHub Actions workflow committed to the
repo at `.github/workflows/signal-decay.yml`. The workflow does
**one thing**: a curl POST to the HTTP endpoint with the bearer
token. No build, no Node, no Prisma — just a 30-second container
that hits the deployed API. Costs ~30s × 31 daily runs ≈ 16 min/month
on the GitHub Actions free tier (2000-min/month limit).

This replaces an earlier attempt to use **Railway Cron Services**
(separate Railway service per cron, building the full Next.js app
just to run a script). That approach was abandoned for the same
reasons documented in `docs/conference-brief-cron.md` (full Next.js
build was unnecessary, Railway Postgres private networking caused
P1001 deploy failures, logs were truncated, config drifted from
the repo). GitHub Actions provides clean separation: the HTTP
endpoint lives on Railway with the rest of the app; the trigger
lives in the repo as code-reviewable YAML.

### One-time setup

1. **Add `CRON_SECRET` to GitHub repo secrets** — already done if
   you configured the Conference Brief cron first (same secret).
   Otherwise:
   - Go to `https://github.com/EscrowfyVD/Oxen-OS/settings/secrets/actions`
   - Click **New repository secret**
   - Name: `CRON_SECRET`
   - Value: copy from Railway env vars (same secret used by
     `/api/cron/conference-brief` and `/api/lemlist/sync`)
   - Save
2. **Workflow file** is already in the repo at
   `.github/workflows/signal-decay.yml`. No further setup —
   GitHub picks it up automatically once the secret is in place.

### Schedule

```yaml
on:
  schedule:
    - cron: '0 3 * * *'   # daily at 03:00 UTC
```

03:00 UTC was chosen as an off-peak hour to minimize the GitHub
Actions schedule drift risk (the runner queue is least loaded
between 01:00–05:00 UTC). In practice, the daily run lands within
a few minutes of 03:00 UTC most nights.

### Schedule drift caveat

GitHub Actions explicitly documents that scheduled workflows can
be delayed by 15–30 minutes during peak hours. Daily 03:00 UTC is
off-peak so this is rarely visible, but worth noting:
- A 30-min delay on a daily idempotent recompute has zero user
  impact — the dashboard reads `decayedPoints` cache, which is
  refreshed at most one tick later
- Worst-case staleness on a missed run = 24h instead of 24h±30min,
  still under the 1.1%/day drift on 90-day LINEAR signals

If precise timing matters in future, switch to a self-hosted GitHub
runner or use an external scheduler (cron-job.org, EasyCron) hitting
the same `/api/cron/signal-decay` endpoint.

### Manual trigger (replay)

`workflow_dispatch` is enabled on the workflow, so you can run it
manually from the Actions tab:

1. Go to `https://github.com/EscrowfyVD/Oxen-OS/actions/workflows/signal-decay.yml`
2. Click **Run workflow** → **Run workflow** (defaults to `main`)

✅ **Safe to manual-trigger anytime.** Signal decay is fully
idempotent: re-running it produces 0 DB writes for unchanged rows
(per-row skip-if-unchanged + terminal-state fast path). Use this
to materialize `decayedPoints` after a deploy or to debug a stale
signal — no risk of double-counting or duplicate side effects.

### Alternative: local CLI for testing

The CLI script `scripts/cron/recompute-signal-decay.ts` still works
for local validation against any database. It's identical to what
the HTTP endpoint runs internally (same `runSignalDecayRecompute()`
runner) — but bypasses GitHub Actions / curl entirely. See **Manual
smoke test** below.

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
3. **Configure the recurring cron** — add `CRON_SECRET` to GitHub
   repo secrets (Settings → Secrets → Actions). The workflow at
   `.github/workflows/signal-decay.yml` is already in the repo and
   will run automatically once the secret is in place.

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
- Trigger workflow : `.github/workflows/signal-decay.yml`
- Sibling cron pattern : `docs/conference-brief-cron.md` (monthly, non-idempotent)
