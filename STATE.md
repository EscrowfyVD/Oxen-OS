# Oxen-OS — Project State

> **Living document.** Update at every significant evolution (PR merged,
> spec ratified, OCA-side dependency identified, scope decision logged).
> Read order: skim §TL;DR → look at §Active workstreams for what's moving →
> §Backlog for what's queued → everything else as needed.
>
> **Last updated** : 2026-06-01 (Phase 3 **100% in prod** ; Finding 2 companySize-label fix + lemlist `emailsUnsubscribed` hotfix pushed to main ; **closeout #3 — `deriveSignalStamp` helper centralizes IntentSignal stamping across 5 create sites / 3 webhooks — committed local `15cdaac`, awaiting Vernon's push**)

---

## TL;DR

- **Repo health** : `npm run build` green ; tests **715/715** passing (69 files ;
  was 678 — +25 Finding 2 companySize parser/integration, +2 lemlist hotfix,
  +10 closeout #3 `deriveSignalStamp`) ; lint baseline 79 errors + 159 warnings
  (CI non-blocking, pre-existing debt).
- **Active workstreams** : (1) **Phase 3 Scoring Engine** — **🎉 100% COMPLETE
  IN PROD** : Sprint 3a (PR #6) + 3b + 3c (PR #7/#8) + 3d (PR #9) all merged ;
  ScoringConfig **v2** reconciled to Andy's doc & deployed ; Finding 1
  (configVersion) fixed. Trigify "LinkedIn oxen" workflow enabled 2026-06-01 —
  awaiting first organic IntentSignals. (2) **SP16 — Onboarding Console** —
  5 SP16 PRs merged, no SP16-006 defined yet (open).
- **Local commits awaiting push** : **closeout #3** — `15cdaac` (`deriveSignalStamp`
  refactor) + this STATE.md refresh. Mode B : committed local, awaiting Vernon's
  review + push. Everything through Finding 1 / Finding 2 / lemlist hotfix is
  already merged/pushed to main.
- **Production** : main = `os.oxen.finance` (Railway auto-deploy). No staging
  branch. Push = prod. Onboarding console stays dark behind
  `ONBOARDING_CONSOLE_ENABLED`.

---

## Architecture overview

- **Stack** : Next.js 16 (App Router) + React 19 + TypeScript strict + Prisma 5 +
  PostgreSQL (Railway hosted) + NextAuth v5β + Tailwind v4 config-less + inline
  `React.CSSProperties` styling per CLAUDE.md.
- **3 processes** : the Next.js monolith (UI + API), the AI Worker, the Sync
  Worker. All share the same DB via a Job-queue table.
- **Modules** (top-level Next.js routes) : `crm/`, `onboarding/`, `compliance/`,
  `marketing/`, `intel/`, `conferences/`, `finance/`, `calendar/`, `tasks/`,
  `wiki/`, `support/`, `team/`, `org/`, `absences/`, `ai/`.
- **Auth** : Google OAuth (oxen.finance domain-restricted) via NextAuth v5β.
  Role hierarchy `super_admin > admin > manager > member`, department-based
  `PAGE_ACCESS` rules in `src/lib/permissions.ts`.
- **Canonical project rules** : [CLAUDE.md](CLAUDE.md) — design system tokens,
  security rules, Prisma rules, git rules, testing checklist.

---

## Active workstreams

### 1. Phase 3 Scoring Engine — CRM / PRD-004

**Goal** : automated **Priority Score** (ICP + Intent, decay-adjusted) +
**Priority Level** (P1/P2/P3/Monitor/Excluded) → drives Intent Feed sort + future
BD alerts + Lemlist sequence orchestration.

**Status** : 🎉 **Phase 3 100% COMPLETE IN PROD**. Sprint 3a/3b/3c/3d all merged
(3d = PR #9). ScoringConfig **v2** reconciled to Andy's doc & deployed ; Finding 1
(real configVersion stamped on ScoreHistory) fixed. Sprint 3d wires the engine
end-to-end : triggers classification → Lemlist adapt-only (V1 reframe per recon
Finding 6) → BD Telegram alerts on promotion → Intent Feed Option C badge +
filter → /api/accounts ILIKE fuzzy match.

**Shipped** :

| Commit | Date | What |
|---|---|---|
| `8ad6274` | 2026-05-15 | **Sprint 3a Phase A** — schema (ScoringConfig + ScoreHistory + CrmContact/IntentSignal/SignalTypeRegistry extensions) + ScoringConfig v1 seed from Andy's reference doc + config-loader (module cache, 60s TTL) + Zod validation. 17 new tests. |
| `eb43057` | 2026-05-15 | **Sprint 3b** — compute engine. Pure functions: `apply-time-decay`, `compute-intent-score`, `pattern-match` (graceful 0-deals fallback), `compute-icp-score` (5 factors summing to 50), `compute-priority-score` orchestrator. 60 new tests. |
| `90b7748` | 2026-05-15 | **Mini-patch DM patterns** — DIRECT_DM_PATTERNS extended with long-form "Chief X Officer" alongside acronyms. Sample Tony Zero21 ICP 25 → 35. |
| `c945151` (PR #6 → `7ee4b7f`) | 2026-05-24 | **Sprint 3a B3** — backfill SignalTypeRegistry `intentCategory`/`signalLevel`/`triggerType` on 11 active codes per Andy mapping ; deactivate 3 legacy placeholders ; recalibrate `clay_business_loss` defaultPoints 10 → 4. 7 tests. Backfill script runs in prod : `npx tsx scripts/db/backfill-signal-types-categories.ts`. |
| `9bca8a2` (PR #7) + `becfa51` (PR #8) | 2026-05-29 | **Sprint 3c — Priority Level + Pain Tier + Negatives + Persist** — `assignPriorityLevel` (P1/P2/P3/Monitor/Excluded, D1) ; `inferPainTier` override-only V1 (D2/D10) ; `applyNegativeSignals` Option A reads CrmContact direct fields (D3) ; `persistScore` transaction CrmContact + ScoreHistory, returns `{previousLevel, newLevel, promoted}` delta (D7) ; `score-recompute-runner` ; 3 endpoints (`POST /api/scoring/recalculate` admin + `recalculate-all` admin + `cron/recompute-scores` CRON_SECRET). 58 new tests. Live smoke on Tony Christoforou : ICP 35 + Intent 0 → Monitor (consistent with recon projection). PR #8 = `run-recompute.ts` manual batch helper. |
| `d184334` (PR #9 → `d45dfe0`) | 2026-05-29 | **Sprint 3d — Triggers + Lemlist adapt + BD alerts + Intent Feed** — Final Phase 3 sprint. `classifyTrigger` (config-driven, D2) ; `orchestrateSequence` Lemlist adapt-only V1 (D1 — recon proved API can't reschedule, so adapt = PATCH custom variables, accelerate adds Telegram BD manual-move alert) ; `lemlist.ts` extended with `updateLeadVariables` + token-bucket rate limiter (20 req/2s) + 429 retry-on-backoff ; `alertBDsOnPromotion` + `formatPromotionAlert` Telegram broadcast on Monitor/P3→P1/P2 promotions (D3 caller-side, reuse `trigify-alerts` pattern) wired at 3 sites (runner + recalculate + recalculate-all) ; Intent Feed Option C — `priorityLevelBadge` helper + single-select `priority_level` filter merging with `group` (D4) ; `/api/accounts` GET with ILIKE OR + tiered JS scoring (exact 100 / name 90 / starts-with 70 / contains 40) + union response shape (D6/D8). 39 new tests (652/652 total). |
| `aa6a9d0` | 2026-05-29 | **IntentSignal stamping fix** — stamp `intentCategory` + `signalLevel` on the IntentSignal row at creation (was left NULL, recomputed downstream). Direct to main. |
| `7809de3` + `52febd3` | 2026-05-29 | **Hourly recompute cron** — GitHub Actions workflow "Score Recompute Hourly" calls `POST /api/scoring/cron/recompute-scores` (CRON_SECRET) ; moved off top-of-hour to `:17` to dodge GHA's congested `:00` queue. Confirmed firing in prod (≈13 success runs over ~30h ; GHA schedule is best-effort — timestamps drift + some ticks drop, normal). Direct to main. |
| `7184061` | 2026-06-01 | **ScoringConfig v2 — reconcile to Andy's doc** — `structuredClone(v1)` + deltas : 6-group model (G1-G6), companySize realign, trigger reclassifications, point recalc on registry. v2 active, v1 preserved inactive. Seed/backfill/recompute ran in prod. Direct to main. |
| `65de6d9` | 2026-06-01 | **Finding 1 — stamp real config version on ScoreHistory** — `persistScore` stamps the active ScoringConfig version (was hardcoded `1`). New accessor `getActiveScoringConfigWithVersion()` returns `{config, version}` from one DB row / cache entry → zero config↔version drift ; `getActiveScoringConfig()` becomes a thin wrapper. `configVersion` threaded as a required param into `score-recompute-runner` + `/api/scoring/recalculate`. Sentinel test (`=2≠1`) locks against re-hardcode. +4 tests. No backfill of the ~10 boundary rows (ScoreHistory append-only ; v1→v2 blip explainable). Direct to main. |
| `89d4dfb` | 2026-06-01 | **Finding 2 — derive companySize from string label** — `compute-icp-score` now parses the `companySize` string label (finite Clay/Apollo format set) into a size bracket when `employeeCount`/`revenueRange` are NULL, falling back to edge/0. +25 tests (parser + integration). Prod recon : scored pool all ideal(10) ; Self-employed = 0.3% ; >500-employee firms collapse to edge=3 by v2 design (parked ICP note for Andy, not a parser bug). Direct to main. |
| `63b3ddf` | 2026-06-01 | **lemlist `emailsUnsubscribed` hotfix** — added the missing `stageMap` entry so an unsubscribe flips `lifecycleStage → closed_lost` (was only flipping `lemlistStatus`). +2 tests (the webhook had none). Direct to main. (CRM/Lemlist webhook fix — listed here for chronology.) |
| `15cdaac` **(LOCAL — awaiting Vernon push)** | 2026-06-01 | **closeout #3 — `deriveSignalStamp` helper** — extract the (intentCategory, signalLevel, points) stamp every IntentSignal writer must denormalize into one pure helper `src/lib/scoring/derive-signal-stamp.ts`, adopted at **5 create sites / 3 webhooks** : `ingestSignal()` contact + company + market branches + the clay / n8n / **trigify** webhooks (Scope A, Vernon-confirmed after recon surfaced trigify as a 5th site). Zero behavior change — hardening against stamping drift (F6 : `computeIntentScore` filters `intentCategory != null` ON THE ROW). Points parity exact (clay/n8n `?? 10` ↔ `defaultPoints === 10` verified read-only in prod ; trigify two-level fallback preserved). Each webhook's `source`/`signalType`/`title`/`detail`/`expiresAt` (incl. n8n's NULLABLE expiresAt) stay intentionally source-specific & load-bearing downstream → NOT routed through `ingestSignal()`, only the stamp is shared. +10 tests ; existing ingestSignal/clay-enrichment/trigify suites green UNMODIFIED (identity proof). |

**Phase 3 = 100% in prod.** All sprints merged + ScoringConfig v2 deployed +
Finding 1 fixed. The engine runs hourly in prod (recompute cron) and Trigify is
enabled — next milestone is the first organic IntentSignals flowing in. Backlog
post-Phase 3 in §Backlog below.

**Known V1 limitations** (acknowledged in PRD-004 + Sprint 3d recon) :
- 0 IntentSignals in prod DB → Intent score = 0 for every account until
  Trigify produces real data. ⏳ Trigify "LinkedIn oxen" workflow **enabled
  2026-06-01** ; awaiting the first organic signals (hours/days). The hourly
  recompute cron (`:17`) already fires green — it *consumes* signals, so scores
  move on the next tick once they land.
- 0 closed_won Deals → Pattern Match returns noMatch=0 for every account
  (graceful fallback)
- ~~**ICP companySize bracket** (Finding 2) — size factor fell to edge/0 when
  `employeeCount`/`revenueRange` NULL~~ → ✅ resolved 2026-06-01 (`89d4dfb`) :
  `compute-icp-score` parses the `companySize` string label (finite Clay/Apollo
  format set) into a bracket, edge/0 fallback, formats unit-tested. Caveat
  parked for Andy : >500-employee firms collapse to edge=3 by v2 ideal-cap
  design (not a parser bug ; 8 firms today → impact nul).
- ~~SignalTypeRegistry.intentCategory all NULL until B3 backfill runs in
  prod~~ → ✅ resolved 2026-05-24 (B3 backfill ran ; 11 active codes
  mapped, 3 placeholders deactivated)
- Pain Tier V1 = OVERRIDE ONLY (Sprint 3c D2/D10) — full inference deferred
  V2 pending Andy's algorithm validation (his §10 Q1)
- Negative signals V1 covers 3/7 types (lemlist bounced, lemlist unsubscribed,
  doNotContact) — the other 4 need upstream Lemlist webhook distinction +
  enrichment-diff detection, deferred to a future emission V2 layer
- **Sprint 3d Lemlist acceleration is content-adapt only** (recon Finding 6) —
  the public API does not allow rescheduling a launched lead's next send
  date or skipping to the next step. V1 reframes `accelerate` as
  `adapt + Telegram BD manual-move recommendation`. Programmatic
  cross-campaign move (2-call enrol+remove workaround) deferred V2 once
  atomicity story is worked out.
- **Sprint 3d "rewrite next touch"** (Andy §8 Q3) = V1 template variable
  substitution (`customField1..3` slot contract documented in
  `orchestrate-sequence.ts`). AI-generated rewrite via Claude API = V2.
- **Sprint 3d Intent Feed Option C** keeps proxy-score sort + adds
  `priorityLevel` badge per card + single-select filter. Sort by
  `contact.priorityScore` (Option A) deferred to Sprint 3e if dogfooding
  asks for it. Multi-select priority filter also V2.
- **Sprint 3d `/api/accounts` ILIKE V1** — `pg_trgm` not installed (current
  ~600-contact volume doesn't justify it). V2 = trigram + GIN indexes +
  Postgres `similarity()` ranking.
- **Lemlist BD alerts require `telegramChatId` populated for ad@/pg@/vd@**
  on `Employee` row via the /team page UI (seeds don't populate it). Pre-Sprint
  3d deploy check : confirmed by Vernon 2026-05-29.
- **Custom field slot contract** (Sprint 3d Lemlist adapt) — campaigns
  must reference `{{customField1}}` (signal type), `{{customField2}}`
  (priorityLevel), `{{customField3}}` (context snippet) in their templates,
  otherwise the `updateLeadVariables` call writes the fields but the next
  email won't pick them up. Coordinate with Andy on existing campaigns.

### 2. SP16 — Onboarding Console (OCA operator UI)

**Goal** : internal Oxen-OS console for compliance operators to triage KYB
onboarding sessions produced by OCA (`oxen-compliance-agent`). Read-only
session display + 3 operator actions. Feature-flagged behind
`ONBOARDING_CONSOLE_ENABLED` ; production stays dark until flag flip.

**Status** : 5 SP16 tickets shipped through SP16-005 ; SP16-006 not defined.

**Shipped** :

| PR | Commit | Date | Title |
|---|---|---|---|
| #1 | `703cd56` | 2026-05-22 | **SP16-002** — read-only console scaffold (module + flag + nav + access gate + OCA proxy + list view + detail view) |
| #2 | `957139f` | 2026-05-22 | **SP16-002b** — rendering polish (real OCA status enum + formatted documents/cases/audit rows + screening empty state) |
| #3 | `531c299` | 2026-05-23 | **SP16-003** — operator actions (takeover/handback + operator message composer + reopen rejected). 3 new mutation proxy routes ; `x-operator-email` server-derived from session. |
| #4 | `9dc843c` | 2026-05-23 | **SP16-004** — label humanization (humanizeToken + 11 labelForX maps + applied across list and detail) |
| #5 | `e91e33d` | 2026-05-24 | **SP16-005** — risk display (RISK_COLOR pinned to OCA standard/high enum, pill+label in list + StatusStrip with "Risk: not yet assessed" null state) |

**OCA-side dependencies** (future OCA tickets, not Oxen-OS work) :
- **Surface session rejection reason in AdminSessionView DTO** — currently
  `KybSession` has only generic `reviewNotes`, no rejection_reason column.
  Documented in [SP16_004_NOTES.md](docs/sprint-16/SP16_004_NOTES.md) §Step 0.
- **Live colored risk pill validation** — 2 OCA staging sessions both stuck
  at TRIAGE with `risk_level=null`. Visual confirmation of the
  standard/high colored rendering awaits a risk-assessed session.

**Operational notes** :
- OCA `OPERATOR_ALLOWLIST_EMAILS` must include Oxen-OS users who operate the
  console (two-list sync — documented in SP16-002 NOTES).
- OCA staging base URL : `https://oxen-compliance-agent-staging.up.railway.app`.
- `OCA_OPERATOR_API_KEY` lives in `.env.local` (gitignored, never committed).

**Next — SP16-006+ (open)** :
- No defined ticket yet. Candidates seeded by prior tickets :
  - Risk filter in OnboardingFilters (out-of-scope per SP16-005)
  - In-list session search
  - Rejection reason rendering (depends on OCA-side ticket)
  - Bulk operator actions

---

## Other shipped (pre-SP16, pre-Phase 3) — recent

| Commit | Date | What |
|---|---|---|
| `dc0759b` | 2026-05-15 | **Intent Feed UI V1** — BD dashboard at `/crm/intent-feed`. Filter URL sync, signal cards with hot badge, Create Task modal, Send Telegram broadcast, Mark Actioned. Proxy-score V1 (recency × points) until Sprint 3d integration. 17 tests. |
| `fe3b40a` | 2026-05-15 | **Hotfix R0** — `acquisitionSource` NULL bug. SP S0.5 `upsertPersonFromClay` never wrote the field. Fixed CREATE + UPDATE preserve-if-set ; backfill SQL for 597 legacy contacts. PRD-004 D5. |
| Earlier | — | Sprint Trigify Phase 2A (webhook + matching + alerts), Sprint S1 (Signal Type Registry + universal ingestion), Sprint S0/S0.5 (Clay enrichment + PRD-001 scoring foundations) |

---

## Backlog

### Ready to start (sized, no blocker)

| # | Ticket | Effort | Trigger |
|---|---|---|---|
| 1 | **Await first organic IntentSignals** (Trigify "LinkedIn oxen" enabled 2026-06-01) → first promotions → first BD alerts in prod. Watch the webhook + IntentSignal row count, not the cron (already green). | varies (Trigify side ; hours/days) | Trigify enabled — now waiting |
| 2 | **Coordinate Lemlist templates with `customField1..3` slot contract** — campaigns need `{{customField1}}` placeholders for adapt to actually surface in emails | ~30 min Andy + Vernon | Real Lemlist enrollments |
| 3 | ~~**Finding 2 — ICP companySize bracket**~~ → ✅ done 2026-06-01 (`89d4dfb`). | — | done |
| 4 | **closeout #4 — drop unused `CrmGroup` G7A/G7B enum values** (separate PR ; the remaining post-Phase-3 closeout item) | ~15 min | Anytime (low priority) |
| 5 | **Optional Sprint 3e** — Intent Feed sort by `priorityScore` (Option A), if BD dogfooding asks for it | ~0.5 day | First real signal volume + BD feedback |
| 6 | **PRD-005 Apify+n8n** — Cat C/D/E/F/I signal sources beyond Trigify/Clay | TBD | Phase 3 in prod, signal data flowing |
| 7 | **PRD-006 Apollo switch** | TBD | TBD |

### Sprint 3d sub-backlog (post-merge cleanup)

| # | Item | Effort | Why deferred |
|---|---|---|---|
| 1 | ~~Refactor `clay`/`n8n` webhooks to delegate to `ingestSignal()`~~ → **superseded by closeout #3** (`15cdaac`, local). Recon proved full delegation is NOT behavior-preserving : `ingestSignal()` accepts no `source`/`signalType`/`title`/`detail` inputs and always sets a non-null `expiresAt` (n8n needs NULLABLE) — all load-bearing downstream. Chosen instead : extract ONLY the shared stamp via `deriveSignalStamp`, adopted at clay + n8n + **trigify** (Scope A). Webhooks keep their source-specific fields. | done (local) | — |
| 2 | ~~Lemlist webhook hotfix — `emailsUnsubscribed` missing from `stageMap`~~ → ✅ done 2026-06-01 (`63b3ddf`, pushed). `lifecycleStage` now flips to `closed_lost` on unsubscribe ; +2 tests (webhook had none). | done | — |
| 3 | Sprint 3d V2 path — programmatic Lemlist cross-campaign move (2-call enrol+remove with atomicity story) ; AI-rewrite next touch via Claude API ; pg_trgm fuzzy match | weeks (V2 milestone) | Lemlist API public surface limits V1 ; pg_trgm volume not justified |

### Specced but blocked / awaiting decision

- **OCA-side : expose session rejection_reason in AdminSessionView DTO** —
  unlocks an Oxen-OS SP16-XXX (~30 min UI work). Vernon's call when this OCA
  ticket runs.
- **SP16-006** — open (candidates listed above). Awaiting Vernon priority.

### Future / ideas (no spec)

- **Component test infrastructure** — install `@testing-library/react` + jsdom +
  vitest jsdom env. Currently React components rely on TS + visual QA + smoke
  tests on the larger panels (DocumentsPanel, CasesPanel, format/labels/types).
  Adding RTL would let us properly test interactive components
  (AgentToggleControl, MessageComposer, ReopenControl, CreateTaskFromSignalModal).
  Sprint-sized work : ~0.5 day infra + per-component coverage as needed.
- **Lint baseline cleanup** — 79 errors + 159 warnings (CI non-blocking,
  `continue-on-error: true`). Goal : flip CI Lint to a blocking required check.
  Sprint-sized : ~1-2 days depending on the categories.
- **Real staging environment** (separate Railway service + `staging` branch) —
  would unlock SP16-style validation flows that currently rely on "merge to
  main behind flag, flip flag in prod". Larger workstream — infra + CI/CD
  rewiring.

---

## Tech debt & known issues

| Issue | Severity | Status / Mitigation |
|---|---|---|
| Lint baseline 79 errors + 159 warnings | 🟡 LOW | CI job `continue-on-error: true` — non-blocking. Cleanup sprint sized in backlog. |
| No staging branch → push = prod | 🟠 MED | Hard gate : `npm run build` green AND tests green at every commit. Feature flags for risky new surfaces (ONBOARDING_CONSOLE_ENABLED). |
| No component test infra | 🟡 LOW | Coverage gap on interactive React components. TS strict mode + visual QA + API-route tests catch most regressions. Backlog item. |
| 0 IntentSignals in prod DB | 🟠 MED | Trigify "LinkedIn oxen" workflow enabled 2026-06-01 ; awaiting first organic signals (hours/days). Intent score = 0 for every account until they land. Hourly recompute cron (`:17`) already firing green — consumes signals on the next tick once they arrive. Sprint 3b compute lib tested with synthetic data. |
| 0 closed_won Deals → Pattern Match noMatch=0 | 🟡 LOW | Graceful fallback documented in Sprint 3b. Real Pattern Match validation awaits the first closed_won. |
| ~~ICP companySize falls to edge/0 bracket (Finding 2)~~ | ✅ FIXED | `89d4dfb` (2026-06-01) — `compute-icp-score` parses the `companySize` string label into a bracket, edge/0 fallback, formats unit-tested. >500-employee edge=3 caveat parked as an ICP note for Andy (v2 ideal-cap design, not a parser bug). |
| OCA risk live validation pending | 🟡 LOW | Both staging sessions stuck at TRIAGE with null risk. Colored pill rendering locked by unit tests ; live visual check awaits a risk-assessed session. |
| OCA does not expose session rejection reason | 🟡 LOW | OCA-side ticket queued. SP16-004 NOTES Step 0 documents. |
| `acquisitionSource` was NULL on 597 contacts | ✅ FIXED | Hotfix R0 (`fe3b40a`) + backfill SQL ran 2026-05-15. |
| Lemlist webhook doesn't distinguish soft vs hard not-interested | 🟡 LOW | Sprint 3c V1 Option A ignores the distinction. Sprint 3c notes the gap. Upstream Lemlist webhook would need a change. |
| Lemlist API cannot accelerate a launched lead | 🟠 MED | Confirmed by Sprint 3d recon (no `next_send_at`, no skip post-launch). V1 = adapt content via custom variables + Telegram BD alert for manual move. Programmatic cross-campaign move = V2. |
| ~~Lemlist webhook `emailsUnsubscribed` missing from `stageMap`~~ | ✅ FIXED | `63b3ddf` (2026-06-01) — added the `stageMap` entry ; unsubscribe now flips `lifecycleStage → closed_lost`. +2 tests. |

---

## Conventions (canonical : [CLAUDE.md](CLAUDE.md))

- **Mode B strict** — commit local → Vernon reviews diff → Vernon pushes.
  NO `--no-verify`. NO automated push from Claude.
- **Build-green hard gate** — `npm run build` MUST pass at every commit
  (no staging buffer absorbs broken builds).
- **Atomic commits** — one feature per commit ; one slice per commit on
  EXEC-pattern tickets.
- **Branch naming** — `<workstream>-<id>-<short-description>`. Examples :
  `sp16-003-onboarding-actions`, `scoring-3a-b3-backfill-categories`,
  `claude/<user>-<random>` for agent worktrees.
- **Git config** — `user.email = v@escrowfy.ch`. Commit messages :
  `feat: add X`, `fix: resolve Y`, `refactor: restructure Z`,
  `docs(scope): ...`. Co-Author footer
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **Doc convention** — RECON docs stay untracked under `docs/sprint-16/` ;
  NOTES docs (from EXEC Slice 5) are tracked. PRDs live in `reference/`.
- **Security** — all API routes auth-checked (`requirePageAccess` /
  `requireAdmin` / webhook secrets). No secrets in code. Webhook
  routes verify `x-webhook-secret`. See CLAUDE.md §Security Rules.

---

## How to update this doc

1. After every PR merge to main : move the row into the corresponding
   workstream's "Shipped" table ; update the "Status" line ; clear the
   item from "Backlog → Ready to start" if applicable.
2. After every new spec ratified : add to the workstream's "Next" or
   "Future" subsection.
3. After every OCA-side / external dependency identified : add to the
   workstream's "OCA-side dependencies" or to the top-level "Backlog →
   Specced but blocked".
4. After every scope decision (Vernon makes a call) : log a one-liner
   in the relevant workstream section so future readers don't
   re-litigate.
5. **Always refresh the `Last updated` date at the top.** That's the
   one thing future-Vernon will glance at to know if this doc is current.
6. Keep §TL;DR fresh — that's the elevator pitch. If §TL;DR is more
   than a paragraph, the doc has drifted ; compress.
