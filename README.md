# Oxen OS

[![CI](https://github.com/EscrowfyVD/Oxen-OS/actions/workflows/ci.yml/badge.svg)](https://github.com/EscrowfyVD/Oxen-OS/actions/workflows/ci.yml)

Internal operating system for Oxen Finance — unified workspace covering CRM, Finance, Compliance, Marketing, AI assistants, and more.

**Production:** https://os.oxen.finance
**Stack:** Next.js 16 · TypeScript · Prisma · PostgreSQL · Railway · NextAuth v5 · Anthropic Claude

---

## Modules

Oxen OS is a modular monolith. The main Next.js app hosts the modules below, backed by two background workers (sync + AI).

| Module | Route | Description |
|---|---|---|
| Dashboard | `/` | Daily overview, KPIs, Sentinel morning brief |
| Sentinel AI | `/ai` | AI assistant: morning brief, evening recap, VIP alerts, deal insights |
| CRM | `/crm` | Companies, contacts, deals (9-stage pipeline), activities, playbook, forecast, outreach |
| Calendar | `/calendar` | Google Calendar sync, call notes, AI meeting briefs |
| Finance | `/finance` | Entries, transactions, budgets, bank accounts, financial goals |
| Compliance | `/compliance` | Policies, risks, incidents, training, regulatory licenses, screenings |
| Marketing | `/marketing` | Social metrics, content ideas, content compliance checks. Includes SEO & GEO sub-module (keywords, news, articles, GEO tests, rendered in-page as tabs) |
| Support | `/support` | Ticket management with SLA tracking |
| Wiki | `/wiki` | Internal knowledge base (versioned, AI-queryable) |
| Intel | `/intel` | Market research, competitor intelligence, SEO/GEO tracking |
| Tasks | `/tasks` | Kanban task board |
| Conferences | `/conferences` | Conference tracking (attendees, budget, contacts collected, reports) |
| Team | `/team` | Employee directory |
| Org | `/org` | Legal entity structure, org hierarchy |
| Absences | `/absences` | Leave / vacation management |
| Settings | `/settings` | Global configuration |

External integrations: Google (OAuth, Gmail, Calendar, Drive), Anthropic Claude, Telegram Bot (@Oxen_deal_info_bot), Lemlist, Clay, Trigify, N8N.

---

## Quick start

### Prerequisites

- **Node.js 22** (aligned with Railway runtime; local Node 20+ works but CI is strict on 22)
- **PostgreSQL** (local instance or remote connection string)
- Optional accounts for external integrations (Google OAuth, Anthropic, Telegram, Lemlist, Clay)

### Setup

```bash
# 1. Clone and install
git clone https://github.com/EscrowfyVD/Oxen-OS.git
cd Oxen-OS
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local and fill in at least the [REQUIRED] values.
# See .env.example for per-variable documentation and generation commands.

# 3. Database
npx prisma generate
npx prisma db push   # `migrate dev` when a dedicated migration workflow is adopted

# 4. Run
npm run dev
```

The app is then available at `http://localhost:3000`.

### Workers (optional in dev)

The Next.js app runs standalone. The two background workers (`sync-worker`, `ai-worker`) are separate Node processes deployed as independent Railway services. Set `ENABLE_WORKERS="false"` in `.env.local` to keep them out of the way, or run them on demand:

```bash
# sync-worker
cd workers/sync-worker && npm install && npm run dev

# ai-worker
cd workers/ai-worker && npm install && npm run dev
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for what each worker does.

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js in dev mode |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm run start` | Start production server (after build) |
| `npm run test` | Run Vitest once |
| `npm run test:watch` | Vitest watch mode |
| `npm run ci:all` | Run the same checks as GitHub Actions locally |
| `npm run ci:typecheck` | `tsc --noEmit` only |
| `npm run ci:lint` | `eslint .` only |
| `npm run ci:test` | `vitest run` only |
| `npm run db:push` | Push Prisma schema to the configured database |
| `npm run db:seed` | Run the seed script (`prisma/seed.ts`) |
| `npm run encrypt-tokens` | One-shot: encrypt existing OAuth tokens at rest (Sprint 1.3) |
| `npm run worker:sync-schema` | Copy `prisma/schema.prisma` into both worker directories |
| `npm run worker:sync-libs` | Copy `token-encryption.ts` + `prisma.ts` into the sync-worker |
| `npm run worker:ai` | Start the ai-worker locally |
| `npm run worker:sync` | Start the sync-worker locally |

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for an overview of the modular monolith structure, the workers, the database layout, the integrations, and the security model.

---

## Deployment

Oxen OS is deployed on Railway across three services that share a single PostgreSQL database:

- **oxen-os** — Next.js app (this repo's primary output, served at `os.oxen.finance`)
- **sync-worker** — Background sync jobs (Gmail, Calendar, Drive, Lemlist, cron tasks)
- **ai-worker** — Background Claude API calls (AI scoring, briefs, follow-ups)

Every push to `main` triggers an automatic redeploy on Railway. GitHub Actions CI (see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs on every push and PR to catch issues before they hit production.

---

## Security

Oxen OS handles OAuth tokens, customer data, and financial records. Key measures in place:

- **OAuth tokens encrypted at rest** — AES-256-GCM with versioned ciphertext (`enc:v1:…`), see `src/lib/token-encryption.ts`
- **Webhook signatures verified** — HMAC (Lemlist) or shared-secret + `timingSafeEqual` (Clay, Trigify, N8N, Telegram, website contact form, support)
- **HTTP security headers** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP (report-only) — see `next.config.ts`
- **Auth restricted to `@oxen.finance`** — enforced in the NextAuth `signIn` callback (`src/lib/auth.ts`)
- **Edge proxy** — `src/proxy.ts` redirects unauthenticated requests to `/login` before they reach any handler
- **Audit log** — `AuditLog` Prisma model for sensitive mutations

For the full hardening history, see the sprint reports (`SPRINT_*_REPORT.md`) at the root. The initial baseline comes from `AUDIT_REPORT_2026-04-21.md`.

---

## Development

### Running the same checks as CI

```bash
npm run ci:all
```

This runs `tsc --noEmit` → `eslint .` → `vitest run` → `next build`, matching GitHub Actions. Note that `ci:lint` currently surfaces pre-existing errors (baseline captured in [`BASELINE_2026-04-22.md`](./BASELINE_2026-04-22.md)); the CI keeps the `Lint` job non-blocking until a dedicated lint cleanup sprint.

### Testing

Vitest runs the helper-level unit tests — currently `src/lib/token-encryption.test.ts` (17 cases) and `src/lib/__tests__/worker-sync.test.ts` (SHA-256 parity between monolith and sync-worker lib copies).

### Code style

- **TypeScript strict mode** enabled (`tsconfig.json` → `"strict": true`)
- **ESLint** via Next.js flat config (`eslint.config.mjs`)
- **Prettier** is not yet configured — style is aligned via reviews for now

---

## Repository structure

```
Oxen-OS/
├── src/
│   ├── app/              Next.js App Router (pages + API routes)
│   │   ├── api/          33 route groups (crm, finance, webhooks, telegram, …)
│   │   └── <module>/     15 user-facing module pages
│   ├── components/       React components grouped by module
│   ├── lib/              Shared utilities, integrations, Prisma client
│   ├── styles/
│   └── proxy.ts          Edge Runtime auth proxy (Next.js 16 convention)
├── workers/
│   ├── sync-worker/      Background sync (Google APIs, Lemlist, cron)
│   └── ai-worker/        Background Claude API jobs
├── prisma/
│   └── schema.prisma     70 models
├── scripts/
│   └── encrypt-oauth-tokens.ts   One-shot migration (Sprint 1.3)
├── .github/workflows/    GitHub Actions CI
├── AUDIT_REPORT_*.md     Initial security audit
├── BASELINE_*.md         Repo health snapshot pre-CI
├── SPRINT_*_REPORT.md    Per-sprint execution reports
├── README.md             This file
├── ARCHITECTURE.md       High-level architecture doc
└── .env.example          All env vars with documentation
```

---

## Contributing

Internal project — Oxen Finance team only at this stage. No external PR workflow yet.

---

## License

Proprietary — all rights reserved.
