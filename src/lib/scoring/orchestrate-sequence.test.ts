/**
 * Tests for orchestrateSequence + updateLeadVariables (Sprint 3d B2).
 *
 * Tests 1-7 mock the lemlist module so we assert on call shape and
 * orchestrate gating logic. Test 8 mocks global fetch end-to-end to
 * exercise the real updateLeadVariables 429 retry path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock the lemlist module surface that orchestrate-sequence imports.
vi.mock("@/lib/lemlist", () => ({
  updateLeadVariables: vi.fn(),
  isLemlistConfigured: vi.fn(() => true),
}))

import {
  orchestrateSequence,
  ORCHESTRATE_SLOTS,
  __resetOrchestrateInflight__,
} from "./orchestrate-sequence"
import { updateLeadVariables } from "@/lib/lemlist"

const baseContact = {
  id: "ct-1",
  email: "alice@example.com",
  lemlistStatus: "active" as string | null,
  lemlistCampaignId: "camp_123" as string | null,
  priorityLevel: "P2" as string | null,
}

describe("orchestrateSequence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetOrchestrateInflight__()
    vi.mocked(updateLeadVariables).mockResolvedValue({ ok: true, status: 200 })
  })

  // ─── [1] rapid + enrolled → adapt ────────────────────────────────
  it("[1] rapid trigger calls updateLeadVariables and returns adapt", async () => {
    const result = await orchestrateSequence(
      baseContact,
      "rapid",
      { signalCode: "clay_director_change", contextSnippet: "new CFO joined" },
    )
    expect(result.action).toBe("adapt")
    expect(result.lemlistResult).toEqual({ ok: true, status: 200 })
    expect(updateLeadVariables).toHaveBeenCalledTimes(1)
    expect(updateLeadVariables).toHaveBeenCalledWith(
      "alice@example.com",
      {
        [ORCHESTRATE_SLOTS.signalType]: "clay_director_change",
        [ORCHESTRATE_SLOTS.priorityLevel]: "P2",
        [ORCHESTRATE_SLOTS.context]: "new CFO joined",
      },
    )
  })

  // ─── [2] immediate + enrolled → accelerate ───────────────────────
  it("[2] immediate trigger calls updateLeadVariables and returns accelerate", async () => {
    const result = await orchestrateSequence(
      baseContact,
      "immediate",
      { signalCode: "trigify_profile_visit" },
    )
    expect(result.action).toBe("accelerate")
    expect(updateLeadVariables).toHaveBeenCalledTimes(1)
    // No context snippet → empty string in slot 3.
    expect(updateLeadVariables).toHaveBeenCalledWith(
      "alice@example.com",
      expect.objectContaining({
        [ORCHESTRATE_SLOTS.signalType]: "trigify_profile_visit",
        [ORCHESTRATE_SLOTS.context]: "",
      }),
    )
  })

  // ─── [3] passive → noop ──────────────────────────────────────────
  it("[3] passive trigger returns noop with no Lemlist call", async () => {
    const result = await orchestrateSequence(
      baseContact,
      "passive",
      { signalCode: "trigify_role_change" },
    )
    expect(result).toEqual({ action: "noop", reason: "passive_trigger" })
    expect(updateLeadVariables).not.toHaveBeenCalled()
  })

  // ─── [4] not enrolled → noop ─────────────────────────────────────
  it("[4] missing lemlistCampaignId short-circuits to noop", async () => {
    const result = await orchestrateSequence(
      { ...baseContact, lemlistCampaignId: null },
      "rapid",
      { signalCode: "clay_director_change" },
    )
    expect(result).toEqual({ action: "noop", reason: "not_enrolled" })
    expect(updateLeadVariables).not.toHaveBeenCalled()
  })

  // ─── [5] status=replied → noop terminal ──────────────────────────
  it("[5] terminal status 'replied' returns noop without Lemlist call", async () => {
    const result = await orchestrateSequence(
      { ...baseContact, lemlistStatus: "replied" },
      "immediate",
      { signalCode: "trigify_profile_visit" },
    )
    expect(result.action).toBe("noop")
    expect(result.reason).toBe("terminal_status_replied")
    expect(updateLeadVariables).not.toHaveBeenCalled()
  })

  // ─── [6] status=unsubscribed → noop terminal ─────────────────────
  it("[6] terminal status 'unsubscribed' returns noop without Lemlist call", async () => {
    const result = await orchestrateSequence(
      { ...baseContact, lemlistStatus: "unsubscribed" },
      "rapid",
      { signalCode: "clay_director_change" },
    )
    expect(result.reason).toBe("terminal_status_unsubscribed")
    expect(updateLeadVariables).not.toHaveBeenCalled()
  })

  // ─── [7] mutex per-contact serialization ─────────────────────────
  it("[7] concurrent calls for the same contact run sequentially", async () => {
    // Make updateLeadVariables resolve after a tick — gives the mutex
    // a window to actually queue the second call. We assert that the
    // second call's promise starts after the first resolves by
    // tracking call order timestamps.
    const callOrder: string[] = []
    vi.mocked(updateLeadVariables).mockImplementation(async (_email, vars) => {
      callOrder.push(`start:${vars[ORCHESTRATE_SLOTS.signalType]}`)
      await new Promise((r) => setTimeout(r, 10))
      callOrder.push(`end:${vars[ORCHESTRATE_SLOTS.signalType]}`)
      return { ok: true, status: 200 }
    })

    const [r1, r2] = await Promise.all([
      orchestrateSequence(baseContact, "rapid", { signalCode: "sig_first" }),
      orchestrateSequence(baseContact, "rapid", { signalCode: "sig_second" }),
    ])

    expect(r1.action).toBe("adapt")
    expect(r2.action).toBe("adapt")
    expect(updateLeadVariables).toHaveBeenCalledTimes(2)
    // Strict serialization: first must complete before second starts.
    expect(callOrder).toEqual([
      "start:sig_first",
      "end:sig_first",
      "start:sig_second",
      "end:sig_second",
    ])
  })
})

// ─── [8] 429 retry-on-backoff end-to-end ─────────────────────────────
// Bypasses the lemlist module mock and exercises the real
// updateLeadVariables retry loop against a stubbed global fetch. This
// is the only test in this file that uses the unmocked lemlist code.

describe("updateLeadVariables 429 retry", () => {
  let originalFetch: typeof fetch
  let lemlistOriginal: typeof import("@/lib/lemlist")

  beforeEach(async () => {
    originalFetch = global.fetch
    process.env.LEMLIST_API_KEY = "test_key_b2"
    vi.doUnmock("@/lib/lemlist")
    vi.resetModules()
    lemlistOriginal = await import("@/lib/lemlist")
    lemlistOriginal.__resetLemlistRateLimiter__()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.doMock("@/lib/lemlist", () => ({
      updateLeadVariables: vi.fn(),
      isLemlistConfigured: vi.fn(() => true),
    }))
  })

  it("[8] retries on 429 with Retry-After and ultimately succeeds", async () => {
    let calls = 0
    global.fetch = vi.fn(async () => {
      calls += 1
      if (calls === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "0" }, // 0s → no real wait
        })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as unknown as typeof fetch

    const res = await lemlistOriginal.updateLeadVariables(
      "alice@example.com",
      { customField1: "trigify_profile_visit" },
    )
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(calls).toBe(2)
  })
})
