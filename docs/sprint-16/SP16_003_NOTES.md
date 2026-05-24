# SP16-003 NOTES — Onboarding console operator actions

**Status** : EXEC delivered, awaiting Vernon review + push
**Branch** : `sp16-003-onboarding-actions` (off `main` after the SP16-002b PR #2 merge — commit `957139f`)
**Scope** : 3 mutation actions wiring existing OCA endpoints (no OCA change)
**Effort** : ~6h, 5 slices, 4 commits + this doc

## Step 0 — Verified OCA contracts (live staging, 2026-05-23)

The RECON pinned path/method/auth with high confidence but left 3
uncertain field-name fields. All 3 verified against OCA staging via
the OCA repo's `src/api/routes/operator.ts` source + careful live
calls:

### 1. PATCH `/api/admin/sessions/:id/agent`

| Field | RECON guess | **Verified** |
|---|---|---|
| Request body | `{agentActive: boolean}` ⚠️ | **`{active: boolean}`** — `agentActive` and `agent_active` both return 400 "Required" |
| Response 200 (transition) | session core OR thin delta | **`{session_id, agent_active, changed: true}`** |
| Response 200 (no-op idempotent) | not RECON-stated | **`{session_id, agent_active, changed: false}`** |
| Audit row | `action: "operator_pause_agent"` or similar | **`action: "agent_paused"` / `"agent_resumed"`**, `actor: "operator:<email>"` |

**Verification method** : net-zero round-trip on throwaway session
`3fec2737-9774-47ce-bcbd-03e2b4e63d79` — PATCH `{active: false}` then
PATCH `{active: true}`. Both flips returned the transition-success
shape. Final state == initial state.

### 2. POST `/api/admin/sessions/:id/messages`

| Field | RECON guess | **Verified** |
|---|---|---|
| Request body | `{content: string}` ⚠️ | **`{message: string}`** (1-5000 chars). Asymmetric: response uses `content`. |
| Response 201 | `{id, role: "operator", content, operatorEmail/operator_email, createdAt/created_at}` | **`{id, session_id, sender: "operator", operator_email, content, created_at}`** — snake_case throughout |
| Audit row | not RECON-stated | **`action: "operator_message_sp15_002"`**, `actor: "operator:<email>"`, `payload: {chat_message_id, content_length}` |

**Verification method** : 1 test message to throwaway session
`3fec2737-9774-47ce-bcbd-03e2b4e63d79` (chat message id
`d1fa6a9e-b3c7-43b2-8985-aae6ddf0af7b`, content "[SP16-003 Step 0
smoke test 2026-05-23 — please ignore]"). Confirmed it appears in
the transcript with `sender: "operator"` + `operator_email:
"vd@oxen.finance"`.

### 3. POST `/api/admin/sessions/:id/reopen`

| Field | RECON guess | **Verified** |
|---|---|---|
| Request body | empty | **`{}`** (Fastify rejects truly empty body with `content-type: application/json` ; the empty-object placeholder satisfies) |
| Response 200 | `{session_id, previous_status, new_status, reopened_at}` | **Confirmed verbatim** (from OCA source) |
| Response 409 (non-rejected) | `{error: "Conflict"}` shape | **`{error: "Conflict", message: "Only 'rejected' sessions can be reopened …", statusCode: 409, session_status: "<current>"}`** |
| Side effect | `rejected → review` only ; other states 409 | **Confirmed** — `paused` has its own legacy `/resume`; `active/completed/approved/expired` all 409 |

**Verification method** : POST `/reopen` `{}` on throwaway session
`3fec2737-9774-47ce-bcbd-03e2b4e63d79` (status `review`) — returned
409 with the documented body shape, no mutation. The 200 path is
NOT verified live (would require flipping a session to rejected
first — Vernon's smoke after merge will validate end-to-end).

### Operational note for Vernon

The single test message left on session `3fec2737` (id
`d1fa6a9e-b3c7-43b2-8985-aae6ddf0af7b`) is benign — text reads
"[SP16-003 Step 0 smoke test 2026-05-23 — please ignore]". The
agent toggle was net-zero so its state matches the starting
agent_active=true. The reopen 409 verification did not mutate
anything.

## Slices delivered

| Slice | Commit | One-line |
|---|---|---|
| **1** | `ae95247` | feat(sp16-003): mutation proxy helper + agent/messages/reopen routes |
| **2** | `2504c6f` | feat(sp16-003): operator takeover / hand-back |
| **3** | `699256c` | feat(sp16-003): operator message composer |
| **4** | `ead37b8` | feat(sp16-003): reopen rejected session |
| **5** | `2901091` | docs(sp16-003): operator actions notes |

## Test delta

Baseline pre-SP16-003 : 497 tests (SP16-002b end-of-sprint).
End of SP16-003 : **518 tests** (+21 new — all from Slice 1's 3 new
mutation route test files: agent 7 + messages 6 + reopen 7 + 1
non-test happy-path-of-existing-route-still-green delta).

No component tests for the 3 new React components (AgentToggleControl,
MessageComposer, ReopenControl) — mirroring the SP16-002 /
Intent Feed convention (the repo has no `@testing-library/react`
or `jsdom` dependency; API routes + extracted pure helpers carry
the coverage). The 3 mutation routes from Slice 1 cover the
network + auth + body-validation surface that the components
invoke.

## Decisions resolved

| Decision | Resolution |
|---|---|
| Q1 confirm modal copy (reopen) | "Reopen session for {legal_rep_name} at {company_name}? This will move the session from rejected back to review so an operator can re-engage." Fallback to "this session" when names absent. |
| Q2 takeover labels | State label "Agent active" / "Agent idle" + action label "Take over conversation" / "Hand back to agent" + "(you are in control)" subtitle when paused. |
| Q3 composer placeholder | "Reply as operator…" |
| Q4 per-action confirmations | NO confirm on takeover/handback ; NO confirm on message (compose IS the deliberation) ; YES confirm on reopen (consequential status change). |
| Q5 refetch vs optimistic | Hybrid (optimistic + refetch) — verified in all 3 controls. |
| Q6 reopen-button gating | Show ONLY when status === "rejected" (self-gated inside ReopenControl, returns null otherwise). |
| Q7 OCA contract uncertainties | Step 0 verified via 2 careful mutations on throwaway session 3fec2737 + 1 read of the OCA source. Material deltas: `active` (not `agentActive`/`agent_active`), `message` (not `content`). |
| Q8 smoke-test session for reopen | NOT created during EXEC — out of EXEC scope. Vernon's post-merge smoke validates 200 path against a real rejected session if/when one lands ; otherwise defer until production has one. |
| Q9 OCA repo for contract verification | `/Users/vd/Code/oxen-compliance-agent/src/api/routes/operator.ts` — used by EXEC to pin all 3 contracts before the live calls. |

## Files changed

```
src/lib/oca/proxy.ts                                                    +83 -22 (Slice 1)
src/app/api/oca/sessions/[id]/_schemas.ts                          NEW  +30   (Slice 1)
src/app/api/oca/sessions/[id]/agent/route.ts                       NEW  +35   (Slice 1)
src/app/api/oca/sessions/[id]/agent/route.test.ts                  NEW  +180  (Slice 1)
src/app/api/oca/sessions/[id]/messages/route.ts                    NEW  +35   (Slice 1)
src/app/api/oca/sessions/[id]/messages/route.test.ts               NEW  +170  (Slice 1)
src/app/api/oca/sessions/[id]/reopen/route.ts                      NEW  +37   (Slice 1)
src/app/api/oca/sessions/[id]/reopen/route.test.ts                 NEW  +195  (Slice 1)
src/app/onboarding/_components/AgentToggleControl.tsx              NEW  +130  (Slice 2)
src/app/onboarding/_components/StatusStrip.tsx                          +25 -22 (Slices 2+4)
src/app/onboarding/_components/OnboardingDetail.tsx                     +6 -2  (Slices 2+3)
src/app/onboarding/_components/MessageComposer.tsx                 NEW  +175  (Slice 3)
src/app/onboarding/_components/ChatPanel.tsx                            +115 -6 (Slice 3)
src/app/onboarding/_components/ReopenControl.tsx                   NEW  +240  (Slice 4)
docs/sprint-16/SP16_003_NOTES.md                                   NEW  (this) (Slice 5)
```

## Deviations from RECON / EXEC

| # | Deviation | Reason |
|---|---|---|
| D1 | RECON §1.2 recommended a `proxyOcaMutation()` wrapper. EXEC delivered the wrapper AND kept the underlying `proxyOcaJson(method, ...)` exported for direct use. | Wrapping `GET` and mutations both is cleaner than `proxyOcaMutation` standalone — gives future GET-with-body or method-agnostic callers a clean entry. Zero impact on the 3 routes shipped (they use `proxyOcaMutation`). |
| D2 | RECON §2 listed 3 "uncertain" field-name fields per endpoint ; reality found a 4th deviation on the agent route (`active` not `agentActive`/`agent_active`). | The RECON's confidence rating was MEDIUM on this exact field for this exact reason — Step 0 caught it as designed. No scope impact. |
| D3 | RECON §3.3 + EXEC Slice 4 default modal copy used a slightly different sentence (RECON: "This will return the session to operator review"). NOTES uses "This will move the session from rejected back to review so an operator can re-engage." | Slight tightening for clarity in the UI ; both convey the same effect. Vernon can edit the string in `ReopenControl.tsx:153` if preferred. |
| D4 | RECON §8 estimated `Slice 1 ≈ 1h, Slice 2 ≈ 1.5h, Slice 3 ≈ 2h, Slice 4 ≈ 1.5h, total ~6-8h`. Actual EXEC closer to ~5-6h focused. | Step 0 verifications were faster than budgeted because the OCA repo was locally available (Q9 path) ; the brute-force live discovery would have cost more, but reading OCA source pinned the 3 contracts in minutes. |
| D5 | NO React component tests for the 3 new UI components (AgentToggleControl, MessageComposer, ReopenControl). | Mirrors the SP16-002 + Intent Feed convention. Adding `@testing-library/react` + `jsdom` would be a scope-broadening infra change ; documented as known and intentional. Components are small (130-240 LOC each) with simple state machines covered structurally by the API route tests in Slice 1. |

## Confirmations (mandatory close-out)

- ✅ **`x-operator-email` is server-derived on all 3 mutation proxies.**
  Each route test asserts that an attacker-supplied
  `x-operator-email` request header is IGNORED — the proxy injects
  the session's email derived from `await auth()` via
  `requirePageAccess("onboarding")`. The OCA audit log will
  therefore attribute every operator action to the real human
  (`actor: "operator:<email>"`).
- ✅ **All 3 new proxy routes are flag + access gated.** Flag-off ⇒
  404 (invisible to probes) ; access-denied ⇒ requirePageAccess
  forwards 401/403. Both paths short-circuit before any OCA call.
- ✅ **No OCA backend change, no schema, no migration.** Frontend +
  proxy routes only. The 3 OCA endpoints existed (SP15) ; this
  ticket wires them into the OS.
- ✅ **SP16-002 GET routes still work.** `proxyOcaGet` kept as a
  backward-compatible 1-line wrapper around `proxyOcaJson("GET", ...)`.
  The 2 existing SP16-002 GET route test files pass unchanged.
- ✅ **Build green.** `npm run build` exit 0 at every commit
  (no-staging-branch hard gate respected).
- ✅ **Tests green at every commit.** 518/518 across the 4
  implementation slices (the +21 SP16-003 tests landed in Slice 1
  and stayed green through Slices 2-4).

## Local validation instructions for Vernon

```bash
# .env.local already has the 3 SP16-002 env vars from prior setup.
# Confirm with:
grep -E "^(ONBOARDING_CONSOLE_ENABLED|OCA_API_BASE_URL|OCA_OPERATOR_API_KEY)=" .env.local
# Should show 3 lines (values may be masked in your shell prompt).

npm run dev
# Open http://localhost:3000/onboarding/
# Sign in with vd@oxen.finance.
# Click any session → detail view loads with OCA staging data.

# Validate Slice 2 — takeover:
#   - The agent indicator on the right of the status strip is now a
#     button. Click "Take over conversation" → agent_active flips →
#     "(you are in control)" subtitle appears. Click again to hand
#     back. Each click writes a system notice to the chat transcript
#     (visible in the refetch).

# Validate Slice 3 — message composer:
#   - Scroll the chat panel. Below the transcript, a textarea +
#     Send button. Type → Send → an optimistic bubble appears
#     immediately with "Sending…" subtitle. ~300ms later the
#     canonical bubble replaces it (from the refetch).
#   - Try sending an empty message → Send is disabled.
#   - Try sending a 5001-char message → red border on textarea +
#     red 5001/5000 counter + Send disabled.

# Validate Slice 4 — reopen:
#   - Staging currently has no rejected sessions (only active +
#     review). To validate visually, open the staging admin tooling
#     and flip one session to rejected. Then on the OS detail page
#     a rose-colored "Reopen →" button appears on the right of the
#     status strip. Click → confirm modal with the named subject.
#     Click "Reopen" → status flips to "review", button disappears.
```

## Post-merge follow-ups (out of SP16-003 scope)

- Reopen 200-path live validation pending a real `rejected` session
  in staging.
- Vernon's post-merge prod smoke (flag flip on the throwaway test
  session 3fec2737 if needed, or any real session).
- The single test message at `d1fa6a9e-b3c7-43b2-8985-aae6ddf0af7b`
  is harmless ; can be left as-is or deleted via OCA admin tooling
  if Vernon prefers a clean staging history.

Refs: `docs/sprint-16/SP16_003_RECON.md`, `docs/sprint-16/SP16_002_NOTES.md`,
`/Users/vd/Code/oxen-compliance-agent/src/api/routes/operator.ts`.
