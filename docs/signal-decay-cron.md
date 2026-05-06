# Signal decay cron — operator guide

**Sprint S1 batch 3.** This cron job recomputes the cached
`decayedPoints` field on every active `IntentSignal` and `MarketSignal`
in the database. The scoring engine reads `decayedPoints` (cached)
instead of running the time-decay math on every dashboard query —
this job materializes that cache.

---

## TL;DR

| Item | Value |
|---|---|
| Script | `scripts/cron/recompute-signal-decay.ts` |
| Helper | `src/lib/signal-decay.ts` (`calculateDecayedPoints`) |
| Recommended cadence | **Once per day at 03:00 UTC** |
| Required env | `DATABASE_URL` (same as the rest of the app) |
| Idempotent | Yes — re-running it produces 0 writes for unchanged rows |
| Run command | `npx tsx scripts/cron/recompute-signal-decay.ts` |
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
   **1000** via `prisma.$transaction(updates, { timeout: 60_000 })`.

The job emits a structured log line at the end with stats per table:
```
=== Signal decay recompute (Sprint S1 batch 3) — 2026-05-06T03:00:00Z ===

--- IntentSignal ---
  scanned=2540 updated=812 skippedUnchanged=1623 skippedTerminal=105

--- MarketSignal ---
  scanned=18 updated=4 skippedUnchanged=14 skippedTerminal=0
```

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

## Scheduling on Railway

Railway has native cron support via the **Railway Cron** feature
(or via a separate cron service). Recommended setup:

### Option A — Railway Cron (preferred)

In `railway.toml` (or via Railway dashboard → service → Settings →
Cron):

```toml
[cron.signal-decay]
schedule = "0 3 * * *"  # daily at 03:00 UTC
command = "npx tsx scripts/cron/recompute-signal-decay.ts"
```

Railway will run the command on the same container that has access to
`DATABASE_URL` and the rest of the env vars — no extra setup needed.

### Option B — GitHub Actions (fallback)

If Railway Cron is unavailable, schedule via `.github/workflows/`:

```yaml
name: Signal decay cron
on:
  schedule:
    - cron: "0 3 * * *"
jobs:
  recompute:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx prisma generate
      - run: npx tsx scripts/cron/recompute-signal-decay.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Note: GH Actions runs on a separate VM — DATABASE_URL must be set as
a repo secret. Railway-side this is automatic.

### Option C — Manual / on-demand

Operators can run it any time from a local checkout:

```bash
source ~/.zshrc  # NVM
cd /path/to/Oxen-os
npx tsx scripts/cron/recompute-signal-decay.ts
```

This is also the approach for the **first run after deploy** — the
cron schedule won't trigger until 03:00 UTC, so kick off a manual
run after applying the migration to materialize `decayedPoints` for
the initial set of signals.

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
   (Option C above) and re-check.
5. If the manual result matches and the UI is still wrong, the bug is
   downstream of `decayedPoints` (scoring aggregation, UI render,
   etc.) — file a separate ticket.

---

## Deploy checklist (post-Sprint S1 push)

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
3. **Configure the recurring cron** (Option A above) so the cache
   stays fresh going forward.

---

## Refs

- PRD-001 §4.2 Signal Universal Ingestion (Sprint S1)
- `src/lib/signal-decay.ts` — pure helper
- `src/lib/signal-decay.test.ts` — 21 unit tests
- `scripts/cron/recompute-signal-decay.ts` — cron script
- `scripts/cron/recompute-signal-decay.test.ts` — 8 mocked-Prisma tests
- `prisma/schema.prisma` — `IntentSignal`, `MarketSignal`, `SignalTypeRegistry`
