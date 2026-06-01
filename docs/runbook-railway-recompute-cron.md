# Runbook — Reliable score-recompute cron on Railway

**Goal.** Replace the unreliable GitHub Actions schedule for the hourly score
recompute with a **Railway cron service**. GitHub's scheduler is best-effort and
drops ticks (observed gaps of 5–6h), so score freshness degrades to multi-hour.
Railway runs on the same infra as prod, on a dedicated cron, with no external
dependency.

**Status.** In-repo entrypoint shipped (`npm run recompute:cron`). The Railway
service must be created **in the Railway dashboard** (steps below) — that part is
not in the repo. During transition the GitHub workflow stays on; both are
idempotent so running them in parallel is safe (see §5).

---

## 1. What the cron runs

```
npm run recompute:cron   →   npx tsx scripts/db/run-recompute.ts   →   runScoreRecompute()
```

- **`runScoreRecompute()`** (`src/lib/scoring/score-recompute-runner.ts`) is the
  exact same function the HTTP endpoint `/api/cron/recompute-scores` calls, with
  the same (no) arguments — **iso-behavior** with the current GHA trigger. It
  recomputes every scoring-active `CrmContact` (`persistScore`) and fires BD
  Telegram alerts on P-level promotions.
- **Run-to-completion**: the script runs the batch, prints
  `{ processed, promoted, errors, durationMs }`, and exits 0 (exit 1 on a thrown
  error). Verified locally end-to-end against a Postgres shadow — exits cleanly
  (~0.5s for an empty pool; ~2s for the current ~10-contact pool). No HTTP, no
  long-running server → ideal for a cron that must terminate each tick.
- **No `CRON_SECRET`** needed: the script calls the runner directly, bypassing
  the endpoint's HTTP bearer auth. It only needs DB access (+ Telegram token for
  alerts).

---

## 2. Create the Railway cron service (dashboard — Vernon)

In the **same Railway project** as the `os.oxen.finance` web service:

1. **New → GitHub Repo → `EscrowfyVD/Oxen-OS`** (same repo as the web service).
   Name it e.g. `score-recompute-cron`.
2. **Settings → Source → Root Directory**: leave as repo root (`/`). The script
   lives in the root project (`scripts/db/`, `src/lib/`), not in `workers/`.
3. **Settings → Build → Build Command** (override the root `railway.json`):
   ```
   npm install && npx prisma generate
   ```
   Deliberately **no `next build`** (the cron doesn't serve HTTP) and **no
   `prisma migrate deploy`** — the web service owns migrations; running it here
   too would have two services racing `migrate deploy` on each deploy.
4. **Settings → Deploy → Start Command** (override):
   ```
   npm run recompute:cron
   ```
5. **Settings → Cron Schedule**:
   ```
   47 * * * *
   ```
   Hourly. **Offset to :47 (not :17) during the parallel transition** so the
   Railway tick never coincides with GHA's :17 — zero simultaneous overlap, plus
   ~2× interim coverage (a tick roughly every 30 min across the two). After GHA
   is decommissioned (§6), keep :47 or move back to :17 — immaterial once GHA is
   gone. Promotion-detection latency stays ≤1h either way.
6. **Settings → Deploy → Restart Policy**: leave default / "On Failure". Railway
   cron semantics treat a clean exit (0) as "job done", not a crash — it will
   **not** loop. (A non-zero exit will retry per policy, which is what we want
   for a transient DB blip.)

### Required environment variables (Variables tab)

| Variable | Why | Source |
|---|---|---|
| `DATABASE_URL` | Prisma — the recompute reads/writes prod DB | **Reference the Postgres service** (same value the web service uses), do NOT paste a literal |
| `CRM_BD_EMAILS` | comma-separated BD emails that receive promotion alerts. **Empty → alerts are skipped entirely** (`alertBDsOnPromotion` early-returns `no_bd_emails`). Required for Option 3's whole point (timely alerts) | same value as the web service |
| `TELEGRAM_BOT_TOKEN` | delivers each alert to the BD's `telegramChatId` (`notifyEmployee`). Without it, alerts are silently skipped; the recompute itself still succeeds | same value as the web service |

> All three alert-path vars (`CRM_BD_EMAILS`, `TELEGRAM_BOT_TOKEN`, plus each BD's
> `telegramChatId` set via /team) must be present for promotion alerts to fire —
> exactly as on the web service. Missing any one → recompute still succeeds, alert
> is silently skipped.

`CRON_SECRET` is **not** required here (no HTTP hop). If Railway doesn't inject
`NODE_ENV`, set `NODE_ENV=production`.

> Tip: the existing `workers/ai-worker` service is the template — same
> `npm install && npx prisma generate` build, a `tsx`-based start command, same
> project. The cron differs only in (a) root dir = repo root, (b) start command,
> (c) a Cron Schedule is set.

---

## 3. Verify it fires

**Railway logs** (cron service → Deployments → latest run logs) should show, once
per scheduled tick:
```
=== runScoreRecompute (manual batch) ===
{ "processed": <n>, "promoted": <m>, "errors": [], "durationMs": <ms> }
```

**Database** (read-only) — `ScoreHistory.computedAt` should advance each run:
```sql
SELECT max("computedAt")                       AS latest_write,
       count(*) FILTER (WHERE "computedAt" > now() - interval '3 hours') AS rows_last_3h
  FROM "ScoreHistory";
```
After a few ticks, `latest_write` should be < ~1h old and a fresh cluster of rows
(~scored-pool size) should appear each hour — without the multi-hour gaps GHA
showed.

---

## 4. Promotion-alert sanity

A run only Telegram-alerts a contact whose `newLevel` ranks strictly above its
previous persisted level. Because each run persists the new level first, a
*subsequent* run sees `previousLevel == newLevel` → no re-alert. So re-running
(or running GHA + Railway in parallel, §5) does **not** double-alert.

**Exit-safe.** Alerts are awaited end-to-end: `runScoreRecompute()` `await`s
`alertBDsOnPromotion()`, which `await`s `Promise.all(...)` of the per-recipient
Telegram sends. The runner does not resolve until every alert completes, so the
cron's process exit cannot truncate an in-flight alert. (The "fire-and-forget"
in the code comments means "an alert failure must not roll back ScoreHistory",
not an un-awaited promise.) Verified by code; consistent with the clean ~0.5s
exit on a no-promotion run.

---

## 5. Transition: GHA + Railway in parallel (safe)

**Do NOT disable the GitHub workflow yet.** Leave
`.github/workflows/recompute-scores.yml` active while the Railway cron is being
proven. Running both is safe:

- `runScoreRecompute()` is **idempotent** — last-write-wins on the `CrmContact`
  scoring columns (Sprint 3c decision D8); `ScoreHistory` is append-only, so a
  double fire just writes two audit rows close in time (harmless).
- No double-counting of side effects, no double promotion alerts (§4).
- Net effect during transition: **zero gaps** — whichever trigger fires keeps
  scores fresh.

## 6. Decommission GHA (follow-up — AFTER the Railway cron is proven)

Once the Railway cron has run reliably for a few days (verify via §3 — steady
hourly `computedAt` advance, no multi-hour gaps):

1. Disable or delete `.github/workflows/recompute-scores.yml` (separate PR).
2. Optionally keep `workflow_dispatch` as a manual fallback by trimming the file
   to just the `workflow_dispatch:` trigger (drop the `schedule:` block).

This runbook's PR does **not** touch the workflow — decommission is a deliberate,
separate step.

---

## 7. Troubleshooting

- **Cron service never exits / overlaps** — the script self-exits cleanly today.
  If a future dependency ever holds the event loop open (e.g. a logging
  transport), add an explicit `process.exit(0)` after the success log in
  `scripts/db/run-recompute.ts`. (Not needed now; flagged for awareness.)
- **`processed: 0` every run** — expected while the scoring pool is ~10 and all
  contacts are excluded except the active set; confirm the pool with
  `SELECT count(*) FROM "CrmContact" WHERE NOT ('scoring' = ANY("excludedFrom"));`
- **Alerts not sending** — `TELEGRAM_BOT_TOKEN` missing on the cron service, or
  recipients lack `telegramChatId` (set via the /team page). Recompute still
  succeeds; only the alert is skipped.
- **Manual one-off recompute** — `railway run npm run recompute:cron` (from the
  cron service context) or, locally against the Railway DB,
  `npx tsx scripts/db/run-recompute.ts`.
