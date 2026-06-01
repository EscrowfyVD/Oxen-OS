/**
 * Stamp-parity tests for /api/webhooks/n8n (create_signal action, closeout #3).
 *
 * The create_signal branch was refactored to derive its IntentSignal stamp
 * (intentCategory/signalLevel/points) via the shared deriveSignalStamp helper.
 * These tests pin that the create still receives:
 *   - points = data.score when provided, else registryEntry.defaultPoints
 *     (parity with the previous `data?.score ?? 10` since defaultPoints === 10)
 *   - intentCategory / signalLevel copied verbatim from the registry entry
 *   - source = "n8n" AND expiresAt NULLABLE — the intentional, load-bearing
 *     divergences from ingestSignal() (which always sets a non-null expiresAt).
 *
 * Mock strategy mirrors the lemlist route test: vi.hoisted sets
 * N8N_WEBHOOK_SECRET before import; @/lib/prisma is mocked; auth uses the
 * static x-webhook-secret header.
 */

import { describe, it, expect, vi, afterAll, beforeEach } from "vitest"

const { TEST_SECRET, ORIGINAL_SECRET } = vi.hoisted(() => {
  const ORIGINAL_SECRET = process.env.N8N_WEBHOOK_SECRET
  const TEST_SECRET = "test-n8n-secret-32bytes-deadbeefcafe0"
  process.env.N8N_WEBHOOK_SECRET = TEST_SECRET
  return { TEST_SECRET, ORIGINAL_SECRET }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmContact: {
      findFirst: vi.fn(),
    },
    signalTypeRegistry: {
      upsert: vi.fn(),
    },
    intentSignal: {
      create: vi.fn(),
    },
  },
}))

import { POST } from "./route"
import { prisma } from "@/lib/prisma"

function makeReq(body: unknown) {
  return new Request("http://localhost/api/webhooks/n8n", {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "x-webhook-secret": TEST_SECRET,
    }),
    body: JSON.stringify(body),
  })
}

type CreateArgs = { data: Record<string, unknown> }

describe("POST /api/webhooks/n8n create_signal — stamp parity", () => {
  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.N8N_WEBHOOK_SECRET
    } else {
      process.env.N8N_WEBHOOK_SECRET = ORIGINAL_SECRET
    }
  })

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(prisma.crmContact.findFirst).mockResolvedValue({
      id: "ct-1",
      companyId: "co-1",
    } as never)
    // Mirror prod: n8n_external_signal is a placeholder (intentCategory=null,
    // signalLevel="contact", defaultPoints=10).
    vi.mocked(prisma.signalTypeRegistry.upsert).mockResolvedValue({
      id: "reg-n8n",
      intentCategory: null,
      signalLevel: "contact",
      defaultPoints: 10,
    } as never)
    vi.mocked(prisma.intentSignal.create).mockResolvedValue({} as never)
  })

  it("[1] stamps points from data.score and copies category/level from the registry", async () => {
    const res = await POST(
      makeReq({
        action: "create_signal",
        contactEmail: "lead@example.com",
        data: { signalType: "web_visit", title: "n8n Signal", score: 55 },
      }),
    )
    expect(res.status).toBe(200)

    expect(prisma.intentSignal.create).toHaveBeenCalledTimes(1)
    const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0] as CreateArgs
    expect(args.data.points).toBe(55)
    expect(args.data.intentCategory).toBeNull()
    expect(args.data.signalLevel).toBe("contact")
    expect(args.data.source).toBe("n8n")
  })

  it("[2] falls back to registry.defaultPoints (=10) and keeps expiresAt null when absent", async () => {
    const res = await POST(
      makeReq({ action: "create_signal", contactEmail: "lead@example.com" }),
    )
    expect(res.status).toBe(200)

    const args = vi.mocked(prisma.intentSignal.create).mock.calls[0][0] as CreateArgs
    // Parity with the previous inline `data?.score ?? 10`.
    expect(args.data.points).toBe(10)
    expect(args.data.intentCategory).toBeNull()
    expect(args.data.signalLevel).toBe("contact")
    // Load-bearing nullable expiresAt preserved (null = permanent signal).
    expect(args.data.expiresAt).toBeNull()
  })
})
