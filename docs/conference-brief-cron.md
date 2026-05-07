# Conference Brief — operator guide

**Sprint Conference Brief.** This doc covers the monthly Telegram
digest of upcoming conferences for the BD team. Implements the spec
in Andy's `Monthly_Conference_Brief.docx`.

---

## What it does

On the **1st of every month at 07:00 UTC** (~ 09:00 CEST in summer /
08:00 CET in winter — see "Schedule" below), the cron sends a
single Telegram message to each BD team member listing every
conference whose `startDate` falls within the current calendar month.

Per conference: name, location + country, date range, and an
optional description sentence. Empty months emit a polite
"No conferences listed" fallback so the team still gets a
delivery confirmation.

Example brief :

```
Conferences — May 2027

SiGMA Europe
Ta' Qali, Malta — May 3-5
Premier gaming and technology summit.

Token2049
Dubaï, UAE — May 12-13
Largest digital asset conference in the Middle East.

Family Office Forum Riyadh
Riyadh, Saudi Arabia — May 20
```

---

## TL;DR

| Item | Value |
|---|---|
| HTTP endpoint | `POST /api/cron/conference-brief` |
| CLI script | `npx tsx scripts/cron/send-conference-brief.ts` |
| Pure formatting | `src/lib/conference-brief.ts` |
| Orchestration | `src/lib/conference-brief-runner.ts` |
| Trigger (production) | `.github/workflows/conference-brief.yml` (GitHub Actions) |
| Schedule | `0 7 1 * *` (1st of month, 07:00 UTC) |
| Auth (HTTP path) | `Authorization: Bearer <CRON_SECRET>` |
| Required env (Railway) | `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `CRON_SECRET` |
| Required secret (GitHub) | `CRON_SECRET` (Settings → Secrets → Actions) |
| Idempotent | No — each run sends fresh Telegram messages. Manual re-runs will re-deliver the same brief. |
| V1 recipients | `ad@oxen.finance`, `pg@oxen.finance`, `vd@oxen.finance` (hardcoded) |

---

## Recipients (V1 → configurable later)

Hardcoded in `src/lib/conference-brief-runner.ts` :

```ts
export const DEFAULT_RECIPIENT_EMAILS = [
  "ad@oxen.finance", // Andy Dessy
  "pg@oxen.finance", // Paul Garreau (a.k.a. "Paul Louis" internally)
  "vd@oxen.finance", // Vernon Dessy
] as const
```

The runner :

1. Looks up each email in the `Employee` table (case-insensitive).
2. Filters out employees with `telegramChatId = null` (they haven't
   registered the bot).
3. Sends to each surviving recipient, one Telegram fetch at a time.
4. Reports any missing emails (no Employee row OR no chat ID) in the
   `missingRecipients[]` field of the response so you can fix the
   `Employee` row via `/team` page.

Per Andy's brief, V1 is hardcoded; future iteration could surface
recipient management in the Settings UI (Sprint TBD).

---

## Schedule + timezone

The cron is scheduled at **07:00 UTC** on the 1st of every month
(`0 7 1 * *`). This corresponds to :

- **09:00 CEST** during European summer time (last Sun of Mar →
  last Sun of Oct)
- **08:00 CET** during European winter time (last Sun of Oct →
  last Sun of Mar)

The 1-hour drift in winter is acceptable for a monthly cadence — a
brief that lands 1h early once half the year is not a problem. The
alternative (auto DST-shifting) requires a TZ-aware scheduler — neither
GitHub Actions nor Railway Cron natively support this, and pulling
in a TZ-aware external service is more complexity than the value buys.

If you need the brief at exactly 09:00 CET year-round, run two crons
(one Mar→Oct at 07:00 UTC, one Nov→Feb at 08:00 UTC) — but this is
out of scope for V1.

---

## Scheduling — GitHub Actions (canonical)

The cron is triggered by a GitHub Actions workflow committed to the
repo at `.github/workflows/conference-brief.yml`. The workflow does
**one thing**: a curl POST to the HTTP endpoint with the bearer
token. No build, no Node, no Prisma — just a 30-second container
that hits the deployed API. Costs ~30s per run on the free tier
(well under the 2000-min/month limit).

This replaces an earlier attempt to use **Railway Cron Services**
(separate Railway service per cron, building the full Next.js app
just to run a script). That approach was abandoned because:
- The full Next.js build was unnecessary for a curl-trigger
- Railway Postgres private networking caused intermittent P1001
  deploy failures during `prisma migrate deploy`
- Railway logs were truncated, making debug difficult
- 5 separate config surfaces per service (Build cmd, Start cmd,
  Schedule, Restart, Variables) drifted from the repo

GitHub Actions provides clean separation: the HTTP endpoint lives
on Railway with the rest of the app; the trigger lives in the repo
as code-reviewable YAML.

### One-time setup

1. **Add `CRON_SECRET` to GitHub repo secrets:**
   - Go to `https://github.com/EscrowfyVD/Oxen-OS/settings/secrets/actions`
   - Click **New repository secret**
   - Name: `CRON_SECRET`
   - Value: copy from Railway env vars (same secret used by
     `/api/lemlist/sync` and `/api/cron/signal-decay`)
   - Save
2. **Workflow file** is already in the repo at
   `.github/workflows/conference-brief.yml`. No further setup —
   GitHub picks it up automatically once the secret is in place.

### Schedule

```yaml
on:
  schedule:
    - cron: '0 7 1 * *'   # 1st of month at 07:00 UTC
```

Same schedule as before:
- **09:00 CEST** during European summer time
- **08:00 CET** during European winter time

### Schedule drift caveat

**Important** — GitHub Actions explicitly documents that scheduled
workflows can be delayed by 15–30 minutes during peak hours due to
high runner demand on the free tier. For a monthly cadence at
07:00 UTC (a relatively quiet hour), this is acceptable: the brief
might land at 07:25 UTC instead of 07:00 UTC roughly 1 month in 12,
which is still well within the BD team's morning window.

If precise time matters in future iterations:
- Switch to a self-hosted GitHub runner (no shared queue)
- Or use an external cron service (cron-job.org, EasyCron) that
  hits the same `/api/cron/conference-brief` endpoint

### Manual trigger (replay)

`workflow_dispatch` is enabled on the workflow, so you can run it
manually from the Actions tab:

1. Go to `https://github.com/EscrowfyVD/Oxen-OS/actions/workflows/conference-brief.yml`
2. Click **Run workflow** → **Run workflow** (defaults to `main`)

⚠️ **WARNING — Conference Brief is NOT idempotent.** Manual re-runs
**WILL** re-send Telegram messages to all 3 BDs (Andy, Paul,
Vernon). Coordinate before triggering manually so you don't ping
the team twice in the same morning. The workflow YAML carries this
warning inline next to the `workflow_dispatch:` declaration.

### Alternative: local CLI for testing

The CLI script `scripts/cron/send-conference-brief.ts` still works
for local validation against any database. It's identical to what
the HTTP endpoint runs internally (same `runConferenceBrief()`
runner) — but bypasses GitHub Actions / curl entirely. See **Manual
smoke test** below.

---

## Manual smoke test

### From your laptop (DATABASE_URL points to Railway prod)

```bash
cd /path/to/Oxen-os
source ~/.zshrc
npx tsx scripts/cron/send-conference-brief.ts
```

Expected output :

```
=== Conference Brief cron — 2026-05-07T...Z ===

Month            : May 2026
Conferences      : 4
Recipients       : 3
Delivered        : 3
Failed           : 0

--- Per-recipient deliveries ---
  ✓ Andy Dessy           ad@oxen.finance
  ✓ Paul Garreau         pg@oxen.finance
  ✓ Vernon Dessy         vd@oxen.finance

=== End ===
```

The 3 BDs receive a real Telegram message — coordinate with them
before running this manually to avoid waking them up at 3am.

### From `curl` against the deployed HTTP endpoint

```bash
SECRET="<CRON_SECRET-from-Railway>"
curl -X POST https://os.oxen.finance/api/cron/conference-brief \
  -H "Authorization: Bearer $SECRET" \
  -w "\nHTTP %{http_code}\n"
```

Expected response (200) :

```json
{
  "success": true,
  "monthName": "May 2026",
  "conferenceCount": 4,
  "recipientCount": 3,
  "delivered": 3,
  "failed": 0,
  "missingRecipients": [],
  "deliveries": [
    { "email": "ad@oxen.finance", "name": "Andy Dessy", "status": "delivered" },
    { "email": "pg@oxen.finance", "name": "Paul Garreau", "status": "delivered" },
    { "email": "vd@oxen.finance", "name": "Vernon Dessy", "status": "delivered" }
  ]
}
```

### Auth failure modes

| Request | Status | Body |
|---|---|---|
| No Authorization header | 401 | `{ "error": "Missing bearer token" }` |
| Wrong bearer | 401 | `{ "error": "Invalid bearer token" }` |
| `CRON_SECRET` unset on server | 503 | `{ "error": "Cron secret not configured" }` |

---

## Conference filtering rules

A conference appears in the brief if **all** of the following hold :

- `startDate >= monthStart` (1st of current month, 00:00 UTC)
- `startDate < monthEnd` (1st of next month, 00:00 UTC)
- `status NOT IN ('cancelled', 'rejected')`

The `status` filter excludes :

- `cancelled` — explicitly called off
- `rejected` — proposed via Intel research but rejected by ops

The `status` filter **does NOT** exclude :

- `suggested` — included (still proposed; ops may want to know)
- `planned` — included (the default; the bulk of entries)
- `ongoing` — included (rare — cron usually runs at month start)
- `completed` — included (could be a recap signal for events that
  already happened earlier in the same month — rare for a month-
  start cron, but possible if you re-run mid-month)

If you want a stricter filter (e.g. only `planned`), edit the
runner's `where` clause directly. The change is contained to one
spot.

---

## Field rendering rules

The `formatConferenceBriefHTML` helper applies these rules :

- **Conference name** : escaped (HTML-safe), bolded.
- **Location + country** : `${location}, ${country}` if both present.
  `${location}` alone if `country` is null. Each component HTML-escaped.
- **Date range** : `formatDateRange()` formats based on duration :
  - Single day or no `endDate` → `"May 5"`
  - Same month → `"May 5-7"`
  - Cross-month → `"May 28 - Jun 2"`
  - Cross-year → `"Dec 30 - Jan 2"` (no year shown — context is in
    the brief heading)
- **Description** : if non-null and non-whitespace, rendered as a
  third line (HTML-escaped). If null or empty, **the line is skipped
  entirely** — no placeholder, no orphan whitespace. (V1 has no AI
  fill — adding one is a follow-up sprint.)

---

## Debugging

### "I expected the brief but it didn't arrive"

1. Check Railway logs for the `oxen-os-cron-conference-brief`
   service. The log will print the structured stats.
2. If `missingRecipients` includes your email :
   - Are you in the `Employee` table? (`SELECT * FROM "Employee"
     WHERE email ILIKE 'your@email'`)
   - Do you have a `telegramChatId`? (Open `/team` page, find your
     row, set the chat ID.)
3. If `failed` > 0 : look at the `deliveries[]` array for the
   error string from Telegram (e.g. "chat not found", "bot
   blocked by user").
4. If `conferenceCount` is 0 unexpectedly :
   - Are conferences in DB for the current month? (`SELECT name,
     "startDate", status FROM "Conference" WHERE "startDate" >=
     date_trunc('month', NOW())`)
   - Is their `status` `cancelled` or `rejected`? Those are
     filtered out.

### "I want to test the brief without spamming the team"

Override the recipient list via the `runConferenceBrief()` helper :

```ts
import { runConferenceBrief } from "@/lib/conference-brief-runner"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const result = await runConferenceBrief(prisma, {
  recipientEmails: ["your-test-email@oxen.finance"],
  // Optional: pin a specific month
  now: new Date("2027-05-15T00:00:00Z"),
})
console.log(result)
```

Use this pattern in a one-off `npx tsx` script if you want to
preview the brief without involving the BD team.

---

## Refs

- Spec : `Monthly_Conference_Brief.docx` (Andy)
- PRD : `PRD_001_MAPPING.md` v3.7
- HTTP route : `src/app/api/cron/conference-brief/route.ts`
- CLI script : `scripts/cron/send-conference-brief.ts`
- Pure helpers : `src/lib/conference-brief.ts`
- Runner : `src/lib/conference-brief-runner.ts`
- Telegram lib : `src/lib/telegram.ts` (`sendTelegramMessage`, `escHtml`)
- Trigger workflow : `.github/workflows/conference-brief.yml`
- Tests : 32 (22 lib + 10 route)
- Sibling cron pattern : `docs/signal-decay-cron.md` (daily, idempotent)
