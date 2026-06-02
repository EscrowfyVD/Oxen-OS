/**
 * Seam integration tests for applyReactiveLayer (Trigify PR1).
 *
 * We mock the BOUNDARIES (lemlist, config-loader, prisma) and let the real
 * classifyTrigger + orchestrateSequence run through — so we assert the actual
 * updateLeadVariables 3-slot call and prove no pause/destructive Lemlist op is
 * ever hit (lemlist has no pause; we assert removeLead/removeLeadFromAll/
 * enrollLead are never called).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/lemlist", () => ({
  updateLeadVariables: vi.fn(),
  removeLead: vi.fn(),
  removeLeadFromAll: vi.fn(),
  enrollLead: vi.fn(),
}))
vi.mock("@/lib/scoring/config-loader", () => ({
  getActiveScoringConfig: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: { findUnique: vi.fn() },
    activity: { create: vi.fn() },
  },
}))

import { applyReactiveLayer } from "./apply-reactive-layer"
import { __resetOrchestrateInflight__ } from "./orchestrate-sequence"
import { getActiveScoringConfig } from "@/lib/scoring/config-loader"
import {
  updateLeadVariables,
  removeLead,
  removeLeadFromAll,
  enrollLead,
} from "@/lib/lemlist"
import { prisma } from "@/lib/prisma"

// Minimal config — classifyTrigger only reads followUpTriggers.*.signals.
const CONFIG = {
  followUpTriggers: {
    immediate: { signals: ["sig_immediate"] },
    rapid: { signals: ["sig_rapid"] },
    passive: { signals: ["sig_passive"] },
  },
}

function mockContact(over: Record<string, unknown> = {}) {
  return {
    id: "ct-1",
    email: "lead@example.com",
    lemlistStatus: "active",
    lemlistCampaignId: "camp-1",
    priorityLevel: "P2",
    ...over,
  }
}

const assertNoPathToPause = () => {
  // lemlist has no pause; the only mutation the reactive layer may issue is
  // updateLeadVariables. Destructive/enrol ops must NEVER be touched.
  expect(removeLead).not.toHaveBeenCalled()
  expect(removeLeadFromAll).not.toHaveBeenCalled()
  expect(enrollLead).not.toHaveBeenCalled()
}

describe("applyReactiveLayer (Trigify reactive seam)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetOrchestrateInflight__()
    vi.mocked(getActiveScoringConfig).mockResolvedValue(CONFIG as never)
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      mockContact() as never,
    )
    vi.mocked(prisma.activity.create).mockResolvedValue({} as never)
    vi.mocked(updateLeadVariables).mockResolvedValue({ ok: true, status: 200 })
  })

  it("[1] rapid → updateLeadVariables with the 3 slots, action=adapt, no Activity", async () => {
    const res = await applyReactiveLayer({
      contactId: "ct-1",
      signalCode: "sig_rapid",
      contextSnippet: "ctx",
    })
    expect(updateLeadVariables).toHaveBeenCalledTimes(1)
    expect(updateLeadVariables).toHaveBeenCalledWith("lead@example.com", {
      customField1: "sig_rapid",
      customField2: "P2",
      customField3: "ctx",
    })
    expect(res.trigger).toBe("rapid")
    expect(res.action).toBe("adapt")
    expect(res.activityLogged).toBe(false)
    expect(prisma.activity.create).not.toHaveBeenCalled()
    assertNoPathToPause()
  })

  it("[2] immediate → updateLeadVariables with the 3 slots, action=accelerate (alert stays caller-side)", async () => {
    const res = await applyReactiveLayer({
      contactId: "ct-1",
      signalCode: "sig_immediate",
      contextSnippet: "hot",
    })
    expect(updateLeadVariables).toHaveBeenCalledTimes(1)
    expect(updateLeadVariables).toHaveBeenCalledWith("lead@example.com", {
      customField1: "sig_immediate",
      customField2: "P2",
      customField3: "hot",
    })
    expect(res.action).toBe("accelerate")
    expect(res.activityLogged).toBe(false)
    assertNoPathToPause()
  })

  it("[3] passive → NO Lemlist call + Activity logged, action=noop", async () => {
    const res = await applyReactiveLayer({
      contactId: "ct-1",
      signalCode: "sig_passive",
      contextSnippet: "fyi",
    })
    expect(updateLeadVariables).not.toHaveBeenCalled()
    expect(prisma.activity.create).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.activity.create).mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(arg.data.contactId).toBe("ct-1")
    expect(arg.data.type).toBe("intent_signal_passive")
    expect(arg.data.performedBy).toBe("system")
    expect(res.action).toBe("noop")
    expect(res.activityLogged).toBe(true)
    assertNoPathToPause()
  })

  it("[4] terminal status (replied) → noop, no Lemlist, no Activity", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      mockContact({ lemlistStatus: "replied" }) as never,
    )
    const res = await applyReactiveLayer({
      contactId: "ct-1",
      signalCode: "sig_rapid",
      contextSnippet: "x",
    })
    expect(updateLeadVariables).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
    expect(res.action).toBe("noop")
    expect(res.reason).toContain("terminal")
    assertNoPathToPause()
  })

  it("[5] not-enrolled (no campaignId) → noop, no Lemlist", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(
      mockContact({ lemlistCampaignId: null }) as never,
    )
    const res = await applyReactiveLayer({
      contactId: "ct-1",
      signalCode: "sig_immediate",
      contextSnippet: "x",
    })
    expect(updateLeadVariables).not.toHaveBeenCalled()
    expect(res.action).toBe("noop")
    expect(res.reason).toBe("not_enrolled")
    assertNoPathToPause()
  })

  it("[6] unclassified code → skipped, no contact fetch, no Lemlist, no Activity", async () => {
    const res = await applyReactiveLayer({
      contactId: "ct-1",
      signalCode: "totally_unknown_code",
      contextSnippet: "x",
    })
    expect(res.action).toBe("skipped")
    expect(res.reason).toBe("unclassified_code")
    expect(prisma.crmContact.findUnique).not.toHaveBeenCalled()
    expect(updateLeadVariables).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
    assertNoPathToPause()
  })

  it("[7] contact not found → skipped", async () => {
    vi.mocked(prisma.crmContact.findUnique).mockResolvedValue(null as never)
    const res = await applyReactiveLayer({
      contactId: "ghost",
      signalCode: "sig_rapid",
    })
    expect(res.action).toBe("skipped")
    expect(res.reason).toBe("contact_not_found")
    expect(updateLeadVariables).not.toHaveBeenCalled()
    assertNoPathToPause()
  })

  it("[8] never fails the caller — config load throws → skipped, no throw", async () => {
    vi.mocked(getActiveScoringConfig).mockRejectedValue(new Error("DB down"))
    const res = await applyReactiveLayer({
      contactId: "ct-1",
      signalCode: "sig_rapid",
    })
    expect(res.action).toBe("skipped")
    expect(res.reason).toBe("error")
    assertNoPathToPause()
  })
})
