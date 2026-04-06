# OXEN OS — Development Guidelines

## Architecture
- Monolithic Next.js app + separate AI Worker + Sync Worker
- All share the same PostgreSQL database (Railway)
- Communication via Job queue table
- Next.js 16+ App Router with server/client components
- Prisma ORM with PostgreSQL
- NVM required: run `source ~/.zshrc` before any npm/npx commands
- Claude API via `@anthropic-ai/sdk` — model: `claude-sonnet-4-20250514`

## Design System
- Glassmorphism dark UI: CARD_BG="rgba(15,17,24,0.6)", border="rgba(255,255,255,0.06)"
- Rose-gold accent: #C08B88
- Typography: 'Bellfair' serif for numbers/headings, 'DM Sans' sans-serif for data/labels
- Text: primary "#F0F0F2", secondary "rgba(240,240,242,0.55)", tertiary "rgba(240,240,242,0.3)"
- Inline React.CSSProperties only (NO CSS modules, NO Tailwind)
- Recharts for all charts (already installed)
- All components must be "use client" when using hooks/state

## Skills (imported from /reference/agent-skills/skills/)
- Follow spec-driven-development for every new module
- Follow security-and-hardening for all API routes (input validation, auth checks, rate limiting)
- Follow api-and-interface-design for all Prisma models and API endpoints
- Follow code-review-and-quality before every push
- Follow incremental-implementation for Railway deployments (feature flags, vertical slices)

## Security Rules (CRITICAL — this is a regulated fintech)
- Never expose API keys, tokens, or secrets in code
- All API routes must check authentication (session) before processing
- Admin-only routes must verify isAdmin or role_level
- All user inputs must be validated and sanitized (prevent SQL injection, XSS)
- Webhook routes must verify X-Webhook-Secret header
- Rate limit all AI-related endpoints (max 10 requests/minute per user)
- Audit log every data mutation (create, update, delete)
- Never log sensitive data (passwords, tokens, full credit card numbers)
- Use `auth()` from `@/lib/auth` or `requirePageAccess()` from `@/lib/admin` for all routes

## Code Quality Rules
- TypeScript strict mode everywhere
- No "any" types — always define interfaces
- Every API route returns proper error codes (400, 401, 403, 404, 500)
- Every API route has try/catch with meaningful error messages
- Loading states on every async UI operation
- Empty states for every list/table (never just blank)
- All dates in UTC, display in user's timezone
- Use `NextResponse.json()` for all API responses
- Import prisma from `@/lib/prisma`

## Git Rules
- Atomic commits: one feature per commit
- Commit messages: "feat: add X", "fix: resolve Y", "refactor: restructure Z"
- Never commit .env, secrets, or node_modules
- Always run `npx next build` before pushing to verify zero errors
- Co-Author line: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Prisma Rules
- Always run `npx prisma generate` after schema changes locally
- Run `npx prisma db push --accept-data-loss` on Railway after deploy
- Always handle relation cascade deletes properly
- Use `@default(cuid())` for all IDs
- Add `@@index` on frequently queried fields
- Use `@db.Text` for long text fields
- DateTime fields: `@default(now())` for createdAt, `@updatedAt` for updatedAt

## CRM Conventions
- 9-stage pipeline: new_lead, sequence_active, replied, meeting_booked, meeting_completed, proposal_sent, negotiation, closed_won, closed_lost
- 7 verticals: FinTech/Crypto, Family Office, CSP/Fiduciaries, Luxury Assets, iGaming, Yacht Brokers, Import/Export
- 8 outreach groups: GROUP 1-7B
- 9 geo zones with auto-assignment via `getOwnerForGeo()`
- 3 deal owners: Andy, Paul Louis, Vernon
- Config centralized in `src/lib/crm-config.ts`

## Module Structure
- API routes: `src/app/api/{module}/...`
- Pages: `src/app/{module}/page.tsx`
- Components: `src/components/{module}/...`
- Config/helpers: `src/lib/{module}-config.ts`
- Shared types in component files or dedicated `types.ts`

## Testing Checklist (before every push)
- [ ] `npx prisma generate` succeeds
- [ ] `npx next build` compiles with zero errors
- [ ] No hardcoded secrets or API keys
- [ ] All new API routes have auth checks
- [ ] All new UI components have loading + empty states
- [ ] All fetch calls have error handling
