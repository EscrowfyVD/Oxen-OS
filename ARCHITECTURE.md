# Oxen OS — Architecture

This document describes the high-level architecture of Oxen OS: the modular monolith structure, the workers, the database, the integrations, and the security model.

For setup and a quick tour of the modules, see [`README.md`](./README.md).

---

## Overview

Oxen OS is a **modular monolith** deployed on Railway, composed of:

- **1 Next.js application** (App Router) — user-facing UI + REST API routes
- **2 Background workers** (Node processes) — sync + AI jobs
- **1 PostgreSQL database** shared by all three services

```
┌───────────────────────────────────────────────────────────────┐
│  Railway project                                              │
│                                                               │
│   ┌──────────────────┐  ┌──────────────┐  ┌───────────────┐   │
│   │  oxen-os         │  │ sync-worker  │  │  ai-worker    │   │
│   │  (Next.js)       │  │  (Node + tsx)│  │  (Node + tsx) │   │
│   │  os.oxen.finance │  │              │  │               │   │
│   └────────┬─────────┘  └──────┬───────┘  └───────┬───────┘   │
│            │                   │                  │           │
│            └───────────────────┼──────────────────┘           │
│                                │                              │
│                      ┌─────────▼──────────┐                   │
│                      │    PostgreSQL      │                   │
│                      │    (Railway)       │                   │
│                      └────────────────────┘                   │
└───────────────────────────────────────────────────────────────┘
```

Workers communicate with the monolith strictly via the database — there is no direct HTTP call between services. Jobs are enqueued in the shared `Job` table and picked up by workers polling with `FOR UPDATE SKIP LOCKED`.

---

## The Next.js app

### App Router structure

```
src/app/
├── layout.tsx            Root layout (fonts, global providers)
├── page.tsx              Dashboard (homepage)
├── globals.css
├── login/                NextAuth sign-in page (public)
├── absences/             Leave / vacation management
├── ai/                   Sentinel AI assistant
├── calendar/             Google Calendar integration
├── compliance/           Policies, risks, incidents, training
├── conferences/          Conference tracking
├── crm/                  CRM (contacts, deals, playbook, forecast, outreach, inbox)
├── finance/              Financial entries, budgets, bank accounts
├── intel/                Market research + SEO/GEO
├── marketing/            Social metrics, content ideas, compliance checks
├── org/                  Legal entity structure
├── settings/             Global settings
├── support/              Ticket management
├── tasks/                Kanban task board
├── team/                 Employee directory
├── wiki/                 Internal knowledge base
└── api/                  REST endpoints (33 groups — see below)
```

### Server components vs client components

The app uses **React Server Components by default**. Components opt into the client boundary with `"use client"` when they need interactivity, hooks, or browser APIs. API routes are implemented as Next.js Route Handlers (`route.ts` files under `src/app/api/`).

### API surface

`src/app/api/` contains 33 route groups. Broadly:

- **Module CRUD**: `crm/`, `finance/`, `compliance/`, `support/`, `wiki/`, `intel/`, `marketing/`, `tasks/`, `conferences/`, `leaves/`, `team/`, `org-entities/`, `calendar/`, `call-notes/`, `activity/`, `events/`, `employees/`, `agents/`, `contacts/`, `deals/`, `dashboard/`, `kpi/`, `seo/`, `drive/`, `email/`
- **Integration / webhook endpoints**: `auth/` (NextAuth), `telegram/`, `webhooks/` (Clay, Lemlist, N8N, Trigify, website, support)
- **AI / internal**: `ai/`, `jobs/`, `me/`, `debug/`, `migrate-avatars/`

### Edge Runtime proxy

`src/proxy.ts` (using the Next.js 16 `proxy` file convention, which replaces the legacy `middleware.ts`) runs on the Edge Runtime. It checks for a NextAuth session cookie and redirects unauthenticated requests to `/login`. Because it runs on Edge, it cannot import Prisma — only cookie-level heuristics.

Whitelisted paths (bypass the session check at the proxy level, but still authenticate downstream):

- `/api/auth/*` — NextAuth's own endpoints
- `/api/telegram/*` — verified in-handler via `X-Telegram-Bot-Api-Secret-Token`
- `/api/webhooks/*` — verified in-handler via HMAC or shared secret
- `/login`, `/_next`, `/favicon`

Notably, **seed routes are NOT whitelisted** — they go through the normal NextAuth session check. (This was one of the Sprint 0 fixes; leaving seed routes public would have been a data-exfiltration path.)

---

## Modules

Oxen OS currently has **15 user-facing modules** plus the Dashboard. Each module typically bundles:

- A page tree under `src/app/<module>/`
- Dedicated React components under `src/components/<module>/`
- API routes under `src/app/api/<module>/`
- Prisma models, usually prefixed (`CrmContact`, `FinanceEntry`, `Policy`, …)

### Cross-module coupling

Module boundaries are **loose** — modules share Prisma models freely, and a given component may reach directly into another module's tables. There is no enforced public API between modules at the code level. This is intentional for now (iteration speed over isolation), and tracked as technical debt for a future modularity sprint.

---

## Workers

Both workers live under `workers/`, each as a standalone Node project with its own `package.json`, `tsconfig.json`, Railway `railway.json`, and a copy of `prisma/schema.prisma`.

### sync-worker

Handles **scheduled sync operations** and cron-style tasks that would either block request handling or exceed a Next.js timeout:

- Gmail message sync
- Google Calendar event sync
- Google Drive metadata refresh
- Lemlist campaign / reply sync
- Periodic cron triggers (Telegram digests, upcoming-meeting checks, Lemlist reconciliation)

**Shared code synchronization**: `workers/sync-worker/src/lib/` contains byte-identical copies of `src/lib/token-encryption.ts` and `src/lib/prisma.ts`. They are synchronized via `npm run worker:sync-libs`. A SHA-256 parity test (`src/lib/__tests__/worker-sync.test.ts`) fails loudly on divergence, so the worker never reads OAuth ciphertext without the matching decrypt extension. See `SPRINT_1_3_REPORT.md` for why this duplication exists (short version: the worker is deployed as a separate Railway service and cannot cross-import from the Next.js source tree; moving to a real monorepo is out of scope for Sprint 1).

### ai-worker

Handles **Claude API calls** that would block request handling or exceed Next.js timeouts:

- Lead / deal AI scoring
- Morning brief + evening recap generation
- Content compliance checks (marketing)
- Wiki Q&A (AI-backed search)
- News scoring, keyword discovery, GEO test runs

Uses the same `Job` table pattern as sync-worker. Jobs are enqueued from the main app and the ai-worker processes them asynchronously with `POLL_INTERVAL = AI_POLL_INTERVAL_MS` (default 5s).

### Job queue pattern

The `Job` model (`prisma/schema.prisma`) is the only coordination mechanism between the monolith and the workers:

```
Job {
  id, type, status (pending|processing|completed|failed),
  payload, result, error,
  attempts, maxAttempts, priority,
  createdBy, processedBy,
  startedAt, completedAt, createdAt, updatedAt
}
```

Claim pattern (concurrent-safe):

```sql
UPDATE "Job"
SET status = 'processing', processedBy = $workerId, startedAt = now()
WHERE id = (
  SELECT id FROM "Job"
  WHERE status = 'pending' AND type IN (...)
  ORDER BY priority DESC, createdAt ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING id;
```

`FOR UPDATE SKIP LOCKED` lets multiple worker instances poll the same queue without stepping on each other.

---

## Database

Oxen OS uses **PostgreSQL** via Prisma ORM. The schema (`prisma/schema.prisma`) currently contains **70 models**.

### Naming conventions

Most per-module tables are prefixed with the module name:

- CRM: `Company`, `CrmContact`, `Deal`, `CrmTask`, `Activity`, `PlaybookStep`, `SmartView`, `AIFollowUp`
- Finance: `FinanceEntry`, `FinanceTransaction`, `FinanceBudget`, `FinanceGoal`, `BankAccount`
- Compliance: `Policy`, `PolicyVersion`, `Risk`, `Training`, `TrainingCompletion`, `RegulatoryLicense`, `ComplianceIncident`, `ScreeningRecord`
- Marketing / SEO: `SocialMetrics`, `ContentIdea`, `ContentComplianceCheck`, `MarketingIntel`, `Keyword`, `NewsSource`, `NewsItem`, `Article`, `GeoTestPrompt`, `GeoTestResult`, `SeoAlert` — the SEO sub-system has no dedicated top-level route; it is mounted inside `/marketing` via `src/components/seo/SeoModule.tsx` (tabs UI)
- Outreach: `OutreachDomain`, `OutreachCampaign`, `OutreachAlert`, `SuppressionEntry`
- Leave: `LeaveRequest`, `LeaveBalance`, `LeaveRules`
- AI: `CompanyIntel`, `MeetingBrief`, `AIInsight`, `AIConversation`
- Conferences: `Conference`, `ConferenceAttendee`, `ConferenceContact`, `ConferenceReport`
- Intel: `IntelResearch`, `IntelResult`
- Support: `SupportTicket`, `SupportMessage`

Cross-cutting tables are unprefixed: `User`, `Account`, `Session`, `VerificationToken` (NextAuth), `Employee`, `OrgEntity`, `Task`, `Email`, `CalendarEvent`, `InternalEvent`, `CallNote`, `WikiPage`, `WikiVersion`, `DriveLink`, `KpiEntry`, `ActivityLog`, `AuditLog`, `IntentSignal`, `Job`.

### Migrations

Railway build command currently runs `npx prisma db push --accept-data-loss`. This is fast but does not produce migration artifacts. Moving to `prisma migrate deploy` with proper migration files is tracked as known technical debt for a dedicated DB sprint.

### Prisma Client extensions

The Prisma client (`src/lib/prisma.ts`) is extended via `$extends` to transparently encrypt/decrypt the `access_token`, `refresh_token`, and `id_token` fields on the `Account` table. Application code continues to read/write plaintext. See `src/lib/token-encryption.ts` for the algorithm (AES-256-GCM, versioned format `enc:v1:…`) and `SPRINT_1_3_REPORT.md` for the rollout history.

The same extension is mirrored in the sync-worker via the file copy described in the Workers section above.

---

## Integrations

Oxen OS integrates with several external services. Each integration has an isolation layer in `src/lib/`:

| Integration | Primary file(s) | Purpose | Auth method |
|---|---|---|---|
| Google OAuth | `src/lib/auth.ts` | Sign-in (restricted to `@oxen.finance`) | OAuth 2.0 |
| Google Calendar | `src/lib/google-calendar.ts` | Event read/write, refresh-token rotation | Bearer (encrypted at rest) |
| Google Drive | `src/lib/google-drive.ts` | File listing + content export | Bearer (encrypted at rest) |
| Gmail | direct via Google API | Message sync | Bearer (encrypted at rest) |
| Anthropic Claude | `src/lib/claude.ts` | AI features (in-app + ai-worker) | API key |
| Telegram Bot | `src/lib/telegram.ts` | `@Oxen_deal_info_bot` commands + notifications | Bot token + webhook `secret_token` |
| Lemlist | `src/lib/lemlist.ts` | Outbound email campaigns (bidirectional) | API key + HMAC webhook signatures |
| Clay | webhook route only | Intent-signal enrichment | Shared secret |
| Trigify, N8N | webhook routes only | Various automations | Shared secret |
| Public website form | webhook route only | Contact form submissions | Shared secret |
| Support inbound | webhook route only | External support ingestion | Shared secret |

### Webhook authentication pattern

All incoming webhooks route through a shared helper: `src/lib/webhook-auth.ts` (`requireWebhookSecret`). It:

1. Reads the expected secret from an env var (throws at module time if not defined — fail-closed)
2. Reads the signature from a configurable header (default `x-webhook-secret`; Telegram overrides to `x-telegram-bot-api-secret-token`)
3. Compares with `timingSafeEqual` (constant-time, resistant to timing attacks)
4. Returns 401 on any mismatch — no silent pass

Lemlist layers HMAC-SHA256 body-signing on top of the shared-secret check because Lemlist actually signs the payload.

### Telegram webhook

Telegram's `setWebhook` is called with a `secret_token` parameter (see `src/lib/telegram.ts`). Telegram then includes this token in the `X-Telegram-Bot-Api-Secret-Token` header on every update, which the handler verifies via the same `requireWebhookSecret` helper. If the env var is present on Railway but `setWebhook` was configured without the matching `secret_token`, every update returns 401 — see the Sprint 1.1+1.2 report for the exact remediation sequence.

---

## Security model

### Authentication

- NextAuth v5 / Auth.js with a **Google OAuth provider only**
- Restricted to `@oxen.finance` email addresses (enforced in `src/lib/auth.ts` signIn callback)
- Session cookies are `httpOnly`, `secure` in prod, `sameSite=lax`
- Session duration: NextAuth default (30 days)

### Authorization

Role-based access via the `Employee.roleLevel` field and helpers in `src/lib/admin.ts` / `src/lib/permissions.ts`. Granular coverage varies by module and is tracked in the audit for future consolidation.

### Encryption at rest

- OAuth tokens (`Account.access_token`, `refresh_token`, `id_token`) encrypted with AES-256-GCM
- Versioned format `enc:v1:<iv>:<ciphertext>:<authtag>` for future key rotation without downtime
- Key stored in `TOKEN_ENCRYPTION_KEY_V1` env var — **must be identical on both the `oxen-os` and `sync-worker` Railway services**

### Encryption in transit

- HTTPS enforced via **HSTS** (`max-age=63072000`, monolith domain only — no `includeSubDomains`/`preload` yet pending a DNS audit of `*.oxen.finance`, see Sprint 1.1+1.2 report)
- **CSP in Report-Only mode** (see `next.config.ts`) — will be promoted to enforce after monitoring
- **Permissions-Policy** blocks camera, microphone, geolocation, payment APIs
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`

### Audit

- `AuditLog` Prisma model for sensitive mutations
- `ActivityLog` for user-visible activity feed
- GitHub Actions CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on every push

### Secrets management

- All secrets live in Railway env vars — never committed
- Local dev uses `.env.local` (gitignored); copy `.env.example` to start
- Webhook secrets are shared with the emitting service (Lemlist, Clay, Trigify, N8N, website, support)
- `TOKEN_ENCRYPTION_KEY_V1` must be backed up (1Password) before pasting into Railway — Railway does not let you re-read a variable after save

---

## Hardening history

Security hardening has been applied across multiple sprints. Per-sprint reports at the root:

- `AUDIT_REPORT_2026-04-21.md` — Full security audit baseline
- `SPRINT_0_REPORT.md` — Seed routes hardening, debug endpoints, initial webhook auth
- `SPRINT_1_1_2_REPORT.md` — Telegram webhook signature (`secret_token`) + HTTP security headers
- `SPRINT_1_3_REPORT.md` — OAuth token encryption at rest (AES-256-GCM)
- `SPRINT_2_1_REPORT.md` — GitHub Actions CI + baseline (`BASELINE_2026-04-22.md`)

---

## Known technical debt

Tracked for future sprints (references to the internal audit):

- **Float → Decimal** for monetary fields (Prisma `Float` → `Decimal(20, 6)`)
- **Zod validation** on mutation API routes (Finance, CRM, Compliance, webhooks)
- **`prisma migrate deploy`** instead of `db push --accept-data-loss` at build time
- **Structured logging** (pino) + **Sentry** error tracking
- **Responsive breakpoints** for mobile (current UI is desktop-first)
- **Per-module READMEs** + explicit module boundaries (enforced public APIs)
- **Retiring the lenient decrypt fallback** in the Prisma extension once token migration is fully validated (Sprint 1.3 bis)
- **ai-worker TypeScript error** (`workers/ai-worker/src/index.ts:56` — pre-existing, skipped in CI)
- **ESLint baseline** — 79 pre-existing errors + 157 warnings, `lint` job non-blocking until a dedicated cleanup

---

## Further reading

- Next.js 16 App Router — https://nextjs.org/docs/app
- NextAuth v5 / Auth.js — https://authjs.dev
- Prisma — https://www.prisma.io/docs
- Railway — https://docs.railway.com
- Anthropic Claude API — https://docs.anthropic.com
