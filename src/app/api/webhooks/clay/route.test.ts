/**
 * Stamp-parity tests for /api/webhooks/clay (closeout #3).
 *
 * The route was refactored to derive its IntentSignal stamp
 * (intentCategory/signalLevel/points) via the shared deriveSignalStamp helper
 * instead of inline literals. These tests pin that the create still receives:
 *   - points = score when provided, else registryEntry.defaultPoints
 *     (parity with the previous `score ?? 10` since defaultPoints === 10)
 *   - intentCategory / signalLevel copied verbatim from the registry entry
 *   - source = "clay" (the intentional, load-bearing divergence — unchanged)
 *
 * Mock strategy mirrors the lemlist route test: vi.hoisted sets
 * CLAY_WEBHOOK_SECRET before import; @/lib/prisma is mocked; auth uses the
 * static x-webhook-secret header.
 */

import { describe, it, expect, vi, afterAll, beforeEach } from "vitest"

const { TEST_SECRET, ORIGINAL_SECRET } = vi.hoisted(() => {
  const ORIGINAL_SECRET = process.env.CLAY_WEBHOOK_SECRET
  const TEST_SECRET = "test-clay-secret-32bytes-deadbeefcafe"
  process.env.CLAY_WEBHOOK_SECRET = TEST_SECRET
  return { TEST_SECRET, ORIGINAL_SECRET }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    signalTypeRegistry: {
      upsert: vi.fn(),
    },
    intentSignal: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"

function makeReq(body: unknown) {
  return new Request("http://localhost/api/webhooks/clay", {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "x-webhook-secret": TEST_SECRET,
    }),
    body: JSON.stringify(body),
  })
}

type CreateArgs = { data: Record<string, unknown> }

describe("POST /api/webhooks/clay — stamp parity", () => {
  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CLAY_WEBHOOK_SECRET
    } else {
      process.env.CLAY_WEBHOOK_SECRET = ORIGINAL_SECRET
    }
  })

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({
      id: "ct-1",
      companyId: "co-1",
    } as never)
    // Mirror prod: clay_legacy_intent is a placeholder (intentCategory=null,
    // signalLevel="contact", defaultPoints=10).
    vi.mocked(prisma.signalTypeRegistry.upsert).mockResolvedValue({
      id: "reg-clay",
      intentCategory: null,
      signalLevel: "contact",
      defaultPoints: 10,
    } as never)
    vi.mocked(prisma.intentSignal.create).mockResolvedValue({} as never)
    vi.mocked(prisma.intentSignal.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.crmContact.update).mockResolvedValue({} as never)
  })

  it("[1] stamps points from `score` and copies category/level from the registry", async () => {
    const res = await POST(
      makeReq({
        email: "lead@example.com",
        enrichment_type: "tech_install",
        data: "Salesforce detected",
        title: "Clay Enrichment",
        score: 42,
      }),
    )
    expect(res.status).toBe(200)

    expect(prisma.intentSignal.create).toHaveBeenCalledTimes(1)
    const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0] as CreateArgs
    expect(args.data.points).toBe(42)
    expect(args.data.intentCategory).toBeNull()
    expect(args.data.signalLevel).toBe("contact")
    // Intentional, load-bearing divergence preserved (not routed via ingestSignal):
    expect(args.data.source).toBe("clay")
  })

  it("[2] falls back to registry.defaultPoints (=10) when `score` is absent", async () => {
    const res = await POST(
      makeReq({ email: "lead@example.com", enrichment_type: "tech_install" }),
    )
    expect(res.status).toBe(200)

    const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0] as CreateArgs
    // Parity with the previous inline `score ?? 10`.
    expect(args.data.points).toBe(10)
    expect(args.data.intentCategory).toBeNull()
    expect(args.data.signalLevel).toBe("contact")
  })
})
