/**
 * Tests for alertBDsOnPromotion (Sprint 3d B3).
 *
 * Mocks @/lib/telegram at the module level so we assert on
 * notifyEmployee invocations and the {alerted, recipients, failures}
 * return shape without needing a real bot token.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/telegram", () => ({
  notifyEmployee: vi.fn(),
  escHtml: (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
}))

import {
  alertBDsOnPromotion,
  shouldAlertOnPromotion,
} from "./alert-on-promotion"
import { notifyEmployee } from "@/lib/telegram"

const baseContact = {
  id: "ct-1",
  firstName: "Alice",
  lastName: "Smith",
  companyName: "Acme Trust",
  jurisdiction: "Cyprus",
}

const baseScoreCtx = { score: 62, signalCount: 4 }

describe("alertBDsOnPromotion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRM_BD_EMAILS = "ad@oxen.finance,pg@oxen.finance,vd@oxen.finance"
    vi.mocked(notifyEmployee).mockResolvedValue(true)
  })

  // ─── [1] Monitor → P1 → alerted ─────────────────────────────────
  it("[1] Monitor → P1 broadcasts to all BD emails", async () => {
    const result = await alertBDsOnPromotion(
      baseContact,
      "Monitor",
      "P1",
      baseScoreCtx,
    )
    expect(result).toEqual({ alerted: true, recipients: 3, failures: 0 })
    expect(notifyEmployee).toHaveBeenCalledTimes(3)
  })

  // ─── [2] P3 → P2 → alerted ──────────────────────────────────────
  it("[2] P3 → P2 broadcasts (alert-on-P2 gate)", async () => {
    const result = await alertBDsOnPromotion(
      baseContact,
      "P3",
      "P2",
      baseScoreCtx,
    )
    expect(result.alerted).toBe(true)
    expect(notifyEmployee).toHaveBeenCalledTimes(3)
  })

  // ─── [3] P2 → P1 escalation → alerted ───────────────────────────
  it("[3] P2 → P1 escalation broadcasts", async () => {
    const result = await alertBDsOnPromotion(
      baseContact,
      "P2",
      "P1",
      baseScoreCtx,
    )
    expect(result.alerted).toBe(true)
  })

  // ─── [4] P1 → P1 same-level → no_promotion_gate ─────────────────
  it("[4] same-level transition does not alert", async () => {
    const result = await alertBDsOnPromotion(
      baseContact,
      "P1",
      "P1",
      baseScoreCtx,
    )
    expect(result).toEqual({
      alerted: false,
      recipients: 0,
      failures: 0,
      reason: "no_promotion_gate",
    })
    expect(notifyEmployee).not.toHaveBeenCalled()
  })

  // ─── [5] P1 → P2 demotion → no_promotion_gate ──────────────────
  it("[5] demotion does not alert", async () => {
    const result = await alertBDsOnPromotion(
      baseContact,
      "P1",
      "P2",
      baseScoreCtx,
    )
    expect(result.reason).toBe("no_promotion_gate")
    expect(notifyEmployee).not.toHaveBeenCalled()
  })

  // ─── [6] → Excluded → no_promotion_gate ────────────────────────
  it("[6] transition to Excluded never alerts", async () => {
    const result = await alertBDsOnPromotion(
      baseContact,
      "Monitor",
      "Excluded",
      baseScoreCtx,
    )
    expect(result.reason).toBe("no_promotion_gate")
    // Also covers the Monitor → P3 case (P3 not in ALERTABLE).
    const r2 = await alertBDsOnPromotion(baseContact, "Monitor", "P3", baseScoreCtx)
    expect(r2.reason).toBe("no_promotion_gate")
  })

  // ─── [7] partial fan-out failure ───────────────────────────────
  it("[7] counts partial failures from notifyEmployee returning false", async () => {
    vi.mocked(notifyEmployee)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const result = await alertBDsOnPromotion(
      baseContact,
      "Monitor",
      "P1",
      baseScoreCtx,
    )
    expect(result).toEqual({ alerted: true, recipients: 3, failures: 1 })
  })
})

describe("shouldAlertOnPromotion (predicate)", () => {
  it("treats null previous as Monitor (Monitor → P1 = alert)", () => {
    expect(shouldAlertOnPromotion(null, "P1")).toBe(true)
  })
  it("rejects P3 destination (V1 gate)", () => {
    expect(shouldAlertOnPromotion("Monitor", "P3")).toBe(false)
  })
})
