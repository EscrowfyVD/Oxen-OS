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
| Schedule (recommended) | `0 7 1 * *` (1st of month, 07:00 UTC) |
| Auth (HTTP path) | `Authorization: Bearer <CRON_SECRET>` |
| Required env | `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `CRON_SECRET` |
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
alternative (auto DST-shifting) requires a TZ-aware scheduler that
Railway Cron doesn't natively support, and is more complexity than
the value buys.

If you need the brief at exactly 09:00 CET year-round, run two crons
(one Mar→Oct at 07:00 UTC, one Nov→Feb at 08:00 UTC) — but this is
out of scope for V1.

---

## Railway Cron setup (one-time)

This is the **first cron service** in the Oxen OS Railway project.
Setup is a manual one-time UI step because Railway Nixpacks doesn't
support inline `crons[]` arrays in `railway.json` — each cron lives
on its own service that shares the repo.

**Decision : Option A** (separate service via Railway dashboard) was
chosen over Option B (inline `crons` in railway.json) because the
inline pattern isn't supported by Railway's current schema as of
this sprint. Documented here so future cron jobs (e.g. the deferred
S1 signal decay) follow the same pattern.

### Steps

1. Open the Railway project → **+ New Service** → **GitHub Repo** →
   pick `EscrowfyVD/Oxen-OS`.
2. Name the service something like `oxen-os-cron-conference-brief`
   (or just `cron-conference-brief`).
3. In **Settings → Build** :
   - Builder : `Nixpacks`
   - Build Command : `npx prisma generate && npm install`
     (skip `migrate deploy` and `next build` — this service doesn't
     serve HTTP, it just runs the script once per cron tick)
4. In **Settings → Deploy** :
   - Start Command : `npx tsx scripts/cron/send-conference-brief.ts`
   - **Cron Schedule** : `0 7 1 * *`
   - Restart Policy : `Never` (the script exits after a single run)
5. In **Variables** : copy the same `DATABASE_URL` and
   `TELEGRAM_BOT_TOKEN` from the main `oxen-os` service. (`CRON_SECRET`
   is **NOT** required for the CLI path — only the HTTP endpoint
   uses it.)
6. **Deploy** the service.

After the first successful cron tick, you'll see a Deployment log
with the structured stats output of the script.

### Alternative: HTTP endpoint via external scheduler

If you'd rather centralize all crons on an external scheduler
(e.g. cron-job.org, GitHub Actions, etc.), the HTTP endpoint at
`POST /api/cron/conference-brief` accepts a Bearer token and runs
the same logic as the CLI script. Example with GitHub Actions :

```yaml
# .github/workflows/conference-brief.yml
name: Conference Brief Monthly
on:
  schedule:
    - cron: "0 7 1 * *"
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -X POST https://os.oxen.finance/api/cron/conference-brief \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -w "\nHTTP %{http_code}\n"
```

The Bearer token is the value of `CRON_SECRET` env var on Railway
(same secret already used by `/api/lemlist/sync`).

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
- Tests : 32 (22 lib + 10 route)
- Pattern reference : Sprint S1 batch 3 cron (`docs/signal-decay-cron.md`)
